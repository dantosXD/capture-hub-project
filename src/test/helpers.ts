/**
 * Test helpers and utilities
 */

import { render } from '@testing-library/react';
import { ReactElement } from 'react';

// Custom render function that wraps with necessary providers
export function renderWithProviders(ui: ReactElement) {
  return render(ui);
}

// Mock capture item data
export const mockCaptureItem = {
  id: 'test-capture-id-1',
  type: 'note' as const,
  title: 'Test Note',
  content: 'This is a test note content',
  tags: ['test', 'note'],
  priority: 'none' as const,
  status: 'inbox' as const,
  pinned: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Mock project data
export const mockProject = {
  id: 'test-project-id-1',
  name: 'Test Project',
  description: 'This is a test project',
  color: '#6366f1',
  status: 'active' as const,
  priority: 'medium' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Mock template data
export const mockTemplate = {
  id: 'test-template-id-1',
  name: 'Meeting Notes',
  description: 'Template for meeting notes',
  content: '# Meeting Notes\n\n## Attendees\n{{attendees}}\n\n## Agenda\n{{agenda}}\n\n## Notes\n{{notes}}',
  category: 'meeting' as const,
  isDefault: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Create mock WebSocket
export const createMockWebSocket = () => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1, // OPEN
  onopen: null,
  onmessage: null,
  onerror: null,
  onclose: null,
});

// Wait for async operations
export const waitFor = (ms: number = 0) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Mock fetch response
export const createMockResponse = (data: any, status: number = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data),
  blob: async () => new Blob([JSON.stringify(data)]),
  headers: new Headers({
    'content-type': 'application/json',
  }),
});

// Mock fetch error
export const createMockError = (message: string, status: number = 500) => ({
  ok: false,
  status,
  json: async () => ({ error: message }),
  text: async () => JSON.stringify({ error: message }),
});

// Generate test capture items
export const generateTestCaptures = (count: number = 5) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `test-capture-${i + 1}`,
    type: ['note', 'screenshot', 'webpage', 'ocr'][i % 4] as any,
    title: `Test Item ${i + 1}`,
    content: `Test content for item ${i + 1}`,
    tags: [`tag${i % 3}`, `test`],
    priority: ['none', 'low', 'medium', 'high'][i % 4] as any,
    status: 'inbox' as const,
    pinned: i % 2 === 0,
    createdAt: new Date(Date.now() - i * 1000 * 60 * 60).toISOString(),
    updatedAt: new Date(Date.now() - i * 1000 * 60 * 60).toISOString(),
  }));
};

// Generate test projects
export const generateTestProjects = (count: number = 3) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `test-project-${i + 1}`,
    name: `Test Project ${i + 1}`,
    description: `Description for project ${i + 1}`,
    color: ['#6366f1', '#8b5cf6', '#f59e0b'][i % 3],
    status: 'active' as const,
    priority: ['low', 'medium', 'high'][i % 3] as any,
    createdAt: new Date(Date.now() - i * 1000 * 60 * 60).toISOString(),
    updatedAt: new Date(Date.now() - i * 1000 * 60 * 60).toISOString(),
  }));
};

// Generate test templates
export const generateTestTemplates = (count: number = 4) => {
  const categories = ['general', 'meeting', 'task', 'note'] as const;
  return Array.from({ length: count }, (_, i) => ({
    id: `test-template-${i + 1}`,
    name: `Template ${i + 1}`,
    description: `Description for template ${i + 1}`,
    content: `# Template ${i + 1}\n\n{{variable${i}}}`,
    category: categories[i % 4],
    isDefault: i < 4,
    createdAt: new Date(Date.now() - i * 1000 * 60 * 60).toISOString(),
    updatedAt: new Date(Date.now() - i * 1000 * 60 * 60).toISOString(),
  }));
};
