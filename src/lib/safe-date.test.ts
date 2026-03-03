import { describe, it, expect } from 'vitest';
import {
  safeParseDate,
  isValidDateValue,
  safeFormatRelative,
  safeFormatAbsolute,
  safeIsPast,
  safeIsToday,
  safeIsTomorrow,
} from './safe-date';

describe('safeParseDate', () => {
  it('parses valid ISO string', () => {
    const result = safeParseDate('2026-02-26T15:00:00.000Z');
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString()).toBe('2026-02-26T15:00:00.000Z');
  });

  it('parses Date object', () => {
    const d = new Date('2026-01-15T10:00:00Z');
    const result = safeParseDate(d);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(d.getTime());
  });

  it('returns null for "now()" literal', () => {
    expect(safeParseDate('now()')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(safeParseDate('')).toBeNull();
  });

  it('returns null for null', () => {
    expect(safeParseDate(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(safeParseDate(undefined)).toBeNull();
  });

  it('returns null for "invalid"', () => {
    expect(safeParseDate('invalid')).toBeNull();
  });

  it('returns null for number', () => {
    expect(safeParseDate(1708963200000)).toBeNull();
  });

  it('returns null for Invalid Date object', () => {
    expect(safeParseDate(new Date('not-a-date'))).toBeNull();
  });
});

describe('isValidDateValue', () => {
  it('returns true for valid ISO string', () => {
    expect(isValidDateValue('2026-02-26T15:00:00.000Z')).toBe(true);
  });

  it('returns false for "now()"', () => {
    expect(isValidDateValue('now()')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidDateValue(null)).toBe(false);
  });

  it('returns true for valid Date object', () => {
    expect(isValidDateValue(new Date())).toBe(true);
  });
});

describe('safeFormatRelative', () => {
  it('formats valid date as relative time', () => {
    const recent = new Date(Date.now() - 60_000).toISOString(); // 1 min ago
    const result = safeFormatRelative(recent);
    expect(result).toMatch(/ago/);
  });

  it('returns fallback for "now()" literal', () => {
    expect(safeFormatRelative('now()')).toBe('Unknown date');
  });

  it('returns fallback for null', () => {
    expect(safeFormatRelative(null)).toBe('Unknown date');
  });

  it('returns fallback for undefined', () => {
    expect(safeFormatRelative(undefined)).toBe('Unknown date');
  });

  it('returns fallback for empty string', () => {
    expect(safeFormatRelative('')).toBe('Unknown date');
  });

  it('returns fallback for "invalid"', () => {
    expect(safeFormatRelative('invalid')).toBe('Unknown date');
  });

  it('uses custom fallback', () => {
    expect(safeFormatRelative('now()', { fallback: 'recently' })).toBe('recently');
  });

  it('respects addSuffix: false', () => {
    const recent = new Date(Date.now() - 3_600_000).toISOString(); // 1 hour ago
    const result = safeFormatRelative(recent, { addSuffix: false });
    expect(result).not.toMatch(/ago/);
    expect(result).toMatch(/hour|minute/);
  });

  it('handles Date object input', () => {
    const result = safeFormatRelative(new Date(Date.now() - 120_000));
    expect(result).toMatch(/ago/);
  });
});

describe('safeFormatAbsolute', () => {
  it('formats valid date with default format', () => {
    const result = safeFormatAbsolute('2026-02-26T15:00:00.000Z');
    expect(result).toMatch(/Feb/);
    expect(result).toMatch(/2026/);
  });

  it('formats valid date with custom format', () => {
    const result = safeFormatAbsolute('2026-02-26T15:00:00.000Z', 'yyyy-MM-dd');
    expect(result).toBe('2026-02-26');
  });

  it('returns fallback for "now()"', () => {
    expect(safeFormatAbsolute('now()')).toBe('Unknown date');
  });

  it('returns fallback for null', () => {
    expect(safeFormatAbsolute(null)).toBe('Unknown date');
  });

  it('returns custom fallback', () => {
    expect(safeFormatAbsolute('invalid', 'PPP', 'N/A')).toBe('N/A');
  });

  it('handles Date object input', () => {
    const result = safeFormatAbsolute(new Date('2026-06-15T12:00:00Z'), 'MMM d, yyyy');
    expect(result).toBe('Jun 15, 2026');
  });
});

describe('safeIsPast', () => {
  it('returns true for past date', () => {
    expect(safeIsPast('2020-01-01T00:00:00Z')).toBe(true);
  });

  it('returns false for future date', () => {
    expect(safeIsPast('2099-01-01T00:00:00Z')).toBe(false);
  });

  it('returns false for "now()"', () => {
    expect(safeIsPast('now()')).toBe(false);
  });

  it('returns false for null', () => {
    expect(safeIsPast(null)).toBe(false);
  });
});

describe('safeIsToday', () => {
  it('returns true for today', () => {
    expect(safeIsToday(new Date())).toBe(true);
  });

  it('returns false for yesterday', () => {
    const yesterday = new Date(Date.now() - 86_400_000);
    expect(safeIsToday(yesterday)).toBe(false);
  });

  it('returns false for "now()"', () => {
    expect(safeIsToday('now()')).toBe(false);
  });
});

describe('safeIsTomorrow', () => {
  it('returns true for tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);
    expect(safeIsTomorrow(tomorrow)).toBe(true);
  });

  it('returns false for today', () => {
    expect(safeIsTomorrow(new Date())).toBe(false);
  });

  it('returns false for "now()"', () => {
    expect(safeIsTomorrow('now()')).toBe(false);
  });
});
