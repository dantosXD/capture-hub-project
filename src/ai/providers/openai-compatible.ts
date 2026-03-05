import type {
  AIProvider,
  ChatCompletionOptions,
  ChatCompletionResult,
  EmbeddingOptions,
  EmbeddingResult,
} from '../types';

interface OpenAICompatibleConfig {
  baseUrl: string;
  apiKey?: string | null;
  defaultModel?: string | null;
  visionModel?: string | null;
  embeddingModel?: string | null;
  timeoutMs?: number;
  isLocal?: boolean;
}

function hasVisionInput(messages: ChatCompletionOptions['messages']): boolean {
  return messages.some((message) =>
    Array.isArray(message.content) &&
    message.content.some((part) => part.type === 'image_url'),
  );
}

function flattenMessageContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => (part && typeof part === 'object' && 'text' in part ? String((part as { text?: string }).text ?? '') : ''))
    .filter(Boolean)
    .join('\n');
}

function extractAssistantContent(content: unknown): string {
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

export class OpenAICompatibleProvider implements AIProvider {
  readonly name = 'openai';
  readonly supportsEmbeddings = true;
  readonly supportsVision = true;

  constructor(private readonly config: OpenAICompatibleConfig) {}

  isAvailable(): boolean {
    return Boolean(this.config.baseUrl && (this.config.apiKey || this.config.isLocal));
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();

    try {
      await this.request('/models', { method: 'GET' });
      return { ok: true, latencyMs: Date.now() - start };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { ok: false, latencyMs: Date.now() - start, error: message };
    }
  }

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const isVisionRequest = hasVisionInput(options.messages);
    const model = options.model
      ?? (isVisionRequest ? this.config.visionModel : this.config.defaultModel)
      ?? this.config.defaultModel;

    if (!model) {
      throw new Error(isVisionRequest ? 'No vision model configured' : 'No chat model configured');
    }

    const body: Record<string, unknown> = {
      model,
      messages: options.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    };

    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    if (options.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const response = await this.request('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const choice = response?.choices?.[0];
    const content = extractAssistantContent(choice?.message?.content);

    return {
      content,
      finishReason: choice?.finish_reason ?? 'stop',
      usage: response?.usage ? {
        promptTokens: response.usage.prompt_tokens ?? 0,
        completionTokens: response.usage.completion_tokens ?? 0,
        totalTokens: response.usage.total_tokens ?? 0,
      } : undefined,
    };
  }

  async embed(options: EmbeddingOptions): Promise<EmbeddingResult> {
    const model = options.model ?? this.config.embeddingModel;
    if (!model) {
      throw new Error('No embedding model configured');
    }

    const response = await this.request('/embeddings', {
      method: 'POST',
      body: JSON.stringify({
        model,
        input: options.input,
        ...(options.dimensions ? { dimensions: options.dimensions } : {}),
      }),
    });

    return {
      embeddings: Array.isArray(response?.data)
        ? response.data.map((item: { embedding?: number[] }) => item.embedding ?? [])
        : [],
      model: response?.model ?? model,
      dimensions: response?.data?.[0]?.embedding?.length ?? options.dimensions ?? 0,
      usage: response?.usage ? {
        promptTokens: response.usage.prompt_tokens ?? 0,
        totalTokens: response.usage.total_tokens ?? 0,
      } : undefined,
    };
  }

  private async request(path: string, init: RequestInit): Promise<any> {
    const url = `${this.config.baseUrl.replace(/\/+$/, '')}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 10000);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
          ...(init.headers ?? {}),
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI-compatible request failed (${response.status}): ${text}`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('OpenAI-compatible request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function buildFallbackSummaryFromMessages(messages: ChatCompletionOptions['messages']): string {
  const combined = messages
    .map((message) => flattenMessageContent(message.content))
    .filter(Boolean)
    .join('\n\n')
    .trim();

  if (!combined) return '';
  return combined.length > 240 ? `${combined.slice(0, 240)}...` : combined;
}
