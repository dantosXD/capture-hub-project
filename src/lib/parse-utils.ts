/**
 * Safe JSON parsing utilities for database fields that may contain
 * JSON arrays, double-encoded JSON, or plain text values.
 */

/**
 * Safely parse a tags field from the database.
 * Handles: JSON arrays, double-encoded JSON, comma-separated strings, plain strings.
 */
export function safeParseTags(tags: string | null | undefined): string[] {
  if (!tags || tags === '[]') return [];
  try {
    let parsed = JSON.parse(tags);
    // Handle double-encoded JSON (e.g., '"[\"a\",\"b\"]"')
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    return Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    // Fall back to treating as comma-separated or single tag
    return tags.includes(',') ? tags.split(',').map(t => t.trim()).filter(Boolean) : [tags];
  }
}

/**
 * Safely parse a JSON field from the database.
 * Handles: valid JSON, double-encoded JSON, returns null on failure.
 */
export function safeParseJSON(str: string | null | undefined): any {
  if (!str) return null;
  try {
    let parsed = JSON.parse(str);
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        // It's just a regular string, return as-is
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Parse a capture item's tags and metadata fields safely.
 * Use this in API routes to transform database items for JSON responses.
 */
export function parseItemFields<T extends { tags: string; metadata: string | null }>(
  item: T
): T & { tags: string[]; metadata: any } {
  return {
    ...item,
    tags: safeParseTags(item.tags),
    metadata: safeParseJSON(item.metadata),
  };
}

/**
 * Escape special characters for SQL LIKE queries.
 * In SQLite LIKE: % matches any sequence, _ matches any single character, \ is the escape character.
 * This function escapes these special chars so they're treated as literals.
 *
 * Examples:
 * - "100% complete" → "100\% complete" (searches for literal %)
 * - "file_name.txt" → "file\_name.txt" (searches for literal _)
 * - "path\\file" → "path\\file" (backslashes are preserved)
 */
export function escapeSqlLikeChars(query: string): string {
  // Escape backslashes first, then % and _
  // Order matters: we need to escape \ before we can use it to escape other chars
  return query
    .replace(/\\/g, '\\\\')  // Escape backslashes: \ → \\
    .replace(/%/g, '\\%')    // Escape percent: % → \%
    .replace(/_/g, '\\_');   // Escape underscore: _ → \_
}

/**
 * Sanitize a search query for safe use in database queries.
 * 1. Truncates to max length (default 1000 chars) to prevent DoS
 * 2. Trims whitespace
 * 3. Returns null for empty/whitespace-only queries
 * 4. Escapes SQL LIKE special characters for literal searching
 */
export function sanitizeSearchQuery(query: string | null | undefined, maxLength = 1000): string | null {
  if (!query) return null;

  // Trim whitespace
  const trimmed = query.trim();

  // Return null for empty queries
  if (!trimmed) return null;

  // Truncate to max length to prevent potential performance issues
  const truncated = trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;

  // Escape SQL LIKE special characters for literal searching
  return escapeSqlLikeChars(truncated);
}
