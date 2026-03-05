import type {
  AIProvider,
  ChatCompletionOptions,
  ChatCompletionResult,
  EmbeddingOptions,
  EmbeddingResult,
} from '../types';

const DEFAULT_ZAI_BASE_URL = 'https://api.z.ai/api/paas/v4';

interface ZAIProviderConfig {
  apiKey?: string | null;
  baseUrl?: string | null;
  defaultModel?: string | null;
  visionModel?: string | null;
  timeoutMs?: number;
}

function hasVisionInput(messages: ChatCompletionOptions['messages']): boolean {
  return messages.some((message) =>
    Array.isArray(message.content) &&
    message.content.some((part) => part.type === 'image_url'),
  );
}

function extractContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (part && typeof part === 'object' && 'text' in part) {
        return String((part as { text?: string }).text ?? '');
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

export class ZAIProvider implements AIProvider {
  readonly name = 'zai';
  readonly supportsEmbeddings = false;
  readonly supportsVision = true;

  private instance: any = null;
  private initPromise: Promise<any> | null = null;

  constructor(private readonly config: ZAIProviderConfig = {}) {}

  isAvailable(): boolean {
    return Boolean(this.getConfig().apiKey);
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    if (!this.isAvailable()) {
      return { ok: false, latencyMs: 0, error: 'No API key configured' };
    }

    const start = Date.now();
    try {
      const client = await this.getClient();
      if (!this.getConfig().defaultModel) {
        return { ok: true, latencyMs: Date.now() - start };
      }

      await client.chat.completions.create({
        model: this.getConfig().defaultModel,
        messages: [{ role: 'user', content: 'ping' }],
      });

      return { ok: true, latencyMs: Date.now() - start };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { ok: false, latencyMs: Date.now() - start, error: message };
    }
  }

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const client = await this.getClient();
    const isVisionRequest = hasVisionInput(options.messages);
    const model = options.model
      ?? (isVisionRequest ? this.getConfig().visionModel : this.getConfig().defaultModel)
      ?? this.getConfig().defaultModel;

    if (isVisionRequest) {
      if (!model) throw new Error('No ZAI vision model configured');

      const result = await client.chat.completions.createVision({
        model,
        messages: options.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        thinking: { type: 'disabled' },
      });

      return {
        content: extractContent(result?.choices?.[0]?.message?.content),
        finishReason: result?.choices?.[0]?.finish_reason ?? 'stop',
        usage: result?.usage ? {
          promptTokens: result.usage.prompt_tokens ?? 0,
          completionTokens: result.usage.completion_tokens ?? 0,
          totalTokens: result.usage.total_tokens ?? 0,
        } : undefined,
      };
    }

    const result = await client.chat.completions.create({
      ...(model ? { model } : {}),
      messages: options.messages.map((message) => ({
        role: message.role,
        content: typeof message.content === 'string' ? message.content : extractContent(message.content),
      })),
      thinking: { type: 'disabled' },
    });

    return {
      content: extractContent(result?.choices?.[0]?.message?.content),
      finishReason: result?.choices?.[0]?.finish_reason ?? 'stop',
      usage: result?.usage ? {
        promptTokens: result.usage.prompt_tokens ?? 0,
        completionTokens: result.usage.completion_tokens ?? 0,
        totalTokens: result.usage.total_tokens ?? 0,
      } : undefined,
    };
  }

  async embed(_options: EmbeddingOptions): Promise<EmbeddingResult> {
    throw new Error('ZAI provider does not support embeddings');
  }

  private getConfig(): Required<Pick<ZAIProviderConfig, 'baseUrl' | 'apiKey'>> & ZAIProviderConfig {
    return {
      baseUrl: (this.config.baseUrl ?? process.env.ZAI_BASE_URL ?? DEFAULT_ZAI_BASE_URL).replace(/\/+$/, ''),
      apiKey: this.config.apiKey ?? process.env.ZAI_API_KEY ?? null,
      defaultModel: this.config.defaultModel ?? process.env.ZAI_CHAT_MODEL ?? process.env.ZAI_MODEL ?? null,
      visionModel: this.config.visionModel ?? process.env.ZAI_VISION_MODEL ?? process.env.ZAI_CHAT_MODEL ?? process.env.ZAI_MODEL ?? null,
      timeoutMs: this.config.timeoutMs ?? 10000,
    };
  }

  private async getClient(): Promise<any> {
    if (this.instance) return this.instance;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.initialize();
    this.instance = await this.initPromise;
    this.initPromise = null;
    return this.instance;
  }

  private async initialize(): Promise<any> {
    const config = this.getConfig();
    if (!config.apiKey) {
      throw new Error('ZAI API key not configured');
    }

    const module = await import('z-ai-web-dev-sdk');
    const ZAI = module.default as any;

    return new ZAI({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    });
  }
}
