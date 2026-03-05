import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';
import { safeParseTags } from '@/lib/parse-utils';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export async function POST(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'write' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status ?? 500 });

  try {
    const body = await request.json();
    const { itemId } = body;

    // Get the specific item
    const item = await db.captureItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const parsedTags = safeParseTags(item.tags);

    // Get projects for context
    const projects = await db.project.findMany({
      select: { id: true, name: true, items: { select: { id: true } } },
    });

    // Generate AI suggestion
    let suggestion = '';
    let suggestedTags: string[] = [];
    let suggestedProject = '';

    try {
      const zai = await getZAI();

      const prompt = `You are a GTD (Getting Things Done) productivity assistant. Analyze this captured item and suggest how to process it.

Item:
- Title: ${item.title}
- Type: ${item.type}
- Content: ${(item.content || '').substring(0, 500)}
- Current Tags: ${parsedTags.join(', ') || 'none'}
- Created: ${item.createdAt}

Available Projects: ${projects.map(p => p.name).join(', ') || 'none'}

Provide:
1. A brief suggestion on what to do with this item (one sentence)
2. 2-3 relevant tags (lowercase, no spaces)
3. Which project it might belong to (if any)

Respond in JSON format:
{
  "suggestion": "Your one-sentence suggestion",
  "suggestedTags": ["tag1", "tag2"],
  "suggestedProject": "Project Name or empty string"
}`;

      const result = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a helpful GTD productivity assistant. Always respond with valid JSON.' },
          { role: 'user', content: prompt }
        ]
      });

      const response = result.choices[0]?.message?.content || '';
      try {
        const parsed = JSON.parse(response);
        suggestion = parsed.suggestion || '';
        suggestedTags = parsed.suggestedTags || [];
        suggestedProject = parsed.suggestedProject || '';
      } catch {
        suggestion = response;
      }
    } catch (e) {
      console.error('AI suggestion generation failed:', e);
      // Fallback suggestions
      if (item.type === 'screenshot') {
        suggestion = 'Review the screenshot and archive if no action is needed.';
      } else if (item.type === 'webpage') {
        suggestion = 'Consider if you need to follow up on this webpage or just save it for reference.';
      } else {
        suggestion = 'Decide if this item needs action or can be archived for reference.';
      }
    }

    return NextResponse.json({
      suggestion,
      suggestedTags,
      suggestedProject,
    });
  } catch (error) {
    const classified = classifyError(error);
    return apiError(classified.message === 'Internal server error' ? 'Failed to generate suggestion' : classified.message, classified.status, {
      details: classified.details,
      logPrefix: '[POST /api/ai/process-suggestion]',
      error,
    });
  }
}
