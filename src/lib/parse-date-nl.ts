import * as chrono from 'chrono-node';

/**
 * Parse a natural language date string into an ISO string.
 * Returns null if the string cannot be parsed.
 *
 * Examples:
 *   "tomorrow at 3pm"  → ISO string for tomorrow 15:00
 *   "next Monday"      → ISO string for next Monday 00:00
 *   "in 2 hours"       → ISO string for now + 2 hours
 *   "2024-01-15"       → ISO string for that date
 */
export function parseDateNL(input: string): string | null {
  if (!input.trim()) return null;

  // Try ISO date first (fast path, no library needed)
  const isoLike = new Date(input);
  if (!isNaN(isoLike.getTime()) && input.includes('-')) {
    return isoLike.toISOString();
  }

  const parsed = chrono.parseDate(input, new Date(), { forwardDate: true });
  if (!parsed) return null;

  return parsed.toISOString();
}

/**
 * Preview the natural language date as a human-readable string.
 * Returns null if unparseable.
 */
export function previewDateNL(input: string): string | null {
  if (!input.trim()) return null;
  const date = parseDateNL(input);
  if (!date) return null;
  return new Date(date).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
