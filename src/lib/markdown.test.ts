/**
 * Tests for markdown utilities
 */

import { describe, it, expect } from 'vitest';
import { stripMarkdown, getTypeDescription } from './markdown';

describe('Markdown Utilities', () => {
  describe('stripMarkdown', () => {
    it('should remove markdown headers', () => {
      expect(stripMarkdown('# Header')).toBe('Header');
      expect(stripMarkdown('## Subheader')).toBe('Subheader');
      expect(stripMarkdown('### Subsubheader')).toBe('Subsubheader');
    });

    it('should remove markdown emphasis', () => {
      expect(stripMarkdown('*italic*')).toBe('italic');
      expect(stripMarkdown('_italic_')).toBe('italic');
      expect(stripMarkdown('**bold**')).toBe('bold');
      expect(stripMarkdown('__bold__')).toBe('bold');
    });

    it('should remove markdown links', () => {
      expect(stripMarkdown('[link](https://example.com)')).toBe('link');
    });

    it('should remove markdown images', () => {
      expect(stripMarkdown('![alt](https://example.com/image.png)')).toBe('!alt');
    });

    it('should remove markdown code blocks', () => {
      expect(stripMarkdown('`code`')).toBe('code');
      expect(stripMarkdown('```code block```')).toBe('');
    });

    it('should remove markdown lists', () => {
      expect(stripMarkdown('- item 1\n- item 2')).toContain('item 1');
      expect(stripMarkdown('1. item 1\n2. item 2')).toContain('item 1');
    });

    it('should handle plain text', () => {
      expect(stripMarkdown('Plain text')).toBe('Plain text');
    });

    it('should handle mixed markdown', () => {
      const markdown = '# Title\n\nThis is **bold** and *italic* text.';
      const result = stripMarkdown(markdown);
      expect(result).toContain('Title');
      expect(result).toContain('bold');
      expect(result).toContain('italic');
      expect(result).not.toContain('#');
      expect(result).not.toContain('**');
      expect(result).not.toContain('*');
    });
  });

  describe('getTypeDescription', () => {
    it('should return description for note type', () => {
      expect(getTypeDescription('note')).toBe('Quick note');
    });

    it('should return description for scratchpad type', () => {
      expect(getTypeDescription('scratchpad')).toBe('Scratchpad entry');
    });

    it('should return description for ocr type', () => {
      expect(getTypeDescription('ocr')).toBe('OCR text extraction');
    });

    it('should return description for screenshot type', () => {
      expect(getTypeDescription('screenshot')).toBe('Screenshot capture');
    });

    it('should return description for webpage type', () => {
      expect(getTypeDescription('webpage')).toBe('Web page capture');
    });

    it('should return default description for unknown type', () => {
      expect(getTypeDescription('unknown')).toBe('No content');
    });
  });
});
