import { NextRequest, NextResponse } from 'next/server';
import { executeChat } from '@/ai/runtime';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

const MAX_AI_INPUT_CHARS = 50_000;

const ACTION_PROMPTS: Record<string, string> = {
  continue: 'You are an AI writing assistant. Continue writing the text naturally, maintaining the same style, tone, and topic. Output ONLY the continuation text, no explanations.',
  rewrite: 'You are an AI writing assistant. Rewrite the given text to be clearer, more concise, and well-structured. Maintain the original meaning. Output ONLY the rewritten text.',
  summarize: 'You are an AI writing assistant. Provide a concise summary of the given text, capturing the key points. Output ONLY the summary.',
  expand: 'You are an AI writing assistant. Expand on the given text with more detail, examples, and context. Output ONLY the expanded text.',
  tone_professional: 'You are an AI writing assistant. Rewrite the text in a professional, formal tone. Output ONLY the rewritten text.',
  tone_casual: 'You are an AI writing assistant. Rewrite the text in a casual, conversational tone. Output ONLY the rewritten text.',
  tone_concise: 'You are an AI writing assistant. Make the text more concise and to-the-point, removing unnecessary words. Output ONLY the rewritten text.',
};

function getMockResponse(prompt: string): string {
  if (prompt.includes('continue')) {
    return '\n\nThis is a development fallback continuation. Configure chat AI in Settings for a real response.';
  }
  if (prompt.includes('rewrite')) {
    return '[Development fallback] Configure chat AI in Settings for real rewriting.';
  }
  if (prompt.includes('summarize')) {
    return '[Development fallback summary] Configure chat AI in Settings for real summarization.';
  }
  if (prompt.includes('expand')) {
    return '\n\nThis is a development fallback expansion. Configure chat AI in Settings for a real response.';
  }
  if (prompt.includes('tone')) {
    return '[Development fallback tone adjustment] Configure chat AI in Settings for a real response.';
  }
  return '[Development fallback] Configure chat AI in Settings for real writing assistance.';
}

async function getAICompletion(systemPrompt: string, userContent: string): Promise<{
  result: string;
  isMock: boolean;
  meta?: { provider: string; model: string | null };
}> {
  try {
    const { result, meta } = await executeChat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    });

    return {
      result: result.content.trim(),
      isMock: meta.usedMock,
      meta: {
        provider: meta.provider,
        model: meta.model,
      },
    };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      return {
        result: getMockResponse(systemPrompt),
        isMock: true,
      };
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'standard' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

  try {
    const body = await request.json();
    const { action, text, selectedText, context } = body;

    const isCustom = action === 'custom';
    if (!action || (!isCustom && !ACTION_PROMPTS[action])) {
      return NextResponse.json(
        { error: `Invalid action. Supported: ${Object.keys(ACTION_PROMPTS).join(', ')}, custom` },
        { status: 400 },
      );
    }

    const { customPrompt } = body;
    if (isCustom) {
      if (!customPrompt?.trim()) {
        return NextResponse.json({ error: 'customPrompt is required for custom action' }, { status: 400 });
      }
      if (typeof customPrompt === 'string' && customPrompt.length > 2000) {
        return apiError('Prompt too long', 400, { details: 'Maximum 2,000 characters for custom prompt' });
      }
    }

    for (const value of [text, selectedText, context]) {
      if (value && typeof value === 'string' && value.length > MAX_AI_INPUT_CHARS) {
        return apiError('Input too long', 400, { details: 'Maximum 50,000 characters' });
      }
    }

    if (isCustom) {
      const inputText = selectedText || text;
      const userContent = inputText?.trim() ? `${inputText}` : 'No text provided. Please respond to the prompt directly.';
      const completion = await getAICompletion(customPrompt.trim(), userContent);
      return NextResponse.json({
        action,
        result: completion.result,
        isMock: completion.isMock,
        meta: completion.meta,
      });
    }

    const inputText = selectedText || text;
    if (!inputText?.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const systemPrompt = ACTION_PROMPTS[action];
    const userContent = context
      ? `Context:\n${context}\n\nText to work with:\n${inputText}`
      : inputText;

    const completion = await getAICompletion(systemPrompt, userContent);

    return NextResponse.json({
      action,
      result: completion.result,
      isMock: completion.isMock,
      meta: completion.meta,
    });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError(message === 'Internal server error' ? 'Failed to complete AI writing request' : message, status, {
      details: safeDetails,
      logPrefix: '[POST /api/scratchpad/ai]',
      error,
    });
  }
}
