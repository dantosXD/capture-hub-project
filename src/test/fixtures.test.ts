/**
 * Tests for test data fixtures
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  generateTestCaptureItems,
  generateTestProjects,
  generateTestTemplates,
  loadTestFixtures,
  cleanTestFixtures,
  edgeCaseFixtures,
  generatePerformanceTestData,
  searchDataFixtures,
  generatePaginationTestData,
} from './fixtures';

describe('Test Data Fixtures', () => {
  let prisma: PrismaClient;

  beforeEach(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterEach(async () => {
    await cleanTestFixtures(prisma);
    await prisma.$disconnect();
  });

  describe('generateTestCaptureItems', () => {
    it('should generate specified number of items', () => {
      const items = generateTestCaptureItems(10);
      expect(items).toHaveLength(10);
    });

    it('should include all capture types', () => {
      const items = generateTestCaptureItems(10);
      const types = new Set(items.map((i) => i.type));
      expect(types).toContain('note');
      expect(types).toContain('screenshot');
      expect(types).toContain('webpage');
    });

    it('should include all priorities', () => {
      const items = generateTestCaptureItems(10);
      const priorities = new Set(items.map((i) => i.priority));
      expect(priorities).toContain('none');
      expect(priorities).toContain('low');
      expect(priorities).toContain('medium');
      expect(priorities).toContain('high');
    });

    it('should include all statuses', () => {
      const items = generateTestCaptureItems(10);
      const statuses = new Set(items.map((i) => i.status));
      expect(statuses).toContain('inbox');
      expect(statuses).toContain('assigned');
      expect(statuses).toContain('archived');
      expect(statuses).toContain('trash');
    });

    it('should have valid dates', () => {
      const items = generateTestCaptureItems(5);
      items.forEach((item) => {
        expect(new Date(item.createdAt)).toBeInstanceOf(Date);
        expect(new Date(item.updatedAt)).toBeInstanceOf(Date);
      });
    });
  });

  describe('generateTestProjects', () => {
    it('should generate specified number of projects', () => {
      const projects = generateTestProjects(5);
      expect(projects).toHaveLength(5);
    });

    it('should have valid color values', () => {
      const projects = generateTestProjects(5);
      projects.forEach((project) => {
        expect(project.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });

    it('should include all statuses', () => {
      const projects = generateTestProjects(10);
      const statuses = new Set(projects.map((p) => p.status));
      expect(statuses).toContain('active');
      expect(statuses).toContain('on-hold');
      expect(statuses).toContain('completed');
      expect(statuses).toContain('archived');
    });
  });

  describe('generateTestTemplates', () => {
    it('should generate default templates', () => {
      const templates = generateTestTemplates(6);
      expect(templates.length).toBeGreaterThanOrEqual(4);

      const defaultTemplates = templates.filter((t) => t.isDefault);
      expect(defaultTemplates.length).toBe(4);
    });

    it('should include meeting template', () => {
      const templates = generateTestTemplates(6);
      const meetingTemplate = templates.find((t) => t.category === 'meeting');
      expect(meetingTemplate).toBeDefined();
      expect(meetingTemplate?.content).toContain('{{');
    });

    it('should have valid categories', () => {
      const templates = generateTestTemplates(6);
      const categories = new Set(templates.map((t) => t.category));
      expect(categories).toContain('meeting');
      expect(categories).toContain('task');
      expect(categories).toContain('note');
    });
  });

  describe('loadTestFixtures', () => {
    it('should load all fixtures into database', async () => {
      const fixtures = await loadTestFixtures(prisma);

      expect(fixtures.captureItems.length).toBe(10);
      expect(fixtures.projects.length).toBe(5);
      expect(fixtures.templates.length).toBe(6);
      expect(fixtures.links.length).toBeGreaterThanOrEqual(1);
    });

    it('should create items in database', async () => {
      await loadTestFixtures(prisma);

      const items = await prisma.captureItem.findMany({
        where: { title: { contains: 'Test' } },
      });
      expect(items.length).toBe(10);
    });

    it('should create projects in database', async () => {
      await loadTestFixtures(prisma);

      const projects = await prisma.project.findMany({
        where: { name: { contains: 'Test' } },
      });
      expect(projects.length).toBe(5);
    });

    it('should create links in database', async () => {
      const fixtures = await loadTestFixtures(prisma);

      const links = await prisma.itemLink.findMany({
        where: { id: { in: fixtures.links.map((l) => l.id) } },
      });
      expect(links.length).toBe(fixtures.links.length);
    });
  });

  describe('cleanTestFixtures', () => {
    it('should remove all test fixtures from database', async () => {
      await loadTestFixtures(prisma);

      // Verify fixtures exist
      let items = await prisma.captureItem.findMany({
        where: { title: { contains: 'Test' } },
      });
      expect(items.length).toBeGreaterThan(0);

      // Clean fixtures
      await cleanTestFixtures(prisma);

      // Verify fixtures removed
      items = await prisma.captureItem.findMany({
        where: { title: { contains: 'Test' } },
      });
      expect(items.length).toBe(0);
    });
  });

  describe('edgeCaseFixtures', () => {
    it('should have long content fixture', () => {
      expect(edgeCaseFixtures.longContent.content.length).toBe(10000);
    });

    it('should have special characters fixture', () => {
      expect(edgeCaseFixtures.specialChars.title).toContain('<>&"');
      expect(edgeCaseFixtures.specialChars.content).toContain('🎉');
    });

    it('should have empty fields fixture', () => {
      expect(edgeCaseFixtures.emptyFields.title).toBe('');
      expect(edgeCaseFixtures.emptyFields.content).toBe('');
    });

    it('should have max tags fixture', () => {
      const tags = JSON.parse(edgeCaseFixtures.maxTags.tags);
      expect(tags.length).toBe(20);
    });

    it('should have all statuses fixture', () => {
      expect(edgeCaseFixtures.allStatuses).toHaveLength(4);
      expect(edgeCaseFixtures.allStatuses.map((s) => s.status)).toContain('inbox');
      expect(edgeCaseFixtures.allStatuses.map((s) => s.status)).toContain('trash');
    });

    it('should have all priorities fixture', () => {
      expect(edgeCaseFixtures.allPriorities).toHaveLength(4);
      expect(edgeCaseFixtures.allPriorities.map((p) => p.priority)).toContain('low');
      expect(edgeCaseFixtures.allPriorities.map((p) => p.priority)).toContain('high');
    });

    it('should have all types fixture', () => {
      expect(edgeCaseFixtures.allTypes).toHaveLength(5);
      expect(edgeCaseFixtures.allTypes.map((t) => t.type)).toContain('note');
      expect(edgeCaseFixtures.allTypes.map((t) => t.type)).toContain('webpage');
    });
  });

  describe('generatePerformanceTestData', () => {
    it('should generate specified number of items', () => {
      const items = generatePerformanceTestData(100);
      expect(items).toHaveLength(100);
    });

    it('should generate valid test data', () => {
      const items = generatePerformanceTestData(50);
      items.forEach((item) => {
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('content');
        expect(item).toHaveProperty('tags');
      });
    });
  });

  describe('searchDataFixtures', () => {
    it('should have search test items', () => {
      expect(searchDataFixtures.items.length).toBeGreaterThan(0);
      expect(searchDataFixtures.items).toHaveLength(8);
    });

    it('should have items with searchable content', () => {
      searchDataFixtures.items.forEach((item) => {
        expect(item.title).toBeDefined();
        expect(item.content).toBeDefined();
        expect(item.tags).toBeDefined();
      });
    });
  });

  describe('generatePaginationTestData', () => {
    it('should generate correct number of items for pagination', () => {
      const items = generatePaginationTestData(20, 5);
      expect(items).toHaveLength(100);
    });

    it('should work with custom page size', () => {
      const items = generatePaginationTestData(10, 3);
      expect(items).toHaveLength(30);
    });
  });
});
