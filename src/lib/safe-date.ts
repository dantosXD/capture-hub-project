import { formatDistanceToNow, format, isPast, isToday, isTomorrow } from 'date-fns';

/**
 * Safely parse a date value into a Date object.
 * Returns null if the value is not a valid date.
 *
 * Handles: ISO strings, Date objects, null, undefined, empty strings,
 * and the known Prisma "now()" literal bug.
 */
export function safeParseDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    if (!value || value === 'now()') return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Returns true if the value can be parsed into a valid Date.
 */
export function isValidDateValue(value: unknown): boolean {
  return safeParseDate(value) !== null;
}

/**
 * Format a date value as a relative time string (e.g. "2 hours ago").
 * Returns `fallback` if the value is not a valid date.
 */
export function safeFormatRelative(
  value: unknown,
  options?: { addSuffix?: boolean; fallback?: string },
): string {
  const { addSuffix = true, fallback = 'Unknown date' } = options ?? {};
  const date = safeParseDate(value);
  if (!date) return fallback;
  try {
    return formatDistanceToNow(date, { addSuffix });
  } catch {
    return fallback;
  }
}

/**
 * Format a date value using an absolute format string (e.g. 'PPP', 'PPpp', 'MMM d, yyyy').
 * Returns `fallback` if the value is not a valid date.
 */
export function safeFormatAbsolute(
  value: unknown,
  formatStr: string = 'PPP',
  fallback: string = 'Unknown date',
): string {
  const date = safeParseDate(value);
  if (!date) return fallback;
  try {
    return format(date, formatStr);
  } catch {
    return fallback;
  }
}

/**
 * Safely check if a date value is in the past.
 * Returns false for invalid dates.
 */
export function safeIsPast(value: unknown): boolean {
  const date = safeParseDate(value);
  if (!date) return false;
  return isPast(date);
}

/**
 * Safely check if a date value is today.
 * Returns false for invalid dates.
 */
export function safeIsToday(value: unknown): boolean {
  const date = safeParseDate(value);
  if (!date) return false;
  return isToday(date);
}

/**
 * Safely check if a date value is tomorrow.
 * Returns false for invalid dates.
 */
export function safeIsTomorrow(value: unknown): boolean {
  const date = safeParseDate(value);
  if (!date) return false;
  return isTomorrow(date);
}
