/**
 * AI Service Facade (Project Omni P4)
 *
 * Unified, provider-agnostic API for all AI operations.
 * Routes through the provider registry and emits domain events
 * for observability. Graceful degradation to mock when no provider configured.
 *
 * Usage:
 *   import { aiService } from '@/ai';
 *   const tags = await aiService.suggestTags({ title: '...', content: '...' });
 */

import { getProvider, isAIAvailable } from './provider-registry';
import { eventBus } from '@/contracts/event-bus';
import { EventType } from '@/contracts/events';
import type {
  TagSuggestionResult,
  SummaryResult,
  OCRResult,
  ProcessingSuggestion,
  ChatMessage,
} from './types';

// ============================================================================
// Tag Suggestions
// ============================================================================

export async function suggestTags(input: {
  title: string;
  content?: string;
}): Promise<TagSuggestionResult> {
  const provider = getProvider();
  const start = Date.now();

  try {
    const result = await provider.chat({
      messages: [
        {
          role: 'system',
          content: 'You are a tagging assistant. Suggest 3-5 relevant tags for the given content. Return ONLY a valid JSON array of lowercase tag strings. Example: ["work", "important", "meeting"]',
        },
        {
          role: 'user',
          content: `Title: ${input.title}\nContent: ${(input.content || '').substring(0, 1000)}`,
        },
      ],
      responseFormat: 'json',
    });

    let tags: string[] = [];
    try {
      tags = JSON.parse(result.content);
      if (!Array.isArray(tags)) tags = [];
      tags = tags.filter(t => typeof t === 'string' && t.length > 0);
    } catch {
      tags = [];
    }

    return { tags, confidence: isAIAvailable() ? 0.85 : 0.3 };
  } catch (error: any) {
    console.error('[AIService] suggestTags failed:', error?.message);
    return { tags: [], confidence: 0 };
  }
}

// ============================================================================
// Summarization
// ============================================================================

export async function summarize(input: {
  content: string;
  maxSentences?: number;
}): Promise<SummaryResult> {
  const provider = getProvider();
  const maxSentences = input.maxSentences || 3;

  try {
    const truncated = input.content.length > 10000
      ? input.content.substring(0, 10000) + '...'
      : input.content;

    const result = await provider.chat({
      messages: [
        {
          role: 'system',
          content: `Create a concise summary in ${maxSentences} sentence${maxSentences > 1 ? 's' : ''} or less. Capture the key points.`,
        },
        {
          role: 'user',
          content: `Summarize:\n\n${truncated}`,
        },
      ],
    });

    return {
      summary: result.content.trim(),
      originalLength: input.content.length,
      summaryLength: result.content.trim().length,
    };
  } catch (error: any) {
    // Fallback: first sentence or truncation
    const fallback = generateFallbackSummary(input.content);
    return {
      summary: fallback,
      originalLength: input.content.length,
      summaryLength: fallback.length,
    };
  }
}

function generateFallbackSummary(content: string): string {
  const cleaned = content.replace(/\s+/g, ' ').trim();
  const firstSentence = cleaned.split(/[.!?]/)[0];
  if (firstSentence && firstSentence.length > 20) {
    return firstSentence.length > 200 ? firstSentence.substring(0, 200) + '...' : firstSentence + '.';
  }
  return cleaned.length > 200 ? cleaned.substring(0, 200) + '...' : cleaned;
}

// ============================================================================
// OCR (Vision-based text extraction)
// ============================================================================

export async function extractText(input: {
  base64Image: string;
}): Promise<OCRResult> {
  const provider = getProvider();

  try {
    const imageUrl = input.base64Image.startsWith('data:')
      ? input.base64Image
      : `data:image/png;base64,${input.base64Image}`;

    const result = await provider.chat({
      messages: [
        {
          role: 'system',
          content: 'Extract all text from this image. Return only the extracted text without commentary. Preserve structure and formatting.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all visible text from this image:' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    return {
      text: result.content,
      confidence: isAIAvailable() ? 0.9 : 0.1,
    };
  } catch (error: any) {
    console.error('[AIService] extractText failed:', error?.message);
    return {
      text: '[OCR Failed] Could not extract text from image.',
      confidence: 0,
    };
  }
}

// ============================================================================
// Search Enhancement (Re-ranking)
// ============================================================================

export async function enhanceSearch(input: {
  query: string;
  items: Array<{ id: string; title: string; content?: string }>;
}): Promise<Array<{ id: string; score: number }>> {
  if (input.items.length === 0) return [];

  // If no real AI, return items in original order
  if (!isAIAvailable()) {
    return input.items.map((item, i) => ({ id: item.id, score: 1 - i * 0.01 }));
  }

  const provider = getProvider();

  try {
    const result = await provider.chat({
      messages: [
        {
          role: 'system',
          content: 'You are a search ranking assistant. Given a query and items, return a JSON array of item indices sorted by relevance. Only return valid JSON array, e.g., [0, 2, 1].',
        },
        {
          role: 'user',
          content: `Query: "${input.query}"\n\nItems:\n${input.items.map((item, i) => `[${i}] ${item.title}: ${(item.content || '').substring(0, 300)}`).join('\n')}`,
        },
      ],
      responseFormat: 'json',
    });

    const indices: number[] = JSON.parse(result.content);
    return indices
      .filter(i => i >= 0 && i < input.items.length)
      .map((idx, rank) => ({
        id: input.items[idx].id,
        score: 1 - rank * (1 / input.items.length),
      }));
  } catch {
    return input.items.map((item, i) => ({ id: item.id, score: 1 - i * 0.01 }));
  }
}

// ============================================================================
// Processing Suggestions (GTD-style)
// ============================================================================

export async function getProcessingSuggestions(input: {
  title: string;
  content?: string;
  type?: string;
  tags?: string[];
}): Promise<ProcessingSuggestion[]> {
  const provider = getProvider();

  try {
    const result = await provider.chat({
      messages: [
        {
          role: 'system',
          content: 'You are a GTD (Getting Things Done) productivity assistant. Analyze the item and suggest 2-3 processing actions. Return JSON array of objects with "text", "action" (navigate|archive|tag|link), "target", and "confidence" (0-1). Example: [{"text":"Archive as reference","action":"archive","target":"archived","confidence":0.8}]',
        },
        {
          role: 'user',
          content: `Type: ${input.type || 'note'}\nTitle: ${input.title}\nContent: ${(input.content || '').substring(0, 500)}\nTags: ${(input.tags || []).join(', ')}`,
        },
      ],
      responseFormat: 'json',
    });

    let suggestions: ProcessingSuggestion[] = [];
    try {
      suggestions = JSON.parse(result.content);
      if (!Array.isArray(suggestions)) suggestions = [];
    } catch {
      suggestions = [];
    }

    return suggestions.slice(0, 3);
  } catch {
    // Deterministic fallback
    return [
      { text: 'Review and categorize this item', action: 'navigate', target: 'inbox', confidence: 0.5 },
      { text: 'Add relevant tags for organization', action: 'tag', confidence: 0.4 },
    ];
  }
}

// ============================================================================
// Insights Generation
// ============================================================================

export async function generateInsights(input: {
  stats: Record<string, any>;
  topTags?: Array<{ tag: string; count: number }>;
  recentTitles?: string[];
}): Promise<{ insight: string; suggestions: string[] }> {
  const provider = getProvider();

  try {
    const result = await provider.chat({
      messages: [
        {
          role: 'system',
          content: 'You are a productivity assistant. Provide a brief insight (one sentence) and 2-3 actionable suggestions based on the stats. Return JSON: {"insight":"...","suggestions":["..."]}',
        },
        {
          role: 'user',
          content: `Stats: ${JSON.stringify(input.stats)}\nTop tags: ${(input.topTags || []).map(t => t.tag).join(', ')}\nRecent: ${(input.recentTitles || []).join(', ')}`,
        },
      ],
      responseFormat: 'json',
    });

    try {
      return JSON.parse(result.content);
    } catch {
      return { insight: result.content, suggestions: [] };
    }
  } catch {
    return {
      insight: 'Keep capturing and processing your ideas regularly.',
      suggestions: ['Review your inbox', 'Tag unorganized items', 'Archive processed items'],
    };
  }
}

// ============================================================================
// AI Service Singleton
// ============================================================================

export const aiService = {
  suggestTags,
  summarize,
  extractText,
  enhanceSearch,
  getProcessingSuggestions,
  generateInsights,
  isAvailable: isAIAvailable,
};
