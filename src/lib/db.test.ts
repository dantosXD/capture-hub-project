/**
 * Tests for database operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

describe('Database Operations', () => {
  let prisma: PrismaClient;

  beforeEach(async () => {
    // Create a new Prisma client for each test
    prisma = new PrismaClient();
  });

  afterEach(async () => {
    // Cleanup after each test
    await prisma.$disconnect();
  });

  describe('Database Connection', () => {
    it('should connect to database successfully', async () => {
      await expect(prisma.$connect()).resolves.not.toThrow();
    });

    it('should query database tables', async () => {
      // Test that we can query the CaptureItem table
      const items = await prisma.captureItem.findMany({
        take: 5,
      });
      expect(Array.isArray(items)).toBe(true);
    });

    it('should query Project table', async () => {
      const projects = await prisma.project.findMany({
        take: 5,
      });
      expect(Array.isArray(projects)).toBe(true);
    });

    it('should query Template table', async () => {
      const templates = await prisma.template.findMany({
        take: 5,
      });
      expect(Array.isArray(templates)).toBe(true);
    });

    it('should query ItemLink table', async () => {
      const links = await prisma.itemLink.findMany({
        take: 5,
      });
      expect(Array.isArray(links)).toBe(true);
    });

    it('should query ConnectedDevice table', async () => {
      const devices = await prisma.connectedDevice.findMany({
        take: 5,
      });
      expect(Array.isArray(devices)).toBe(true);
    });
  });

  describe('CaptureItem CRUD', () => {
    let testItemId: string;

    it('should create a new capture item', async () => {
      const item = await prisma.captureItem.create({
        data: {
          type: 'note',
          title: 'DB Note for Create',
          content: 'Test content',
          tags: JSON.stringify(['test', 'database']),
          priority: 'none',
          status: 'inbox',
        },
      });
      testItemId = item.id;
      expect(item).toBeDefined();
      expect(item.title).toBe('DB Note for Create');
      expect(item.type).toBe('note');
    });

    it('should read a capture item', async () => {
      let readItemId;
      const item = await prisma.captureItem.create({
        data: {
          type: 'note',
          title: 'DB Note for Read',
          content: 'Test content',
          tags: JSON.stringify(['test']),
          priority: 'none',
          status: 'inbox',
        },
      });
      readItemId = item.id;

      const found = await prisma.captureItem.findUnique({
        where: { id: readItemId },
      });
      expect(found).toBeDefined();
      expect(found?.title).toBe('DB Note for Read');
    });

    it('should update a capture item', async () => {
      const item = await prisma.captureItem.create({
        data: {
          type: 'note',
          title: 'DB Note for Update',
          content: 'Test content',
          tags: JSON.stringify(['test']),
          priority: 'none',
          status: 'inbox',
        },
      });

      const updated = await prisma.captureItem.update({
        where: { id: item.id },
        data: { title: 'Updated Title' },
      });
      expect(updated.title).toBe('Updated Title');
    });

    it('should delete a capture item', async () => {
      const item = await prisma.captureItem.create({
        data: {
          type: 'note',
          title: 'DB Note for Delete',
          content: 'Test content',
          tags: JSON.stringify(['test']),
          priority: 'none',
          status: 'inbox',
        },
      });

      await prisma.captureItem.delete({
        where: { id: item.id },
      });

      const found = await prisma.captureItem.findUnique({
        where: { id: item.id },
      });
      expect(found).toBeNull();
    });

    it('should filter capture items by status', async () => {
      const inboxItems = await prisma.captureItem.findMany({
        where: { status: 'inbox' },
        take: 10,
      });
      expect(Array.isArray(inboxItems)).toBe(true);
      inboxItems.forEach((item) => {
        expect(item.status).toBe('inbox');
      });
    });

    it('should filter capture items by type', async () => {
      const notes = await prisma.captureItem.findMany({
        where: { type: 'note' },
        take: 10,
      });
      expect(Array.isArray(notes)).toBe(true);
      notes.forEach((item) => {
        expect(item.type).toBe('note');
      });
    });
  });

  describe('Project CRUD', () => {
    let testProjectId: string;

    it('should create a new project', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'DB Project Create',
          description: 'Test project description',
          color: '#6366f1',
          status: 'active',
          priority: 'medium',
        },
      });
      testProjectId = project.id;
      expect(project).toBeDefined();
      expect(project.name).toBe('DB Project Create');
    });

    it('should read a project', async () => {
      let readProjectId;
      const project = await prisma.project.create({
        data: {
          name: 'DB Project Read',
          color: '#6366f1',
          status: 'active',
        },
      });
      readProjectId = project.id;

      const found = await prisma.project.findUnique({
        where: { id: readProjectId },
      });
      expect(found).toBeDefined();
      expect(found?.name).toBe('DB Project Read');
    });

    it('should update a project', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'DB Project Update',
          color: '#6366f1',
          status: 'active',
        },
      });

      const updated = await prisma.project.update({
        where: { id: project.id },
        data: { name: 'Updated Project Name' },
      });
      expect(updated.name).toBe('Updated Project Name');
    });

    it('should delete a project', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'DB Project Delete',
          color: '#6366f1',
          status: 'active',
        },
      });

      await prisma.project.delete({
        where: { id: project.id },
      });

      const found = await prisma.project.findUnique({
        where: { id: project.id },
      });
      expect(found).toBeNull();
    });
  });

  describe('ItemLink Operations', () => {
    let testSourceId: string;
    let testTargetId: string;
    let testLinkId: string;

    beforeEach(async () => {
      // Create test items
      const source = await prisma.captureItem.create({
        data: {
          type: 'note',
          title: 'Source Item',
          content: 'Source content',
          tags: JSON.stringify(['test']),
          status: 'inbox',
        },
      });
      testSourceId = source.id;

      const target = await prisma.captureItem.create({
        data: {
          type: 'note',
          title: 'Target Item',
          content: 'Target content',
          tags: JSON.stringify(['test']),
          status: 'inbox',
        },
      });
      testTargetId = target.id;
    });

    it('should create a link between items', async () => {
      const link = await prisma.itemLink.create({
        data: {
          sourceId: testSourceId,
          targetId: testTargetId,
          relationType: 'related',
        },
      });
      testLinkId = link.id;
      expect(link).toBeDefined();
      expect(link.relationType).toBe('related');
    });

    it('should find links by source item', async () => {
      const link = await prisma.itemLink.create({
        data: {
          sourceId: testSourceId,
          targetId: testTargetId,
          relationType: 'depends-on',
        },
      });
      testLinkId = link.id;

      const links = await prisma.itemLink.findMany({
        where: { sourceId: testSourceId },
      });
      expect(links.length).toBeGreaterThan(0);
      expect(links[0].relationType).toBe('depends-on');
    });

    it('should delete a link', async () => {
      const link = await prisma.itemLink.create({
        data: {
          sourceId: testSourceId,
          targetId: testTargetId,
          relationType: 'blocks',
        },
      });

      await prisma.itemLink.delete({
        where: { id: link.id },
      });

      const found = await prisma.itemLink.findUnique({
        where: { id: link.id },
      });
      expect(found).toBeNull();
    });
  });
});
