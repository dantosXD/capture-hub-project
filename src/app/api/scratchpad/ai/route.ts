import { NextRequest, NextResponse } from 'next/server';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

/**
 * AI Writing Assistance Endpoint
 * POST /api/scratchpad/ai
 *
 * Actions: continue, rewrite, summarize, expand, tone
 */

const MAX_AI_INPUT_CHARS = 50_000;

async function getAICompletion(systemPrompt: string, userContent: string): Promise<string> {
    // Check for AI configuration
    if (!process.env.ZAI_API_KEY && !process.env.OPENAI_API_KEY) {
        // Return mock response for development
        return getMockResponse(systemPrompt);
    }

    try {
        const ZAI = (await import('z-ai-web-dev-sdk')).default;
        const zai = await ZAI.create();

        const result = await zai.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent },
            ],
        });

        return result.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
        const { message, details } = classifyError(error);
        const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
        // Log the failure but fall back to mock response
        apiError(message, 500, { details: safeDetails, logPrefix: '[AI Writing] Completion failed', error });
        return getMockResponse(systemPrompt);
    }
}

function getMockResponse(prompt: string): string {
    if (prompt.includes('continue')) {
        return '\n\nThis is a continuation of your text. In a production environment with an AI API key configured, this would generate contextually relevant content based on what you\'ve written so far.';
    }
    if (prompt.includes('rewrite')) {
        return '[AI Rewrite] This text has been rewritten for clarity and impact. Configure your AI API key (ZAI_API_KEY or OPENAI_API_KEY) for real AI-powered rewriting.';
    }
    if (prompt.includes('summarize')) {
        return '[Summary] Key points from the text above. Configure your AI API key for real summarization.';
    }
    if (prompt.includes('expand')) {
        return '\n\nHere is additional detail and context expanding on the ideas above. With an AI API key configured, this would provide rich, contextually relevant elaboration.';
    }
    if (prompt.includes('tone')) {
        return '[Tone adjusted] The text has been adjusted. Configure your AI API key for real tone adjustments.';
    }
    return '[AI Response] Configure ZAI_API_KEY or OPENAI_API_KEY for real AI writing assistance.';
}

const ACTION_PROMPTS: Record<string, string> = {
    continue: 'You are an AI writing assistant. Continue writing the text naturally, maintaining the same style, tone, and topic. Output ONLY the continuation text, no explanations.',
    rewrite: 'You are an AI writing assistant. Rewrite the given text to be clearer, more concise, and well-structured. Maintain the original meaning. Output ONLY the rewritten text.',
    summarize: 'You are an AI writing assistant. Provide a concise summary of the given text, capturing the key points. Output ONLY the summary.',
    expand: 'You are an AI writing assistant. Expand on the given text with more detail, examples, and context. Output ONLY the expanded text.',
    tone_professional: 'You are an AI writing assistant. Rewrite the text in a professional, formal tone. Output ONLY the rewritten text.',
    tone_casual: 'You are an AI writing assistant. Rewrite the text in a casual, conversational tone. Output ONLY the rewritten text.',
    tone_concise: 'You are an AI writing assistant. Make the text more concise and to-the-point, removing unnecessary words. Output ONLY the rewritten text.',
};

export async function POST(request: NextRequest) {
    const security = await validateRequest(request, { requireCsrf: true, rateLimitPreset: 'standard' });
    if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

    try {
        const body = await request.json();
        const { action, text, selectedText, context } = body;

        if (!action || !ACTION_PROMPTS[action]) {
            return NextResponse.json(
                { error: `Invalid action. Supported: ${Object.keys(ACTION_PROMPTS).join(', ')}` },
                { status: 400 }
            );
        }

        // Length caps on AI input fields
        if (text && typeof text === 'string' && text.length > MAX_AI_INPUT_CHARS) {
            return apiError('Input too long', 400, { details: 'Maximum 50,000 characters' });
        }
        if (selectedText && typeof selectedText === 'string' && selectedText.length > MAX_AI_INPUT_CHARS) {
            return apiError('Input too long', 400, { details: 'Maximum 50,000 characters' });
        }
        if (context && typeof context === 'string' && context.length > MAX_AI_INPUT_CHARS) {
            return apiError('Input too long', 400, { details: 'Maximum 50,000 characters' });
        }

        const inputText = selectedText || text;
        if (!inputText?.trim()) {
            return NextResponse.json(
                { error: 'No text provided' },
                { status: 400 }
            );
        }

        const systemPrompt = ACTION_PROMPTS[action];
        const userContent = context
            ? `Context:\n${context}\n\nText to work with:\n${inputText}`
            : inputText;

        const result = await getAICompletion(systemPrompt, userContent);

        return NextResponse.json({
            action,
            result,
            isMock: !process.env.ZAI_API_KEY && !process.env.OPENAI_API_KEY,
        });
    } catch (error) {
        const { message, status, details } = classifyError(error);
        const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
        return apiError(message, status, {
            details: safeDetails,
            logPrefix: '[POST /api/scratchpad/ai]',
            error,
        });
    }
}
