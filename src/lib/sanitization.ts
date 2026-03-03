/**
 * Content sanitization utilities for XSS prevention
 * Provides safe HTML escaping and content cleaning
 */

/**
 * Escape HTML special characters to prevent XSS attacks.
 * This is used when rendering user content outside of React's context.
 *
 * @param str - The string to escape
 * @returns The escaped string safe for HTML rendering
 *
 * @example
 * escapeHtml('<script>alert("xss")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  const reg = /[&<>"'/]/gi;
  return str.replace(reg, (match) => map[match]);
}

/**
 * Escape JavaScript string content to prevent script injection.
 *
 * @param str - The string to escape
 * @returns The escaped string safe for use in JavaScript strings
 */
export function escapeJs(str: string): string {
  if (!str) return '';
  const map: Record<string, string> = {
    '\\': '\\\\',
    "'": "\\'",
    '"': '\\"',
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t',
    '\b': '\\b',
    '\f': '\\f',
  };
  const reg = /[\\'"'\n\r\t\b\f]/gi;
  return str.replace(reg, (match) => map[match]);
}

/**
 * Sanitize URL to prevent javascript: and data: schemes that could lead to XSS.
 * Only allows http:, https:, and relative URLs.
 *
 * @param url - The URL to sanitize
 * @returns The sanitized URL or null if unsafe
 *
 * @example
 * sanitizeUrl('javascript:alert(1)') // Returns: null
 * sanitizeUrl('https://example.com') // Returns: 'https://example.com'
 * sanitizeUrl('/relative/path') // Returns: '/relative/path'
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  const trimmed = url.trim();

  // Allow relative URLs (starting with / or ./)
  if (/^[./]/.test(trimmed)) {
    return trimmed;
  }

  // Allow http: and https: only
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
  } catch {
    // Invalid URL
    return null;
  }

  // Block everything else (javascript:, data:, vbscript:, etc.)
  return null;
}

/**
 * Validate and sanitize a color hex code.
 *
 * @param color - The color to validate
 * @returns A valid hex color or default indigo color
 */
export function sanitizeColor(color: string | null | undefined): string {
  if (!color) return '#6366f1'; // Default indigo

  const trimmed = color.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed;
  }

  return '#6366f1'; // Default indigo if invalid
}

/**
 * Sanitize user-provided tags array.
 * Trims each tag, removes empty tags, and limits the array size.
 *
 * @param tags - The tags array to sanitize
 * @param maxTags - Maximum number of tags (default: 50)
 * @returns The sanitized tags array
 */
export function sanitizeTags(tags: string[] | null | undefined, maxTags = 50): string[] {
  if (!Array.isArray(tags)) return [];

  return tags
    .map(tag => tag?.trim() || '')
    .filter(tag => tag.length > 0 && tag.length <= 100)
    .slice(0, maxTags);
}

/**
 * Sanitize text input by trimming and enforcing length limits.
 *
 * @param text - The text to sanitize
 * @param maxLength - Maximum allowed length
 * @returns The sanitized text or null if empty
 */
export function sanitizeText(text: string | null | undefined, maxLength = 10000): string | null {
  if (!text) return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

/**
 * Sanitize a title or name field.
 * Ensures non-empty trimmed string with reasonable length.
 *
 * @param title - The title to sanitize
 * @returns The sanitized title
 * @throws Error if title is invalid
 */
export function sanitizeTitle(title: string | null | undefined): string {
  if (!title || typeof title !== 'string') {
    throw new Error('Title is required and must be a string');
  }

  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new Error('Title cannot be empty');
  }

  if (trimmed.length > 500) {
    throw new Error('Title is too long (max 500 characters)');
  }

  return trimmed;
}

/**
 * Sanitize content/description fields.
 * Allows longer text with markdown.
 *
 * @param content - The content to sanitize
 * @param maxLength - Maximum length (default: 10000)
 * @returns The sanitized content or null
 */
export function sanitizeContent(content: string | null | undefined, maxLength = 10000): string | null {
  if (content === null || content === undefined) return null;

  const trimmed = content.trim();
  if (trimmed.length === 0) return null;

  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

/**
 * Strip potentially dangerous HTML tags from user input.
 * This is a basic sanitization - for full HTML rendering, use rehype-sanitize.
 *
 * @param str - The string to strip tags from
 * @returns The string with dangerous tags removed
 */
export function stripDangerousTags(str: string): string {
  if (!str) return '';

  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers like onclick=
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .replace(/data:/gi, ''); // Remove data: protocol (except for data: images in img tags)
}

/**
 * Sanitize metadata object by removing null values and ensuring JSON-serializable values.
 *
 * @param metadata - The metadata object to sanitize
 * @returns The sanitized metadata object
 */
export function sanitizeMetadata(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== 'object') return null;

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    // Skip null or undefined values
    if (value === null || value === undefined) continue;

    // Only include JSON-serializable values
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean') {
      sanitized[key] = value;
    } else if (type === 'object') {
      try {
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
      } catch {
        // Skip non-serializable objects
        continue;
      }
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Validate ISO date string.
 *
 * @param dateStr - The date string to validate
 * @returns The validated date string or null if invalid
 */
export function validateIsoDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;

  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  try {
    const date = new Date(trimmed);
    if (isNaN(date.getTime())) return null;

    // Return ISO string
    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * Sanitize search query to prevent SQL injection and DoS attacks.
 *
 * @param query - The search query to sanitize
 * @param maxLength - Maximum allowed length (default: 1000)
 * @returns The sanitized query or null if invalid
 */
export function sanitizeSearchQuery(query: string | null | undefined, maxLength = 1000): string | null {
  if (!query) return null;

  const trimmed = query.trim();
  if (!trimmed) return null;

  // Truncate to prevent DoS
  const truncated = trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;

  return truncated;
}

/**
 * Validate an ID string (for CUIDs or similar).
 *
 * @param id - The ID to validate
 * @returns The validated ID
 * @throws Error if ID is invalid
 */
export function validateId(id: string | null | undefined): string {
  if (!id || typeof id !== 'string') {
    throw new Error('ID is required and must be a string');
  }

  const trimmed = id.trim();
  if (trimmed.length === 0 || trimmed.length > 100) {
    throw new Error('Invalid ID format');
  }

  return trimmed;
}

/**
 * Sanitize base64 image data.
 * Validates base64 format and reasonable size limits.
 *
 * @param base64Data - The base64 image data
 * @param maxSizeMB - Maximum size in megabytes (default: 10)
 * @returns The sanitized base64 data or null if invalid
 */
export function sanitizeBase64Image(base64Data: string | null | undefined, maxSizeMB = 10): string | null {
  if (!base64Data || typeof base64Data !== 'string') return null;

  const trimmed = base64Data.trim();
  if (!trimmed.startsWith('data:image/')) {
    return null;
  }

  // Calculate approximate size (base64 is ~33% larger than original)
  const sizeInBytes = Math.floor(trimmed.length * 0.75);
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (sizeInBytes > maxSizeBytes) {
    return null;
  }

  return trimmed;
}

/**
 * Comprehensive input sanitization for capture items.
 *
 * @param data - The capture item data to sanitize
 * @returns The sanitized capture item data
 */
export function sanitizeCaptureItem(data: {
  title?: string;
  content?: string | null;
  extractedText?: string | null;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
  priority?: string;
  status?: string;
  assignedTo?: string | null;
  dueDate?: string | null;
  projectId?: string | null;
}): {
  title: string;
  content: string | null;
  extractedText: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  priority: string;
  status: string;
  assignedTo: string | null;
  dueDate: string | null;
  projectId: string | null;
} {
  return {
    title: sanitizeTitle(data.title || 'Untitled'),
    content: sanitizeContent(data.content),
    extractedText: sanitizeContent(data.extractedText),
    imageUrl: sanitizeBase64Image(data.imageUrl),
    sourceUrl: sanitizeUrl(data.sourceUrl),
    tags: sanitizeTags(data.tags),
    metadata: sanitizeMetadata(data.metadata),
    priority: data.priority || 'none',
    status: data.status || 'inbox',
    assignedTo: sanitizeText(data.assignedTo, 200),
    dueDate: validateIsoDate(data.dueDate),
    projectId: data.projectId ? validateId(data.projectId) : null,
  };
}
