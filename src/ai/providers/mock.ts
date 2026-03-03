/**
 * Mock AI Provider (Project Omni P4)
 *
 * Used for development, testing, and graceful degradation when no
 * real AI provider is configured. Returns deterministic, reasonable
 * fallback results for all operations.
 */

import type {
  AIProvider,
  ChatCompletionOptions,
  ChatCompletionResult,
  EmbeddingOptions,
  EmbeddingResult,
} from '../types';

export class MockProvider implements AIProvider {
  readonly name = 'mock';
  readonly supportsEmbeddings = true;
  readonly supportsVision = false;

  isAvailable(): boolean {
    return true; // Always available
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    return { ok: true, latencyMs: 0 };
  }

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const lastMessage = options.messages[options.messages.length - 1];
    const systemMessage = options.messages.find(m => m.role === 'system');
    const systemContent = typeof systemMessage?.content === 'string' ? systemMessage.content : '';

    // Detect intent from system prompt and generate appropriate mock response
    // Order matters: check more specific patterns before generic ones

    if (systemContent.includes('GTD') || systemContent.includes('processing action')) {
      return this.mockResponse(JSON.stringify([
        { text: 'Review and categorize this item', action: 'navigate', target: 'inbox', confidence: 0.7 },
        { text: 'Add relevant tags for organization', action: 'tag', target: 'tags', confidence: 0.5 },
      ]));
    }

    if (systemContent.includes('search ranking') || systemContent.includes('relevance')) {
      return this.mockResponse('[0, 1, 2, 3, 4]');
    }

    if (systemContent.includes('productivity') || systemContent.includes('insight')) {
      return this.mockResponse(JSON.stringify({
        insight: 'Keep capturing and processing your ideas regularly.',
        suggestions: ['Review your inbox', 'Tag unorganized items', 'Archive processed items'],
      }));
    }

    if (systemContent.includes('Extract all text') || systemContent.includes('OCR')) {
      return this.mockResponse(
        '[Mock OCR] Simulated text extraction. Configure ZAI_API_KEY or OPENAI_API_KEY for real OCR.'
      );
    }

    if (systemContent.includes('tag')) {
      return this.mockResponse('["general", "captured", "review"]');
    }

    if (systemContent.includes('summar')) {
      const userContent = typeof lastMessage.content === 'string' ? lastMessage.content : '';
      const truncated = userContent.substring(0, 100).replace(/\n/g, ' ');
      return this.mockResponse(`${truncated}...`);
    }

    // Default response
    return this.mockResponse('[Mock AI Response] No real AI provider configured.');
  }

  async embed(options: EmbeddingOptions): Promise<EmbeddingResult> {
    const inputs = Array.isArray(options.input) ? options.input : [options.input];
    const dimensions = options.dimensions || 1536;

    // Generate deterministic pseudo-random embeddings based on content hash
    const embeddings = inputs.map(text => this.pseudoRandomVector(text, dimensions));

    return {
      embeddings,
      model: 'mock-embedding-v1',
      dimensions,
      usage: { promptTokens: inputs.join(' ').split(' ').length, totalTokens: inputs.join(' ').split(' ').length },
    };
  }

  /**
   * Generate a deterministic pseudo-random vector from text.
   * Same input always produces same output — useful for testing.
   */
  private pseudoRandomVector(text: string, dimensions: number): number[] {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    const vector: number[] = [];
    for (let i = 0; i < dimensions; i++) {
      // Simple PRNG seeded by hash + index
      hash = ((hash * 1103515245 + 12345) & 0x7fffffff);
      vector.push((hash / 0x7fffffff) * 2 - 1); // Normalize to [-1, 1]
    }

    // Normalize to unit vector
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return vector.map(v => v / magnitude);
  }

  private mockResponse(content: string): ChatCompletionResult {
    return {
      content,
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: content.split(' ').length, totalTokens: 10 + content.split(' ').length },
    };
  }
}
