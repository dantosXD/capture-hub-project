/**
 * Test data fixtures
 *
 * Pre-defined test data for consistent testing
 */

import { PrismaClient } from '@prisma/client';

export interface TestFixtures {
  captureItems: any[];
  projects: any[];
  templates: any[];
  links: any[];
}

async function deleteLinksForTestItems(prisma: PrismaClient): Promise<void> {
  const testItemIds = (
    await prisma.captureItem.findMany({
      where: { title: { contains: 'Test' } },
      select: { id: true },
    })
  ).map((item) => item.id);

  if (testItemIds.length === 0) {
    return;
  }

  await prisma.itemLink.deleteMany({
    where: {
      OR: [
        { sourceId: { in: testItemIds } },
        { targetId: { in: testItemIds } },
      ],
    },
  });
}

/**
 * Generate test capture items
 */
export function generateTestCaptureItems(count: number = 10) {
  const types = ['note', 'screenshot', 'webpage', 'ocr', 'scratchpad'] as const;
  const priorities = ['none', 'low', 'medium', 'high'] as const;
  const statuses = ['inbox', 'assigned', 'archived', 'trash'] as const;

  return Array.from({ length: count }, (_, i) => ({
    type: types[i % types.length],
    title: `Test ${types[i % types.length]} ${i + 1}`,
    content: `Test content for ${types[i % types.length]} ${i + 1}`.repeat(5),
    tags: JSON.stringify([`tag${i % 5}`, `test`, `fixture`]),
    priority: priorities[i % priorities.length],
    status: statuses[i % statuses.length],
    pinned: i % 3 === 0,
    dueDate: i % 4 === 0 ? new Date(Date.now() + i * 86400000).toISOString() : null,
    reminder: i % 5 === 0 ? new Date(Date.now() + i * 3600000).toISOString() : null,
    assignedTo: i % 2 === 0 ? `category${i % 3}` : null,
    metadata: JSON.stringify({ test: true, fixtureIndex: i }),
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - i * 86400000).toISOString(),
  }));
}

/**
 * Generate test projects
 */
export function generateTestProjects(count: number = 5) {
  const colors = ['#6366f1', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444'];
  const statuses = ['active', 'on-hold', 'completed', 'archived'] as const;
  const priorities = ['low', 'medium', 'high'] as const;

  return Array.from({ length: count }, (_, i) => ({
    name: `Test Project ${i + 1}`,
    description: `Description for test project ${i + 1}`,
    color: colors[i % colors.length],
    status: statuses[i % statuses.length],
    priority: priorities[i % priorities.length],
    dueDate: i % 3 === 0 ? new Date(Date.now() + (i + 1) * 86400000 * 7).toISOString() : null,
    order: i,
    metadata: JSON.stringify({ test: true, fixtureIndex: i }),
    createdAt: new Date(Date.now() - i * 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - i * 86400000 * 2).toISOString(),
  }));
}

/**
 * Generate test templates
 */
export function generateTestTemplates(count: number = 6) {
  const templates = [
    {
      name: 'Test Meeting Notes',
      description: 'Template for meeting notes',
      content: '# Meeting Notes\n\n## Date: {{date}}\n## Attendees: {{attendees}}\n\n## Agenda\n{{agenda}}\n\n## Notes\n{{notes}}\n\n## Action Items\n{{actions}}',
      category: 'meeting',
    },
    {
      name: 'Test Quick Task',
      description: 'Template for quick task notes',
      content: '# Task: {{taskName}}\n\n**Priority:** {{priority}}\n**Due:** {{dueDate}}\n\n## Description\n{{description}}\n\n## Subtasks\n{{subtasks}}',
      category: 'task',
    },
    {
      name: 'Test Reading Notes',
      description: 'Template for reading notes',
      content: '# {{title}}\n\n**Author:** {{author}}\n**Date:** {{date}}\n\n## Summary\n{{summary}}\n\n## Key Points\n{{keyPoints}}\n\n## Quotes\n{{quotes}}\n\n## Thoughts\n{{thoughts}}',
      category: 'note',
    },
    {
      name: 'Test Weekly Review',
      description: 'Template for weekly GTD review',
      content: '# Weekly Review - {{week}}\n\n## Completed\n{{completed}}\n\n## In Progress\n{{inProgress}}\n\n## Backlog\n{{backlog}}\n\n## Next Week\n{{nextWeek}}',
      category: 'review',
    },
    {
      name: 'Test Project Planning',
      description: 'Template for project planning',
      content: '# Project: {{projectName}}\n\n## Overview\n{{overview}}\n\n## Goals\n{{goals}}\n\n## Milestones\n{{milestones}}\n\n## Resources\n{{resources}}',
      category: 'project',
    },
    {
      name: 'Test General Notes',
      description: 'General purpose note template',
      content: '# {{title}}\n\n{{content}}\n\n## Tags\n{{tags}}',
      category: 'general',
    },
  ];

  return Array.from({ length: Math.min(count, templates.length) }, (_, i) => ({
    ...templates[i],
    variables: JSON.stringify([
      { name: templates[i].content.match(/\{\{(\w+)\}\}/g)?.[0]?.replace(/\{|\}/g, '') || 'variable1', type: 'text' },
    ]),
    isDefault: i < 4, // First 4 are default templates
    createdAt: new Date(Date.now() - i * 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - i * 86400000 * 3).toISOString(),
  }));
}

/**
 * Load test fixtures into database
 */
export async function loadTestFixtures(prisma: PrismaClient): Promise<TestFixtures> {
  // Clean existing test data
  await deleteLinksForTestItems(prisma);
  await prisma.captureItem.deleteMany({
    where: { title: { contains: 'Test' } },
  });
  await prisma.template.deleteMany({
    where: { name: { contains: 'Test' } },
  });
  await prisma.project.deleteMany({
    where: { name: { contains: 'Test' } },
  });

  // Create capture items
  const captureItems = await Promise.all(
    generateTestCaptureItems(10).map((item) =>
      prisma.captureItem.create({ data: item })
    )
  );

  // Create projects
  const projects = await Promise.all(
    generateTestProjects(5).map((project) =>
      prisma.project.create({ data: project })
    )
  );

  // Create templates
  const templates = await Promise.all(
    generateTestTemplates(6).map((template) =>
      prisma.template.create({ data: template })
    )
  );

  // Create some links between items
  const links: any[] = [];
  if (captureItems.length >= 2) {
    const link1 = await prisma.itemLink.create({
      data: {
        sourceId: captureItems[0].id,
        targetId: captureItems[1].id,
        relationType: 'related',
      },
    });
    links.push(link1);

    if (captureItems.length >= 3) {
      const link2 = await prisma.itemLink.create({
        data: {
          sourceId: captureItems[0].id,
          targetId: captureItems[2].id,
          relationType: 'depends-on',
        },
      });
      links.push(link2);
    }
  }

  return {
    captureItems,
    projects,
    templates,
    links,
  };
}

/**
 * Clean test fixtures from database
 */
export async function cleanTestFixtures(prisma: PrismaClient): Promise<void> {
  await deleteLinksForTestItems(prisma);
  await prisma.captureItem.deleteMany({
    where: { title: { contains: 'Test' } },
  });
  await prisma.template.deleteMany({
    where: { name: { contains: 'Test' } },
  });
  await prisma.project.deleteMany({
    where: { name: { contains: 'Test' } },
  });
}

/**
 * Specific test data for edge cases
 */
export const edgeCaseFixtures = {
  // Very long content
  longContent: {
    title: 'Long Content Test',
    content: 'A'.repeat(10000),
    type: 'note',
  },

  // Special characters
  specialChars: {
    title: 'Test with special chars: <>&"\'\\',
    content: 'Content with emojis: 🎉 🔥 💯\nAnd unicode: café, naïve, 日本語',
    type: 'note',
  },

  // Empty fields
  emptyFields: {
    title: '',
    content: '',
    tags: '[]',
    type: 'note',
  },

  // Maximum tags
  maxTags: {
    title: 'Max Tags Test',
    content: 'Testing with maximum tags',
    tags: JSON.stringify(Array.from({ length: 20 }, (_, i) => `tag${i}`)),
    type: 'note',
  },

  // All statuses
  allStatuses: ['inbox', 'assigned', 'archived', 'trash'].map((status) => ({
    title: `Test ${status} item`,
    content: `Content for ${status} item`,
    status,
    type: 'note',
  })),

  // All priorities
  allPriorities: ['none', 'low', 'medium', 'high'].map((priority) => ({
    title: `Test ${priority} priority`,
    content: `Content for ${priority} priority`,
    priority,
    type: 'note',
  })),

  // All types
  allTypes: ['note', 'screenshot', 'webpage', 'ocr', 'scratchpad'].map((type) => ({
    title: `Test ${type}`,
    content: `Content for ${type}`,
    type,
  })),
};

/**
 * Performance test data
 */
export function generatePerformanceTestData(count: number = 100) {
  return generateTestCaptureItems(count);
}

/**
 * Search test data
 */
export const searchDataFixtures = {
  // Items for search testing
  items: [
    { title: 'JavaScript Tutorial', content: 'Learn JS basics', tags: '["javascript", "tutorial"]' },
    { title: 'Python Guide', content: 'Python programming guide', tags: '["python", "guide"]' },
    { title: 'React Notes', content: 'React component patterns', tags: '["react", "frontend"]' },
    { title: 'Database Design', content: 'SQL and NoSQL patterns', tags: '["database", "sql"]' },
    { title: 'API Development', content: 'RESTful API best practices', tags: '["api", "backend"]' },
    { title: 'DevOps Basics', content: 'CI/CD and deployment', tags: '["devops", "deployment"]' },
    { title: 'TypeScript Tips', content: 'Advanced TypeScript patterns', tags: '["typescript", "frontend"]' },
    { title: 'Testing Strategies', content: 'Unit and integration testing', tags: '["testing", "quality"]' },
  ],
};

/**
 * Pagination test data
 */
export function generatePaginationTestData(pageSize: number = 20, totalPages: number = 5) {
  return generateTestCaptureItems(pageSize * totalPages);
}
