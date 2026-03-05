import { extractRichContent } from './scraper';
import { loggers } from './logger';
import { aiService } from '@/ai/ai-service';
import { isAnyAIConfigured } from '@/ai/runtime';

const logger = loggers.ai;

export async function isAIConfigured(): Promise<boolean> {
  return isAnyAIConfigured();
}

export async function extractTextFromImage(base64Image: string): Promise<string> {
  const result = await aiService.extractText({ base64Image });
  return result.text;
}

export async function captureWebPage(url: string): Promise<{
  title: string;
  description: string;
  content: string;
  favicon?: string;
}> {
  const basic = await fetchWebPageBasic(url);

  try {
    const summary = await aiService.summarize({
      content: basic.content,
      maxSentences: 3,
    });

    return {
      ...basic,
      description: summary.summary || basic.description,
    };
  } catch {
    return basic;
  }
}

export async function enhanceSearch<T extends { id: string; title: string; content?: string | null }>(
  query: string,
  items: T[],
): Promise<T[]> {
  const ranked = await aiService.enhanceSearch({
    query,
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content ?? undefined,
    })),
  });

  const scoreMap = new Map(ranked.map((entry) => [entry.id, entry.score]));
  return [...items].sort((left, right) => (scoreMap.get(right.id) ?? 0) - (scoreMap.get(left.id) ?? 0));
}

export async function suggestTags(content: string, title: string): Promise<string[]> {
  const result = await aiService.suggestTags({ title, content });
  return result.tags;
}

export async function generateSummary(content: string, maxLength: number = 3): Promise<string> {
  const result = await aiService.summarize({ content, maxSentences: maxLength });
  return result.summary;
}

export async function fetchWebPageBasic(url: string): Promise<{
  title: string;
  description: string;
  content: string;
  favicon?: string;
}> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CaptureHub/1.0)',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      if (response.status === 404) throw new Error('Page not found (404)');
      if (response.status >= 400 && response.status < 500) throw new Error(`Cannot access page (${response.status})`);
      if (response.status >= 500) throw new Error(`Server error (${response.status})`);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const scraped = extractRichContent(html, url);
    const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["'][^>]*>/i);

    return {
      title: scraped?.title || new URL(url).hostname,
      description: scraped?.excerpt || '',
      content: scraped?.markdown || html.substring(0, 5000),
      favicon: faviconMatch?.[1],
    };
  } catch (error) {
    logger.error('Basic web page fetch failed', error instanceof Error ? error : new Error(String(error)), { url });

    const message = error instanceof Error ? error.message : 'Failed to capture web page';
    if (message.includes('ENOTFOUND') || message.includes('DNS')) {
      throw new Error('Website not found - please check the URL');
    }
    if (message.includes('ECONNREFUSED') || message.includes('Connection refused')) {
      throw new Error('Could not connect to the website - the server may be down');
    }
    if (message.includes('timeout') || message.includes('AbortError')) {
      throw new Error('Request timed out - the website took too long to respond');
    }

    throw error instanceof Error ? error : new Error('Failed to capture web page');
  }
}
