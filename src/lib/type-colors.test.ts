/**
 * Tests for type colors utilities
 */

import { describe, it, expect } from 'vitest';
import { typeBgColors, typeTextColors, typeHexColors, typeBadgeColors } from './type-colors';

describe('Type Colors Utilities', () => {
  describe('typeBgColors', () => {
    it('should return correct color for note type', () => {
      expect(typeBgColors['note']).toBe('bg-indigo-500');
    });

    it('should return correct color for screenshot type', () => {
      expect(typeBgColors['screenshot']).toBe('bg-amber-500');
    });

    it('should return correct color for webpage type', () => {
      expect(typeBgColors['webpage']).toBe('bg-indigo-600');
    });

    it('should return correct color for ocr type', () => {
      expect(typeBgColors['ocr']).toBe('bg-violet-500');
    });

    it('should return correct color for scratchpad type', () => {
      expect(typeBgColors['scratchpad']).toBe('bg-purple-500');
    });
  });

  describe('typeTextColors', () => {
    it('should return correct color for note type', () => {
      expect(typeTextColors['note']).toBe('text-indigo-500');
    });

    it('should return correct color for screenshot type', () => {
      expect(typeTextColors['screenshot']).toBe('text-amber-500');
    });

    it('should return correct color for webpage type', () => {
      expect(typeTextColors['webpage']).toBe('text-indigo-600');
    });

    it('should return correct color for ocr type', () => {
      expect(typeTextColors['ocr']).toBe('text-violet-500');
    });

    it('should return correct color for scratchpad type', () => {
      expect(typeTextColors['scratchpad']).toBe('text-purple-500');
    });
  });

  describe('typeHexColors', () => {
    it('should return correct hex color for note type', () => {
      expect(typeHexColors['note']).toBe('#6366f1');
    });

    it('should return correct hex color for screenshot type', () => {
      expect(typeHexColors['screenshot']).toBe('#f59e0b');
    });

    it('should return correct hex color for webpage type', () => {
      expect(typeHexColors['webpage']).toBe('#4f46e5');
    });

    it('should return correct hex color for ocr type', () => {
      expect(typeHexColors['ocr']).toBe('#8b5cf6');
    });

    it('should return correct hex color for scratchpad type', () => {
      expect(typeHexColors['scratchpad']).toBe('#a855f7');
    });

    it('should return valid hex colors', () => {
      Object.values(typeHexColors).forEach(color => {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });
  });

  describe('typeBadgeColors', () => {
    it('should return correct badge color for note type', () => {
      expect(typeBadgeColors['note']).toContain('bg-indigo-500');
      expect(typeBadgeColors['note']).toContain('text-indigo-700');
    });

    it('should return correct badge color for screenshot type', () => {
      expect(typeBadgeColors['screenshot']).toContain('bg-amber-500');
      expect(typeBadgeColors['screenshot']).toContain('text-amber-700');
    });

    it('should return correct badge color for webpage type', () => {
      expect(typeBadgeColors['webpage']).toContain('bg-indigo-600');
      expect(typeBadgeColors['webpage']).toContain('text-indigo-700');
    });

    it('should return correct badge color for ocr type', () => {
      expect(typeBadgeColors['ocr']).toContain('bg-violet-500');
      expect(typeBadgeColors['ocr']).toContain('text-violet-700');
    });

    it('should return correct badge color for scratchpad type', () => {
      expect(typeBadgeColors['scratchpad']).toContain('bg-purple-500');
      expect(typeBadgeColors['scratchpad']).toContain('text-purple-700');
    });
  });
});
