import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { loggers } from './logger';
import { stripDangerousTags } from './sanitization';

const logger = loggers.ai; // Using AI logger as this is often an AI alternative/fallback

export interface ScraperResult {
    title: string;
    markdown: string;
    excerpt: string;
    siteName?: string;
    metadata?: Record<string, any>;
}

export function extractRichContent(html: string, url: string): ScraperResult | null {
    try {
        const doc = new JSDOM(html, { url });
        const reader = new Readability(doc.window.document);
        const article = reader.parse();

        if (!article) {
            return null;
        }

        const turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
        });

        const cleanHtml = stripDangerousTags(article.content || '');
        const markdown = turndownService.turndown(cleanHtml);

        // Parse structured data (JSON-LD)
        const metadata = parseJsonLd(doc.window.document);

        return {
            title: article.title || '',
            markdown,
            excerpt: article.excerpt || '',
            siteName: article.siteName || undefined,
            metadata,
        };
    } catch (error) {
        logger.error('Failed to extract rich content with Readability', error instanceof Error ? error : new Error(String(error)));
        return null;
    }
}

function parseJsonLd(doc: Document): Record<string, any> {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    const metadata: Record<string, any> = {};

    for (const script of Array.from(scripts)) {
        try {
            const json = JSON.parse(script.textContent || '{}');

            // JSON-LD can be an array of objects or a single object
            const items = Array.isArray(json) ? json : [json];

            for (const item of items) {
                if (!item['@type']) continue;

                const type = Array.isArray(item['@type']) ? item['@type'][0] : item['@type'];

                if (type === 'Product' || type.includes('Product')) {
                    metadata.structuredType = 'Product';
                    metadata.product = {
                        name: item.name,
                        description: item.description,
                        image: item.image,
                        brand: item.brand?.name,
                        offers: item.offers ? {
                            price: item.offers.price || item.offers.lowPrice,
                            currency: item.offers.priceCurrency,
                            availability: item.offers.availability,
                        } : undefined,
                        rating: item.aggregateRating ? {
                            value: item.aggregateRating.ratingValue,
                            count: item.aggregateRating.reviewCount,
                        } : undefined,
                    };
                } else if (type === 'Recipe' || type.includes('Recipe')) {
                    metadata.structuredType = 'Recipe';
                    metadata.recipe = {
                        name: item.name,
                        description: item.description,
                        image: item.image,
                        author: item.author?.name || (Array.isArray(item.author) ? item.author[0]?.name : undefined),
                        prepTime: item.prepTime,
                        cookTime: item.cookTime,
                        totalTime: item.totalTime,
                        recipeYield: item.recipeYield,
                        ingredients: item.recipeIngredient,
                        instructions: Array.isArray(item.recipeInstructions)
                            ? item.recipeInstructions.map((inst: any) => inst.text || inst)
                            : item.recipeInstructions,
                    };
                }
            }
        } catch (e) {
            // Ignore JSON parse errors for malformed schema
            logger.warn('Failed to parse a JSON-LD script tag', e instanceof Error ? e : new Error(String(e)));
        }
    }

    return metadata;
}
