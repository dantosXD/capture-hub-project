import ZAI from 'z-ai-web-dev-sdk';
import { loggers } from './logger';
import { retryWithBackoff, withGracefulDegradation, circuitBreakers } from './error-recovery';
import { extractRichContent } from './scraper';

const logger = loggers.ai;

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;
let zaiInitError: Error | null = null;

// Check if AI is configured without attempting to initialize
export function isAIConfigured(): boolean {
  return !!(process.env.ZAI_API_KEY || process.env.OPENAI_API_KEY);
}

async function getZAI() {
  if (zaiInitError) {
    throw zaiInitError;
  }

  if (!zaiInstance) {
    try {
      logger.debug('Initializing ZAI instance');

      // Check if API key is configured BEFORE attempting to create ZAI instance
      // This prevents hanging when ZAI.create() tries to connect with no credentials
      if (!process.env.ZAI_API_KEY && !process.env.OPENAI_API_KEY) {
        const err = new Error('ZAI_API_KEY or OPENAI_API_KEY environment variable is not set');
        (err as any).isMissingApiKey = true; // Add flag for detection
        zaiInitError = err;
        logger.warn('AI API key not configured', { error: err.message });
        throw err;
      }

      // Add timeout to prevent hanging on initialization
      const timeoutPromise = new Promise((_, reject) => {
        const err = new Error('ZAI initialization timeout after 5s');
        (err as any).isTimeout = true;
        setTimeout(() => reject(err), 5000);
      });

      zaiInstance = await Promise.race([
        ZAI.create(),
        timeoutPromise
      ]) as Awaited<ReturnType<typeof ZAI.create>>;

      logger.info('ZAI instance initialized successfully');
    } catch (error: any) {
      zaiInitError = error;
      logger.error('Failed to initialize ZAI instance', error);
      throw error;
    }
  }
  return zaiInstance;
}

// Extract text from image using VLM
export async function extractTextFromImage(base64Image: string): Promise<string> {
  return retryWithBackoff(async () => {
    return await circuitBreakers.ai.execute(async () => {
      try {
        const zai = await getZAI();

        logger.debug('OCR extraction started', {
          imageSize: base64Image.length,
        });

        const result = await zai.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: 'Extract all text from this image. Return only the extracted text without any additional commentary. Preserve structure and formatting as much as possible.'
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Please extract all text visible in this image:' },
                { type: 'image_url', image_url: { url: base64Image.startsWith('data:') ? base64Image : `data:image/png;base64,${base64Image}` } }
              ] as any
            }
          ]
        });

        const extractedText = result.choices[0]?.message?.content || '';
        logger.info('OCR extraction completed', {
          textLength: extractedText.length,
        });

        return extractedText;
      } catch (error: any) {
        // Return mock text for development/testing without API key
        if (error?.isMissingApiKey || error?.message?.includes('environment variable is not set')) {
          logger.debug('AI not configured for OCR, returning mock extracted text');
          return '[Mock OCR Result - AI not configured]\nThis is simulated text extraction for testing purposes.\nWhen ZAI_API_KEY or OPENAI_API_KEY is configured, real OCR will be performed.';
        }
        logger.error('OCR extraction failed', error);
        throw new Error('Failed to extract text from image');
      }
    });
  });
}

// Capture web page content
export async function captureWebPage(url: string): Promise<{
  title: string;
  description: string;
  content: string;
  favicon?: string;
}> {
  return retryWithBackoff(async () => {
    return await circuitBreakers.ai.execute(async () => {
      try {
        const zai = await getZAI();

        logger.debug('Web page capture started', { url });

        // Use the search function to get web page info
        // @ts-expect-error - function invoke types are limited
        const result = await zai.functions.invoke('search', { query: url });

        // Handle different result formats
        let title = 'Untitled';
        let description = '';
        let content = '';
        let favicon: string | undefined;

        // Check if result has expected structure
        const resultData = result as any;
        if (resultData && typeof resultData === 'object') {
          // Try to extract from search results or direct response
          if (Array.isArray(resultData) && resultData.length > 0) {
            const firstResult = resultData[0];
            title = firstResult.title || title;
            content = firstResult.snippet || firstResult.content || '';
            description = firstResult.snippet || '';
          } else if (resultData.title || resultData.content) {
            title = resultData.title || title;
            description = resultData.description || '';
            content = resultData.content || resultData.html || '';
            favicon = resultData.favicon || undefined;
          }
        }

        logger.info('Web page capture completed', { url, title });

        return { title, description, content, favicon };
      } catch (error: any) {
        logger.error('Web page capture failed', error, { url });

        // Preserve isMissingApiKey flag for API key detection
        if (error?.isMissingApiKey || error?.message?.includes('environment variable is not set')) {
          throw error;
        }

        // Provide user-friendly error messages for common issues
        const errorMessage = error?.message || '';
        if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Connection refused')) {
          throw new Error('Could not connect to the website - the server may be down');
        }
        if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('DNS') || errorMessage.includes('not found')) {
          throw new Error('Website not found - please check the URL');
        }
        if (errorMessage.includes('timeout') || errorMessage.includes('TIMEDOUT') || error?.name === 'AbortError') {
          throw new Error('Request timed out - the website took too long to respond');
        }
        if (errorMessage.includes('SSL') || errorMessage.includes('certificate') || errorMessage.includes('CERT')) {
          throw new Error('Security certificate error - the website may have an invalid SSL certificate');
        }

        throw new Error('Failed to capture web page');
      }
    });
  });
}

// AI-powered search enhancement
export async function enhanceSearch(query: string, items: any[]): Promise<any[]> {
  // Fast-fail if AI is not configured
  if (!process.env.ZAI_API_KEY && !process.env.OPENAI_API_KEY) {
    logger.debug('AI not configured for search enhancement, using basic results');
    return items; // Return items as-is without re-ranking
  }

  if (items.length === 0) return [];

  try {
    return await circuitBreakers.ai.execute(async () => {
      const zai = await getZAI();

      logger.debug('Search enhancement started', {
        queryLength: query.length,
        resultCount: items.length,
      });

      const result = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a search ranking assistant. Given a search query and a list of items, return a JSON array of item indices sorted by relevance to the query. Only return valid JSON array format, e.g., [0, 2, 1, 3]. Consider both title and content when ranking.'
          },
          {
            role: 'user',
            content: `Query: "${query}"\n\nItems:\n${items.map((item, i) => `[${i}] Title: ${item.title}\nContent: ${(item.content || '').substring(0, 500)}`).join('\n\n')}`
          }
        ]
      });

      const response = result.choices[0]?.message?.content || '[]';
      const indices: number[] = JSON.parse(response);

      // Return items sorted by relevance
      const rankedItems = indices
        .filter(i => i >= 0 && i < items.length)
        .map(i => items[i]);

      logger.info('Search enhancement completed', {
        queryLength: query.length,
        resultCount: rankedItems.length,
      });

      return rankedItems;
    });
  } catch (error) {
    logger.error('Search enhancement failed, using fallback', error instanceof Error ? error : undefined, {
      queryLength: query.length,
    });
    // Fallback to basic matching
    return items.filter(item =>
      item.title?.toLowerCase().includes(query.toLowerCase()) ||
      item.content?.toLowerCase().includes(query.toLowerCase())
    );
  }
}

// Auto-tagging for content
export async function suggestTags(content: string, title: string): Promise<string[]> {
  // Fast-fail if AI is not configured
  if (!process.env.ZAI_API_KEY && !process.env.OPENAI_API_KEY) {
    logger.debug('AI not configured for tag suggestions, returning empty tags');
    return [];
  }

  try {
    return await circuitBreakers.ai.execute(async () => {
      const zai = await getZAI();

      logger.debug('Tag suggestion started', {
        contentLength: content.length,
        title,
      });

      const result = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a tagging assistant. Suggest 3-5 relevant tags for the given content. Return ONLY a valid JSON array of lowercase tag strings without any additional text. Example: ["work", "important", "meeting", "follow-up"]'
          },
          {
            role: 'user',
            content: `Title: ${title}\nContent: ${content.substring(0, 1000)}`
          }
        ]
      });

      const response = result.choices[0]?.message?.content || '[]';
      const tags: string[] = JSON.parse(response);

      const validTags = tags.filter(tag => typeof tag === 'string' && tag.length > 0);

      logger.info('Tag suggestion completed', {
        tagCount: validTags.length,
        tags: validTags,
      });

      return validTags;
    });
  } catch (error: any) {
    // Return empty tags if AI not available instead of failing
    if (error?.isMissingApiKey || error?.message?.includes('environment variable is not set')) {
      logger.debug('AI not configured for tag suggestions, returning empty tags');
      return [];
    }
    logger.error('Tag suggestion failed, returning empty tags', error instanceof Error ? error : undefined);
    return [];
  }
}

// Generate summary for content
export async function generateSummary(content: string, maxLength: number = 3): Promise<string> {
  // Fast-fail if AI is not configured
  if (!process.env.ZAI_API_KEY && !process.env.OPENAI_API_KEY) {
    logger.debug('AI not configured for summarization, using fallback');
    return generateFallbackSummary(content);
  }

  try {
    return await circuitBreakers.ai.execute(async () => {
      const zai = await getZAI();

      logger.debug('Summary generation started', {
        contentLength: content.length,
        maxLength,
      });

      const result = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a summarization assistant. Create a concise summary of the given content in ${maxLength} sentence${maxLength > 1 ? 's' : ''} or less. Capture the key points and main ideas.`
          },
          {
            role: 'user',
            content: `Please summarize the following content:\n\n${content.substring(0, 5000)}`
          }
        ]
      });

      const summary = result.choices[0]?.message?.content?.trim() || '';

      logger.info('Summary generation completed', {
        summaryLength: summary.length,
      });

      return summary;
    });
  } catch (error: any) {
    // Return fallback summary if AI not available or fails
    if (error?.isMissingApiKey || error?.isTimeout || error?.message?.includes('environment variable is not set') || error?.message?.includes('timeout')) {
      logger.debug('AI not configured or timed out for summarization, using fallback');
      return generateFallbackSummary(content);
    }
    logger.error('Summary generation failed, using fallback', error instanceof Error ? error : undefined);
    return generateFallbackSummary(content);
  }
}

// Fallback summary function for when AI is not configured
function generateFallbackSummary(content: string): string {
  // Remove extra whitespace and get first meaningful sentence
  const cleaned = content.replace(/\s+/g, ' ').trim();

  // Try to find first sentence boundary
  const firstSentence = cleaned.split(/[.!?]/)[0];

  if (firstSentence && firstSentence.length > 20) {
    // If we have a substantial first sentence, truncate it if needed
    return firstSentence.length > 200 ? firstSentence.substring(0, 200) + '...' : firstSentence + '.';
  }

  // Otherwise, just return truncated content
  return cleaned.length > 200 ? cleaned.substring(0, 200) + '...' : cleaned;
}

// Fallback: Fetch page content without AI (for development/testing without API key)
export async function fetchWebPageBasic(url: string): Promise<{
  title: string;
  description: string;
  content: string;
  favicon?: string;
}> {
  try {
    logger.debug('Basic web page fetch started', { url });

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CaptureHub/1.0)',
      },
      // Add timeout to prevent hanging on unreachable URLs
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      // Return specific error for HTTP errors
      if (response.status === 404) {
        throw new Error('Page not found (404)');
      } else if (response.status >= 400 && response.status < 500) {
        throw new Error(`Cannot access page (${response.status})`);
      } else if (response.status >= 500) {
        throw new Error(`Server error (${response.status})`);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    const scraped = extractRichContent(html, url);
    const faviconMatch = html.match(/<link[^>]*rel=["']icon["'][^>]*href=["']([^"']*)["'][^>]*>/i);

    const result = {
      title: scraped?.title || new URL(url).hostname,
      description: scraped?.excerpt || '',
      content: scraped?.markdown || html.substring(0, 5000), // Fallback
      favicon: faviconMatch ? faviconMatch[1] : undefined,
      metadata: scraped?.metadata || {},
    };

    logger.info('Basic web page fetch completed', {
      url,
      title: result.title,
      contentLength: result.content.length,
    });

    return result;
  } catch (error: any) {
    logger.error('Basic web page fetch failed', error instanceof Error ? error : undefined, { url });

    // Provide more specific error messages
    const errorMessage = error?.message || '';
    const errorName = error?.name || '';

    // Invalid URL format
    if (errorName === 'TypeError' && errorMessage.includes('URL is invalid')) {
      throw new Error('Invalid URL format');
    }
    if (errorName === 'TypeError' && errorMessage.includes('Invalid URL')) {
      throw new Error('Invalid URL format');
    }

    // Network/connection errors
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Connection refused') || errorMessage.includes('Unable to connect')) {
      throw new Error('Could not connect to the website - the server may be down');
    }
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('DNS') || errorMessage.includes('DNS_LOOKUP')) {
      throw new Error('Website not found - please check the URL');
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('TIMEDOUT') || errorName === 'AbortError') {
      throw new Error('Request timed out - the website took too long to respond');
    }
    if (errorMessage.includes('SSL') || errorMessage.includes('certificate') || errorMessage.includes('CERT')) {
      throw new Error('Security certificate error - the website may have an invalid SSL certificate');
    }

    // Re-throw our specific HTTP errors
    if (errorMessage.includes('Page not found') || errorMessage.includes('Cannot access page') || errorMessage.includes('Server error')) {
      throw error;
    }

    // Generic fallback with original error details
    throw new Error('Failed to capture web page');
  }
}
