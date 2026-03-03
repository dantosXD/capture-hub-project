/**
 * AI Pipeline Validation Tests (Project Omni P4)
 * Tests provider abstraction, embedding pipeline, RAG engine, and AI service.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Provider & Registry
import { MockProvider } from './providers/mock';
import {
  initializeProviders,
  getProvider,
  getProviderByName,
  getMockProvider,
  isAIAvailable,
  getProviderStatus,
  resetProviders,
} from './provider-registry';

// Embedding Pipeline
import {
  extractEmbeddableContent,
  computeContentHash,
  embedItem,
  getCachedEmbeddings,
  clearEmbeddingCache,
  getEmbeddingStats,
  enableAutoEmbed,
  disableAutoEmbed,
} from './embedding-pipeline';

// RAG Engine
import { cosineSimilarity, getRAGStatus } from './rag-engine';

// AI Service
import { aiService } from './ai-service';

// ============================================================================
// Mock Provider Tests
// ============================================================================

describe('MockProvider', () => {
  const mock = new MockProvider();

  it('should always be available', () => {
    expect(mock.isAvailable()).toBe(true);
    expect(mock.name).toBe('mock');
  });

  it('should pass health check', async () => {
    const health = await mock.healthCheck();
    expect(health.ok).toBe(true);
    expect(health.latencyMs).toBe(0);
  });

  it('should generate tag suggestions from system prompt', async () => {
    const result = await mock.chat({
      messages: [
        { role: 'system', content: 'You are a tagging assistant. Suggest tags.' },
        { role: 'user', content: 'Title: Meeting notes' },
      ],
    });
    expect(result.content).toContain('[');
    expect(result.finishReason).toBe('stop');
    expect(result.usage).toBeDefined();
  });

  it('should generate summary from system prompt', async () => {
    const result = await mock.chat({
      messages: [
        { role: 'system', content: 'Create a concise summary.' },
        { role: 'user', content: 'This is a long document about productivity...' },
      ],
    });
    expect(result.content.length).toBeGreaterThan(0);
  });

  it('should generate OCR response from system prompt', async () => {
    const result = await mock.chat({
      messages: [
        { role: 'system', content: 'Extract all text from this image.' },
        { role: 'user', content: 'Image data here' },
      ],
    });
    expect(result.content).toContain('Mock OCR');
  });

  it('should generate deterministic embeddings', async () => {
    const result1 = await mock.embed({ input: 'hello world' });
    const result2 = await mock.embed({ input: 'hello world' });

    expect(result1.embeddings[0]).toEqual(result2.embeddings[0]);
    expect(result1.dimensions).toBe(1536);
    expect(result1.embeddings[0].length).toBe(1536);
  });

  it('should generate different embeddings for different inputs', async () => {
    const result1 = await mock.embed({ input: 'hello world' });
    const result2 = await mock.embed({ input: 'goodbye world' });

    expect(result1.embeddings[0]).not.toEqual(result2.embeddings[0]);
  });

  it('should batch embed multiple inputs', async () => {
    const result = await mock.embed({ input: ['text one', 'text two', 'text three'] });
    expect(result.embeddings.length).toBe(3);
    expect(result.embeddings[0].length).toBe(1536);
  });

  it('should generate unit vectors (magnitude ≈ 1)', async () => {
    const result = await mock.embed({ input: 'test vector normalization' });
    const vector = result.embeddings[0];
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    expect(magnitude).toBeCloseTo(1, 4);
  });
});

// ============================================================================
// Provider Registry Tests
// ============================================================================

describe('Provider Registry', () => {
  beforeEach(() => {
    resetProviders();
  });

  it('should auto-initialize on first access', () => {
    const provider = getProvider();
    expect(provider).toBeDefined();
    expect(provider.name).toBeDefined();
  });

  it('should register mock provider', () => {
    initializeProviders();
    const mock = getProviderByName('mock');
    expect(mock).toBeDefined();
    expect(mock!.name).toBe('mock');
  });

  it('should always have mock available via getMockProvider', () => {
    const mock = getMockProvider();
    expect(mock).toBeDefined();
    expect(mock.isAvailable()).toBe(true);
  });

  it('should report status correctly', () => {
    const status = getProviderStatus();
    expect(status.initialized).toBe(true);
    expect(status.availableProviders).toContain('mock');
    expect(status.defaultProvider).toBeDefined();
  });

  it('should use mock when no API key is set', () => {
    const originalZai = process.env.ZAI_API_KEY;
    const originalOpenai = process.env.OPENAI_API_KEY;
    delete process.env.ZAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    resetProviders();
    initializeProviders();
    expect(isAIAvailable()).toBe(false);
    expect(getProvider().name).toBe('mock');

    // Restore
    if (originalZai) process.env.ZAI_API_KEY = originalZai;
    if (originalOpenai) process.env.OPENAI_API_KEY = originalOpenai;
  });
});

// ============================================================================
// Embedding Pipeline Tests
// ============================================================================

describe('Embedding Pipeline', () => {
  beforeEach(() => {
    resetProviders();
    clearEmbeddingCache();
  });

  describe('extractEmbeddableContent', () => {
    it('should combine title and content', () => {
      const text = extractEmbeddableContent({
        title: 'Meeting Notes',
        content: 'Discussed project timeline',
      });
      expect(text).toContain('Meeting Notes');
      expect(text).toContain('Discussed project timeline');
    });

    it('should include extracted text', () => {
      const text = extractEmbeddableContent({
        title: 'Screenshot',
        extractedText: 'OCR extracted text here',
      });
      expect(text).toContain('OCR extracted text here');
    });

    it('should parse JSON tags', () => {
      const text = extractEmbeddableContent({
        title: 'Note',
        tags: '["work", "important"]',
      });
      expect(text).toContain('Tags: work, important');
    });

    it('should handle array tags', () => {
      const text = extractEmbeddableContent({
        title: 'Note',
        tags: ['dev', 'review'],
      });
      expect(text).toContain('Tags: dev, review');
    });

    it('should handle empty/null fields', () => {
      const text = extractEmbeddableContent({
        title: 'Minimal',
        content: null,
        extractedText: null,
      });
      expect(text).toBe('Minimal');
    });
  });

  describe('computeContentHash', () => {
    it('should produce consistent hashes', () => {
      const hash1 = computeContentHash('hello world');
      const hash2 = computeContentHash('hello world');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different content', () => {
      const hash1 = computeContentHash('hello world');
      const hash2 = computeContentHash('goodbye world');
      expect(hash1).not.toBe(hash2);
    });

    it('should produce 16-character hex strings', () => {
      const hash = computeContentHash('test content');
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });
  });

  describe('embedItem', () => {
    it('should embed a valid item', async () => {
      const result = await embedItem({
        id: 'item-1',
        title: 'Test Item',
        content: 'This is a test item with enough content to embed.',
      });
      expect(result.embedded).toBe(true);
      expect(result.skipped).toBe(false);
    });

    it('should skip items with insufficient content', async () => {
      const result = await embedItem({
        id: 'item-2',
        title: 'Hi',
        content: null,
      });
      expect(result.embedded).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('too short');
    });

    it('should skip if content hash unchanged', async () => {
      await embedItem({
        id: 'item-3',
        title: 'Same Content',
        content: 'This content will not change between calls.',
      });

      const result = await embedItem({
        id: 'item-3',
        title: 'Same Content',
        content: 'This content will not change between calls.',
      });

      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('unchanged');
    });

    it('should re-embed if content changes', async () => {
      await embedItem({
        id: 'item-4',
        title: 'Changing Content',
        content: 'Version 1 of the content.',
      });

      const result = await embedItem({
        id: 'item-4',
        title: 'Changing Content',
        content: 'Version 2 of the content with modifications.',
      });

      expect(result.embedded).toBe(true);
      expect(result.skipped).toBe(false);
    });

    it('should store embedding in cache', async () => {
      await embedItem({
        id: 'item-5',
        title: 'Cached Item',
        content: 'This should be stored in the embedding cache.',
      });

      const cache = getCachedEmbeddings();
      expect(cache.has('item-5')).toBe(true);
      expect(cache.get('item-5')!.vector.length).toBe(1536);
    });
  });

  describe('Embedding Stats', () => {
    it('should report correct stats', async () => {
      await embedItem({ id: 'stat-1', title: 'Item A', content: 'Content for stats test A.' });
      await embedItem({ id: 'stat-2', title: 'Item B', content: 'Content for stats test B.' });

      const stats = getEmbeddingStats();
      expect(stats.cachedCount).toBe(2);
    });
  });
});

// ============================================================================
// RAG Engine Tests
// ============================================================================

describe('RAG Engine', () => {
  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const v = [1, 0, 0, 0];
      expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const v1 = [1, 0, 0];
      const v2 = [-1, 0, 0];
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(-1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const v1 = [1, 0, 0];
      const v2 = [0, 1, 0];
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(0, 5);
    });

    it('should handle zero vectors', () => {
      const v1 = [0, 0, 0];
      const v2 = [1, 2, 3];
      expect(cosineSimilarity(v1, v2)).toBe(0);
    });

    it('should handle different-length vectors', () => {
      const v1 = [1, 0];
      const v2 = [1, 0, 0];
      expect(cosineSimilarity(v1, v2)).toBe(0);
    });

    it('should return high similarity for close vectors', () => {
      const v1 = [1, 2, 3, 4, 5];
      const v2 = [1.1, 2.1, 3.1, 4.1, 5.1];
      expect(cosineSimilarity(v1, v2)).toBeGreaterThan(0.99);
    });
  });

  describe('RAG Status', () => {
    it('should report current status', () => {
      const status = getRAGStatus();
      expect(status.searchMode).toBeDefined();
      expect(['pgvector', 'in-memory']).toContain(status.searchMode);
      expect(typeof status.embeddingsCached).toBe('number');
    });
  });
});

// ============================================================================
// AI Service Facade Tests
// ============================================================================

describe('AI Service', () => {
  beforeEach(() => {
    resetProviders();
  });

  it('should report availability', () => {
    expect(typeof aiService.isAvailable()).toBe('boolean');
  });

  it('should suggest tags', async () => {
    const result = await aiService.suggestTags({
      title: 'Meeting with team about Q3 planning',
      content: 'Discussed roadmap, deadlines, and resource allocation.',
    });
    expect(result).toHaveProperty('tags');
    expect(result).toHaveProperty('confidence');
    expect(Array.isArray(result.tags)).toBe(true);
  });

  it('should summarize content', async () => {
    const result = await aiService.summarize({
      content: 'This is a detailed document about project management best practices. It covers topics like agile methodology, sprint planning, retrospectives, and continuous improvement. The document emphasizes the importance of clear communication and regular feedback loops.',
    });
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('originalLength');
    expect(result).toHaveProperty('summaryLength');
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('should extract text from images', async () => {
    const result = await aiService.extractText({
      base64Image: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    });
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('confidence');
  });

  it('should enhance search results', async () => {
    const items = [
      { id: '1', title: 'React hooks guide', content: 'useEffect, useState...' },
      { id: '2', title: 'Grocery list', content: 'milk, eggs...' },
      { id: '3', title: 'React component patterns', content: 'HOC, render props...' },
    ];

    const result = await aiService.enhanceSearch({ query: 'React', items });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('score');
  });

  it('should generate processing suggestions', async () => {
    const result = await aiService.getProcessingSuggestions({
      title: 'Call dentist to schedule appointment',
      content: 'Need to book a cleaning for next month',
      type: 'note',
      tags: ['health'],
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]).toHaveProperty('text');
    expect(result[0]).toHaveProperty('action');
  });

  it('should generate insights', async () => {
    const result = await aiService.generateInsights({
      stats: { total: 50, inbox: 12, archived: 35, stale: 3 },
      topTags: [{ tag: 'work', count: 20 }, { tag: 'personal', count: 10 }],
      recentTitles: ['Meeting notes', 'Project plan'],
    });
    expect(result).toHaveProperty('insight');
    expect(result).toHaveProperty('suggestions');
    expect(typeof result.insight).toBe('string');
    expect(Array.isArray(result.suggestions)).toBe(true);
  });
});

// ============================================================================
// Auto-Embed Integration
// ============================================================================

describe('Auto-Embed', () => {
  beforeEach(() => {
    resetProviders();
    clearEmbeddingCache();
    disableAutoEmbed();
  });

  afterEach(() => {
    disableAutoEmbed();
  });

  it('should enable and disable without error', () => {
    enableAutoEmbed();
    let stats = getEmbeddingStats();
    expect(stats.autoEmbedEnabled).toBe(true);

    disableAutoEmbed();
    stats = getEmbeddingStats();
    expect(stats.autoEmbedEnabled).toBe(false);
  });

  it('should not double-subscribe', () => {
    enableAutoEmbed();
    enableAutoEmbed(); // Second call
    const stats = getEmbeddingStats();
    expect(stats.autoEmbedEnabled).toBe(true);
    // No error thrown
  });
});
