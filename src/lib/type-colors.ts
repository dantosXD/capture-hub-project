/**
 * Centralized color definitions for capture item types.
 * Used across all components for consistent visual differentiation.
 *
 * Color assignments (Indigo/Purple/Amber palette):
 *   Note:       indigo (primary)
 *   Scratchpad: purple (secondary)
 *   OCR:        violet (purple variant)
 *   Screenshot: amber (accent)
 *   Webpage:    indigo (primary variant)
 */

/** Background colors for type icon containers (e.g., bg-indigo-500) */
export const typeBgColors: Record<string, string> = {
  note: 'bg-indigo-500',
  scratchpad: 'bg-purple-500',
  ocr: 'bg-violet-500',
  screenshot: 'bg-amber-500',
  webpage: 'bg-indigo-600',
};

/** Text colors for inline type indicators (e.g., text-indigo-500) */
export const typeTextColors: Record<string, string> = {
  note: 'text-indigo-500',
  scratchpad: 'text-purple-500',
  ocr: 'text-violet-500',
  screenshot: 'text-amber-500',
  webpage: 'text-indigo-600',
};

/** Hex colors for canvas/SVG rendering (e.g., knowledge graph) */
export const typeHexColors: Record<string, string> = {
  note: '#6366f1',       // indigo-500
  scratchpad: '#a855f7', // purple-500
  ocr: '#8b5cf6',        // violet-500
  screenshot: '#f59e0b', // amber-500
  webpage: '#4f46e5',    // indigo-600
};

/** Badge colors with background opacity for light/dark mode */
export const typeBadgeColors: Record<string, string> = {
  note: 'bg-indigo-500/20 text-indigo-700 dark:bg-indigo-600/30 dark:text-indigo-300',
  scratchpad: 'bg-purple-500/20 text-purple-700 dark:bg-purple-600/30 dark:text-purple-300',
  ocr: 'bg-violet-500/20 text-violet-700 dark:bg-violet-600/30 dark:text-violet-300',
  screenshot: 'bg-amber-500/20 text-amber-700 dark:bg-amber-600/30 dark:text-amber-300',
  webpage: 'bg-indigo-600/20 text-indigo-700 dark:bg-indigo-700/30 dark:text-indigo-300',
};
