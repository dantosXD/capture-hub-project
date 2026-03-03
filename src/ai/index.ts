/**
 * AI Module Barrel Export (Project Omni P4)
 *
 * Usage:
 *   import { aiService, getProvider, semanticSearch } from '@/ai';
 */

// Types
export type {
  AIProvider,
  ChatMessage,
  ChatContentPart,
  ChatCompletionOptions,
  ChatCompletionResult,
  EmbeddingOptions,
  EmbeddingResult,
  TagSuggestionResult,
  SummaryResult,
  OCRResult,
  SemanticSearchResult,
  ProcessingSuggestion,
  ProviderName,
  ProviderConfig,
} from './types';

// Provider Registry
export {
  initializeProviders,
  getProvider,
  getProviderByName,
  getMockProvider,
  isAIAvailable,
  getProviderStatus,
  resetProviders,
} from './provider-registry';

// AI Service (unified facade)
export { aiService } from './ai-service';
export {
  suggestTags,
  summarize,
  extractText,
  enhanceSearch,
  getProcessingSuggestions,
  generateInsights,
} from './ai-service';

// Embedding Pipeline
export {
  extractEmbeddableContent,
  computeContentHash,
  generateEmbedding,
  generateEmbeddingsBatch,
  storeEmbedding,
  getEmbedding,
  embedItem,
  enableAutoEmbed,
  disableAutoEmbed,
  getCachedEmbeddings,
  clearEmbeddingCache,
  getEmbeddingStats,
} from './embedding-pipeline';

// RAG Engine
export {
  cosineSimilarity,
  semanticSearch,
  findSimilarItems,
  hybridSearch,
  getRAGStatus,
} from './rag-engine';

// Providers (for direct access if needed)
export { MockProvider } from './providers/mock';
export { ZAIProvider } from './providers/zai';
