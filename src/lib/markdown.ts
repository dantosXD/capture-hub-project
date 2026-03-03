/**
 * Strip markdown formatting from text for plain text display
 * Handles common markdown patterns: headers, bold, italic, links, code, lists
 */
export function stripMarkdown(text: string): string {
  if (!text) return '';

  return text
    // Remove headers (# ## ### etc)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic (**, __, *, _)
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    // Remove strikethrough
    .replace(/~~(.*?)~~/g, '$1')
    // Remove inline code and code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`(.*?)`/g, '$1')
    // Remove links but keep text [text](url) -> text
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    // Remove images ![alt](url) -> alt
    .replace(/!\[(.*?)\]\(.*?\)/g, '$1')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get a type-specific description for items with no content
 */
export function getTypeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    note: 'Quick note',
    scratchpad: 'Scratchpad entry',
    ocr: 'OCR text extraction',
    screenshot: 'Screenshot capture',
    webpage: 'Web page capture',
  };

  return descriptions[type] || 'No content';
}
