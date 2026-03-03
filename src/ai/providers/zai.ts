/**
 * ZAI Provider (Project Omni P4)
 *
 * Wraps the z-ai-web-dev-sdk as an AIProvider implementation.
 * Handles lazy initialization, timeout, and error normalization.
 */

import type {
  AIProvider,
  ChatCompletionOptions,
  ChatCompletionResult,
  EmbeddingOptions,
  EmbeddingResult,
} from '../types';

export class ZAIProvider implements AIProvider {
  readonly name = 'zai';
  readonly supportsEmbeddings = false; // ZAI SDK doesn't expose embeddings
  readonly supportsVision = true;

  private instance: any = null;
  private initError: Error | null = null;
  private initPromise: Promise<any> | null = null;

  isAvailable(): boolean {
    return !!(process.env.ZAI_API_KEY || process.env.OPENAI_API_KEY);
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    if (!this.isAvailable()) {
      return { ok: false, latencyMs: 0, error: 'No API key configured' };
    }

    const start = Date.now();
    try {
      const client = await this.getClient();
      if (!client) {
        return { ok: false, latencyMs: Date.now() - start, error: 'Failed to initialize ZAI' };
      }
      return { ok: true, latencyMs: Date.now() - start };
    } catch (error: any) {
      return { ok: false, latencyMs: Date.now() - start, error: error?.message || 'Unknown error' };
    }
  }

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const client = await this.getClient();
    if (!client) {
      throw new Error('ZAI client not available');
    }

    try {
      const result = await client.chat.completions.create({
        messages: options.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      });

      const content = result.choices[0]?.message?.content || '';
      return {
        content,
        finishReason: 'stop',
        usage: result.usage ? {
          promptTokens: result.usage.prompt_tokens || 0,
          completionTokens: result.usage.completion_tokens || 0,
          totalTokens: result.usage.total_tokens || 0,
        } : undefined,
      };
    } catch (error: any) {
      throw new Error(`ZAI chat failed: ${error?.message || 'Unknown error'}`);
    }
  }

  async embed(_options: EmbeddingOptions): Promise<EmbeddingResult> {
    throw new Error('ZAI provider does not support embeddings. Use OpenAI provider for embeddings.');
  }

  private async getClient(): Promise<any> {
    if (this.initError) throw this.initError;
    if (this.instance) return this.instance;

    // Prevent concurrent initialization
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.initialize();
    try {
      this.instance = await this.initPromise;
      return this.instance;
    } catch (error) {
      this.initError = error as Error;
      throw error;
    } finally {
      this.initPromise = null;
    }
  }

  private async initialize(): Promise<any> {
    if (!this.isAvailable()) {
      throw new Error('ZAI_API_KEY or OPENAI_API_KEY not configured');
    }

    // Dynamic import to avoid bundling issues when SDK not installed
    const ZAI = (await import('z-ai-web-dev-sdk')).default;

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('ZAI initialization timeout (5s)')), 5000);
    });

    return Promise.race([ZAI.create(), timeoutPromise]);
  }
}
