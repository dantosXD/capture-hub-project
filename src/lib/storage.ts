import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { loggers } from './logger';

const logger = loggers.api;
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'images');

// Ensure upload directory exists
function ensureUploadDir() {
    if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
}

/**
 * Downloads an image from a remote URL and saves it to the public uploads folder.
 * Returns the relative relative path to be stored in the database.
 */
export async function downloadImage(url: string, idPrefix: string = 'capture'): Promise<string | null> {
    if (!url || !url.startsWith('http')) return url; // Already local or invalid

    try {
        ensureUploadDir();

        // Create a safe, unique filename
        const urlObj = new URL(url);
        const extMatch = urlObj.pathname.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        const ext = extMatch ? extMatch[1] : 'jpg'; // Fallback to jpg

        const filename = `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const destPath = path.join(UPLOADS_DIR, filename);
        const relativeUrl = `/uploads/images/${filename}`;

        logger.debug('Downloading image', { url, destPath });

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'CaptureHub/2.0 (Bookmarklet Agent)',
            },
            signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        if (!response.body) {
            throw new Error('No readable body in fetch response');
        }

        // Convert Web ReadableStream to Node WritableStream
        const fileStream = fs.createWriteStream(destPath);
        // @ts-ignore - native fetch body is web stream, pipeline handles it nicely in modern Node
        await pipeline(response.body, fileStream);

        logger.info('Image downloaded successfully', { relativeUrl });
        return relativeUrl;

    } catch (error) {
        logger.error('Failed to download image', error instanceof Error ? error : new Error(String(error)), { url });
        // Fallback to storing the original URL if download fails (prevent complete failure)
        return url;
    }
}
