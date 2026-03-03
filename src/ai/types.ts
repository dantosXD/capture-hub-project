/**
 * AI Provider Type Definitions (Project Omni P4)
 *
 * Provider-agnostic interfaces for all AI operations.
 * Implementations can use OpenAI, z-ai-web-dev-sdk, Anthropic, local models, etc.
 */

// ============================================================================
// Chat / Completion Types
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatContentPart[];
}

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

export interface ChatCompletionResult {
  content: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============================================================================
// Embedding Types
// ============================================================================

export interface EmbeddingOptions {
  input: string | string[];
  model?: string;
  dimensions?: number;
}

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  dimensions: number;
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}

// ============================================================================
// Provider Interface
// ============================================================================

export interface AIProvider {
  readonly name: string;
  readonly supportsEmbeddings: boolean;
  readonly supportsVision: boolean;

  /**
   * Generate a chat completion
   */
  chat(options: ChatCompletionOptions): Promise<ChatCompletionResult>;

  /**
   * Generate embeddings for text
   */
  embed(options: EmbeddingOptions): Promise<EmbeddingResult>;

  /**
   * Check if the provider is configured and ready
   */
  isAvailable(): boolean;

  /**
   * Health check — attempts a minimal API call
   */
  healthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string }>;
}

// ============================================================================
// AI Task Types (domain-specific)
// ============================================================================

export interface TagSuggestionResult {
  tags: string[];
  confidence: number;
}

export interface SummaryResult {
  summary: string;
  originalLength: number;
  summaryLength: number;
}

export interface OCRResult {
  text: string;
  confidence: number;
}

export interface SemanticSearchResult {
  id: string;
  score: number;
  title: string;
  snippet?: string;
}

export interface ProcessingSuggestion {
  text: string;
  action: string;
  target?: string;
  confidence: number;
}

// ============================================================================
// Provider Registry Types
// ============================================================================

export type ProviderName = 'zai' | 'openai' | 'mock';

export interface ProviderConfig {
  name: ProviderName;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  embeddingModel?: string;
  timeout?: number;
}
