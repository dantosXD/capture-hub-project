import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Resolver } from 'dns/promises';
import { loggers } from './logger';

const logger = loggers.api;
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'images');

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
];

/**
 * Checks whether a URL resolves to a private or loopback IP address (SSRF protection).
 * Returns true if the URL is private (and should be blocked).
 */
async function isPrivateUrl(url: string): Promise<boolean> {
  try {
    const { hostname } = new URL(url);
    // Reject immediately if hostname itself is a private IP literal
    if (PRIVATE_IP_RANGES.some(r => r.test(hostname))) return true;
    const resolver = new Resolver();
    const addresses = await resolver.resolve4(hostname).catch(() => [] as string[]);
    return addresses.some(ip => PRIVATE_IP_RANGES.some(r => r.test(ip)));
  } catch {
    return true; // Treat unresolvable hosts as private (fail-safe)
  }
}

// Ensure upload directory exists
function ensureUploadDir() {
    if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
}

/**
 * Downloads an image from a remote URL and saves it to the public uploads folder.
 * Returns the relative path to be stored in the database.
 *
 * Security measures applied:
 * - SSRF protection: rejects private/loopback/link-local IP ranges
 * - Content-Type validation: only allows known image MIME types
 * - Size limit: rejects responses larger than 10 MB (via Content-Length header)
 */
export async function downloadImage(url: string, idPrefix: string = 'capture'): Promise<string | null> {
    if (!url || !url.startsWith('http')) return url; // Already local or invalid

    try {
        ensureUploadDir();

        // SSRF protection: reject private/loopback/link-local destinations
        const isPrivate = await isPrivateUrl(url);
        if (isPrivate) {
            throw new Error(`SSRF protection: URL resolves to a private or disallowed address: ${url}`);
        }

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

        // Size limit check via Content-Length header before downloading body
        const contentLengthHeader = response.headers.get('content-length');
        if (contentLengthHeader) {
            const contentLength = parseInt(contentLengthHeader, 10);
            if (!isNaN(contentLength) && contentLength > MAX_IMAGE_SIZE_BYTES) {
                throw new Error(`Image exceeds size limit: ${contentLength} bytes (max ${MAX_IMAGE_SIZE_BYTES})`);
            }
        }

        // Content-Type validation against allowlist
        const contentType = response.headers.get('content-type') || '';
        if (!ALLOWED_IMAGE_TYPES.some(t => contentType.startsWith(t))) {
            throw new Error(`Invalid content type: ${contentType}`);
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
