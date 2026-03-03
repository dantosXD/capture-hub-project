/**
 * Accessibility utilities for Capture Hub
 * Provides helper functions for ARIA attributes, focus management, and screen reader support
 */

/**
 * Generates ARIA label for a capture item
 */
export function getCaptureItemAriaLabel(item: {
  title: string;
  type: string;
  status: string;
  priority?: string;
  tags?: string[];
}): string {
  const parts = [
    item.title || 'Untitled item',
    item.type,
    item.status,
  ];

  if (item.priority && item.priority !== 'none') {
    parts.push(`priority: ${item.priority}`);
  }

  if (item.tags && item.tags.length > 0) {
    parts.push(`tags: ${item.tags.slice(0, 3).join(', ')}`);
    if (item.tags.length > 3) {
      parts.push(`and ${item.tags.length - 3} more`);
    }
  }

  return parts.join(' - ');
}

/**
 * Generates ARIA label for a project
 */
export function getProjectAriaLabel(project: {
  name: string;
  status: string;
  itemCount: number;
  priority?: string;
}): string {
  const parts = [
    project.name,
    project.status,
    `${project.itemCount} items`,
  ];

  if (project.priority && project.priority !== 'none') {
    parts.push(`priority: ${project.priority}`);
  }

  return parts.join(' - ');
}

/**
 * Generates ARIA label for a tag
 */
export function getTagAriaLabel(tag: { name: string; count: number }): string {
  return `Tag ${tag.name}, used in ${tag.count} item${tag.count !== 1 ? 's' : ''}`;
}

/**
 * Generates ARIA label for a template
 */
export function getTemplateAriaLabel(template: {
  name: string;
  category: string;
  description?: string | null;
}): string {
  const parts = [
    template.name,
    template.category,
  ];

  if (template.description) {
    parts.push(template.description);
  }

  return parts.join(' - ');
}

/**
 * Generates ARIA label for a filter button
 */
export function getFilterButtonAriaLabel(
  filterType: string,
  filterValue: string,
  count?: number
): string {
  let label = `Filter by ${filterType}: ${filterValue}`;
  if (count !== undefined) {
    label += ` (${count} items)`;
  }
  return label;
}

/**
 * Generates ARIA description for keyboard shortcuts
 */
export function getKeyboardShortcutDescription(keys: string[]): string {
  return `Keyboard shortcut: ${keys.join(' + ')}`;
}

/**
 * Converts keyboard event to ARIA key description
 */
export function getKeyDescription(event: KeyboardEvent): string {
  const parts: string[] = [];

  if (event.metaKey) parts.push('Command');
  if (event.ctrlKey) parts.push('Control');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');

  if (event.key === ' ') {
    parts.push('Space');
  } else if (event.key.length === 1) {
    parts.push(event.key.toUpperCase());
  } else {
    parts.push(event.key);
  }

  return parts.join(' + ');
}

/**
 * Generates ARIA live region message for toasts
 */
export function getToastAriaMessage(
  title: string,
  description?: string
): string {
  return description ? `${title}: ${description}` : title;
}

/**
 * Generates ARIA label for date inputs
 */
export function getDateInputAriaLabel(label: string, value?: string | null): string {
  if (value) {
    return `${label}: ${new Date(value).toLocaleDateString()}`;
  }
  return label;
}

/**
 * Generates ARIA label for due date with status
 */
export function getDueDateAriaLabel(dueDate: string, status?: 'overdue' | 'today' | 'tomorrow' | 'upcoming'): string {
  const date = new Date(dueDate);
  const formatted = date.toLocaleDateString();

  if (status === 'overdue') {
    return `Overdue: ${formatted}`;
  } else if (status === 'today') {
    return `Due today: ${formatted}`;
  } else if (status === 'tomorrow') {
    return `Due tomorrow: ${formatted}`;
  }
  return `Due date: ${formatted}`;
}

/**
 * Generates ARIA label for progress indicators
 */
export function getProgressAriaLabel(current: number, total: number, label?: string): string {
  const percentage = Math.round((current / total) * 100);
  let message = `${current} of ${total} (${percentage}%)`;

  if (label) {
    message = `${label}: ${message}`;
  }

  return message;
}

/**
 * Generates ARIA label for drag and drop
 */
export function getDragAriaLabel(itemLabel: string, isDragging?: boolean): string {
  if (isDragging) {
    return `Dragging ${itemLabel}. Press Escape to cancel.`;
  }
  return `Draggable item: ${itemLabel}. Press Space to start dragging.`;
}

/**
 * Generates ARIA label for sortable items
 */
export function getSortableAriaLabel(
  itemLabel: string,
  position: number,
  total: number
): string {
  return `${itemLabel}, position ${position} of ${total}. Use Up and Down arrow keys to reorder.`;
}

/**
 * Generates ARIA label for modal dialogs
 */
export function getModalAriaLabel(title: string, itemCount?: number): string {
  let label = title;

  if (itemCount !== undefined) {
    label += ` (${itemCount} item${itemCount !== 1 ? 's' : ''})`;
  }

  return label;
}

/**
 * Generates ARIA label for select dropdowns
 */
export function getSelectAriaLabel(label: string, value?: string, placeholder?: string): string {
  if (value) {
    return `${label}: ${value}`;
  }
  return placeholder ? `${label}, ${placeholder}` : label;
}

/**
 * Generates ARIA label for checkboxes
 */
export function getCheckboxAriaLabel(label: string, checked: boolean, indeterminate?: boolean): string {
  const state = indeterminate ? 'indeterminate' : (checked ? 'checked' : 'unchecked');
  return `${label}, ${state}`;
}

/**
 * Generates ARIA label for loading states
 */
export function getLoadingAriaLabel(context: string): string {
  return `Loading ${context}...`;
}

/**
 * Generates ARIA label for empty states
 */
export function getEmptyStateAriaLabel(context: string, action?: string): string {
  let label = `No ${context}`;

  if (action) {
    label += `. ${action}`;
  }

  return label;
}

/**
 * Generates ARIA current page indicator
 */
export function getAriaCurrent(value: 'page' | 'step' | 'location' | 'date' | 'time' | boolean | undefined): { 'aria-current': string | undefined } {
  if (value === true || value === 'page') {
    return { 'aria-current': 'page' };
  }
  if (value === 'step') {
    return { 'aria-current': 'step' };
  }
  if (value === 'location') {
    return { 'aria-current': 'location' };
  }
  if (value === 'date') {
    return { 'aria-current': 'date' };
  }
  if (value === 'time') {
    return { 'aria-current': 'time' };
  }
  return { 'aria-current': undefined };
}

/**
 * Generates ARIA live region attributes
 */
export function getAriaLive(politeness: 'off' | 'polite' | 'assertive' = 'polite') {
  return {
    'aria-live': politeness,
  };
}

/**
 * Generates ARIA atomic region (announce entire region on change)
 */
export function getAriaAtomic(atomic: boolean = true) {
  return {
    'aria-atomic': atomic.toString() as 'true' | 'false',
  };
}

/**
 * Generates ARIA relevant changes (what to announce)
 */
export function getAriaRelevant(...additions: ('additions' | 'removals' | 'text')[]) {
  return {
    'aria-relevant': additions.join(' '),
  };
}

/**
 * Generates ARIA busy state (element is being updated)
 */
export function getAriaBusy(busy: boolean = true) {
  return {
    'aria-busy': busy.toString() as 'true' | 'false',
  };
}

/**
 * Generates ARIA controls relationship
 */
export function getAriaControls(id: string | string[]) {
  return {
    'aria-controls': Array.isArray(id) ? id.join(' ') : id,
  };
}

/**
 * Generates ARIA described by relationship
 */
export function getAriaDescribedBy(id: string | string[]) {
  return {
    'aria-describedby': Array.isArray(id) ? id.join(' ') : id,
  };
}

/**
 * Generates ARIA labelled by relationship
 */
export function getAriaLabelledBy(id: string | string[]) {
  return {
    'aria-labelledby': Array.isArray(id) ? id.join(' ') : id,
  };
}

/**
 * Generates ARIA has popup relationship
 */
export function getAriaHasPopup(
  value: 'false' | 'true' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog' = 'false'
) {
  return {
    'aria-haspopup': value,
  };
}

/**
 * Generates ARIA expanded state
 */
export function getAriaExpanded(expanded: boolean) {
  return {
    'aria-expanded': expanded.toString() as 'true' | 'false',
  };
}

/**
 * Generates ARIA pressed state
 */
export function getAriaPressed(pressed: boolean | 'mixed') {
  return {
    'aria-pressed': pressed.toString() as 'true' | 'false' | 'mixed',
  };
}

/**
 * Generates ARIA checked state
 */
export function getAriaChecked(checked: boolean | 'mixed') {
  return {
    'aria-checked': checked.toString() as 'true' | 'false' | 'mixed',
  };
}

/**
 * Generates ARIA disabled state
 */
export function getAriaDisabled(disabled: boolean) {
  return {
    'aria-disabled': disabled.toString() as 'true' | 'false',
  };
}

/**
 * Generates ARIA selected state
 */
export function getAriaSelected(selected: boolean) {
  return {
    'aria-selected': selected.toString() as 'true' | 'false',
  };
}

/**
 * Generates ARIA required indicator
 */
export function getAriaRequired(required: boolean) {
  return {
    'aria-required': required.toString() as 'true' | 'false',
  };
}

/**
 * Generates ARIA invalid state
 */
export function getAriaInvalid(invalid: boolean) {
  return {
    'aria-invalid': invalid.toString() as 'true' | 'false',
  };
}

/**
 * Generates ARIA hidden attribute
 */
export function getAriaHidden(hidden: boolean) {
  return {
    'aria-hidden': hidden.toString() as 'true' | 'false',
  };
}

/**
 * Generates ARIA orientation
 */
export function getAriaOrientation(orientation: 'horizontal' | 'vertical') {
  return {
    'aria-orientation': orientation,
  };
}
