import { executeChat, isAnyAIConfigured } from './runtime';
import type {
  OCRResult,
  ProcessingSuggestion,
  SummaryResult,
  TagSuggestionResult,
} from './types';

function generateFallbackSummary(content: string): string {
  const cleaned = content.replace(/\s+/g, ' ').trim();
  const firstSentence = cleaned.split(/[.!?]/)[0];
  if (firstSentence && firstSentence.length > 20) {
    return firstSentence.length > 200 ? `${firstSentence.substring(0, 200)}...` : `${firstSentence}.`;
  }
  return cleaned.length > 200 ? `${cleaned.substring(0, 200)}...` : cleaned;
}

export async function suggestTags(input: {
  title: string;
  content?: string;
}): Promise<TagSuggestionResult> {
  try {
    const { result, meta } = await executeChat({
      messages: [
        {
          role: 'system',
          content: 'You are a tagging assistant. Suggest 3-5 relevant tags for the given content. Return ONLY a valid JSON array of lowercase tag strings.',
        },
        {
          role: 'user',
          content: `Title: ${input.title}\nContent: ${(input.content || '').substring(0, 1200)}`,
        },
      ],
      responseFormat: 'json',
    });

    const parsed = JSON.parse(result.content || '[]');
    const tags = Array.isArray(parsed)
      ? parsed.filter((tag) => typeof tag === 'string' && tag.length > 0).slice(0, 5)
      : [];

    return {
      tags,
      confidence: meta.usedMock ? 0.3 : 0.85,
    };
  } catch {
    return { tags: [], confidence: 0 };
  }
}

export async function summarize(input: {
  content: string;
  maxSentences?: number;
}): Promise<SummaryResult> {
  const maxSentences = input.maxSentences || 3;

  try {
    const { result } = await executeChat({
      messages: [
        {
          role: 'system',
          content: `Create a concise summary in ${maxSentences} sentence${maxSentences > 1 ? 's' : ''} or less. Return only the summary text.`,
        },
        {
          role: 'user',
          content: input.content.length > 10000 ? `${input.content.substring(0, 10000)}...` : input.content,
        },
      ],
    });

    const summary = result.content.trim();
    return {
      summary,
      originalLength: input.content.length,
      summaryLength: summary.length,
    };
  } catch {
    const fallback = generateFallbackSummary(input.content);
    return {
      summary: fallback,
      originalLength: input.content.length,
      summaryLength: fallback.length,
    };
  }
}

export async function extractText(input: {
  base64Image: string;
}): Promise<OCRResult> {
  try {
    const imageUrl = input.base64Image.startsWith('data:')
      ? input.base64Image
      : `data:image/png;base64,${input.base64Image}`;

    const { result, meta } = await executeChat({
      messages: [
        {
          role: 'system',
          content: 'Extract all visible text from the image and return only the extracted text.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the text from this image.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    return {
      text: result.content,
      confidence: meta.usedMock ? 0.1 : 0.9,
    };
  } catch {
    return {
      text: '[OCR Failed] Could not extract text from image.',
      confidence: 0,
    };
  }
}

export async function enhanceSearch(input: {
  query: string;
  items: Array<{ id: string; title: string; content?: string }>;
}): Promise<Array<{ id: string; score: number }>> {
  if (input.items.length === 0) return [];

  try {
    const { result, meta } = await executeChat({
      messages: [
        {
          role: 'system',
          content: 'Given a search query and candidate items, return a JSON array of item indices sorted by semantic relevance.',
        },
        {
          role: 'user',
          content: `Query: "${input.query}"\n\nItems:\n${input.items.map((item, index) => `[${index}] ${item.title}: ${(item.content || '').substring(0, 300)}`).join('\n')}`,
        },
      ],
      responseFormat: 'json',
    });

    if (meta.usedMock) {
      return input.items.map((item, index) => ({ id: item.id, score: 1 - index * 0.01 }));
    }

    const indices = JSON.parse(result.content || '[]');
    if (!Array.isArray(indices)) {
      return input.items.map((item, index) => ({ id: item.id, score: 1 - index * 0.01 }));
    }

    return indices
      .filter((index) => typeof index === 'number' && index >= 0 && index < input.items.length)
      .map((index, rank) => ({
        id: input.items[index].id,
        score: 1 - rank * (1 / input.items.length),
      }));
  } catch {
    return input.items.map((item, index) => ({ id: item.id, score: 1 - index * 0.01 }));
  }
}

export async function getProcessingSuggestions(input: {
  title: string;
  content?: string;
  type?: string;
  tags?: string[];
}): Promise<ProcessingSuggestion[]> {
  try {
    const { result } = await executeChat({
      messages: [
        {
          role: 'system',
          content: 'Analyze the capture item and return a JSON array with 2-3 processing suggestions. Each object must include "text", "action", optional "target", and "confidence".',
        },
        {
          role: 'user',
          content: `Type: ${input.type || 'note'}\nTitle: ${input.title}\nContent: ${(input.content || '').substring(0, 700)}\nTags: ${(input.tags || []).join(', ')}`,
        },
      ],
      responseFormat: 'json',
    });

    const parsed = JSON.parse(result.content || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  } catch {
    return [
      { text: 'Review and categorize this item', action: 'navigate', target: 'inbox', confidence: 0.5 },
      { text: 'Add relevant tags for organization', action: 'tag', confidence: 0.4 },
    ];
  }
}

export async function generateInsights(input: {
  stats: object;
  topTags?: Array<{ tag: string; count: number }>;
  recentTitles?: string[];
}): Promise<{ insight: string; suggestions: string[]; meta?: { provider: string; model: string | null } }> {
  try {
    const { result, meta } = await executeChat({
      messages: [
        {
          role: 'system',
          content: 'Provide one short insight and 2-3 actionable suggestions as JSON: {"insight":"...","suggestions":["..."]}',
        },
        {
          role: 'user',
          content: `Stats: ${JSON.stringify(input.stats)}\nTop tags: ${(input.topTags || []).map((tag) => tag.tag).join(', ')}\nRecent: ${(input.recentTitles || []).join(', ')}`,
        },
      ],
      responseFormat: 'json',
    });

    const parsed = JSON.parse(result.content || '{}');
    return {
      insight: typeof parsed.insight === 'string' ? parsed.insight : result.content,
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.filter((value) => typeof value === 'string').slice(0, 3)
        : [],
      meta: {
        provider: meta.provider,
        model: meta.model,
      },
    };
  } catch {
    return {
      insight: 'Keep capturing and processing your ideas regularly.',
      suggestions: ['Review your inbox', 'Tag unorganized items', 'Archive processed items'],
    };
  }
}

export const aiService = {
  suggestTags,
  summarize,
  extractText,
  enhanceSearch,
  getProcessingSuggestions,
  generateInsights,
  isAvailable: isAnyAIConfigured,
};
