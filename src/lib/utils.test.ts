/**
 * Tests for utility functions
 */

import { describe, it, expect, vi } from 'vitest';
import { cn } from './utils';

describe('Utility Functions', () => {
  describe('cn (className utility)', () => {
    it('should merge class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
    });

    it('should handle undefined and null values', () => {
      expect(cn('class1', undefined, null, 'class2')).toBe('class1 class2');
    });

    it('should handle conditional classes', () => {
      expect(cn('base', true && 'active', false && 'inactive')).toBe('base active');
    });

    it('should handle empty strings', () => {
      expect(cn('class1', '', 'class2')).toBe('class1 class2');
    });

    it('should handle conflicting Tailwind classes', () => {
      expect(cn('p-4', 'p-2')).toBe('p-2');
    });

    it('should handle no arguments', () => {
      expect(cn()).toBe('');
    });

    it('should handle arrays of classes', () => {
      expect(cn(['class1', 'class2'], 'class3')).toBe('class1 class2 class3');
    });

    it('should handle objects with boolean values', () => {
      expect(cn({ class1: true, class2: false, class3: true })).toBe('class1 class3');
    });
  });
});
