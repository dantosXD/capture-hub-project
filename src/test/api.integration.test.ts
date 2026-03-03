/**
 * API Integration Tests
 *
 * Tests for API endpoints with real database and server
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { spawn, type ChildProcess } from 'node:child_process';

const runApiIntegration = process.env.RUN_API_INTEGRATION === 'true';
const describeApi = runApiIntegration ? describe : describe.skip;

describeApi('API Integration Tests', () => {
  let prisma: PrismaClient;
  const testPort = Number(process.env.API_TEST_PORT || 3000);
  const baseUrl = `http://localhost:${testPort}`;
  let serverProcess: ChildProcess | null = null;
  let startedServer = false;

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const isServerHealthy = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      return response.ok;
    } catch {
      return false;
    }
  };

  const waitForServerReady = async (timeoutMs: number = 90000): Promise<void> => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (await isServerHealthy()) {
        return;
      }
      await sleep(500);
    }

    throw new Error(`Timed out waiting for API server at ${baseUrl}`);
  };

  const stopServer = async (): Promise<void> => {
    const processToStop = serverProcess;
    if (!processToStop) {
      return;
    }

    serverProcess = null;

    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      processToStop.once('exit', done);
      processToStop.kill('SIGTERM');

      setTimeout(() => {
        if (processToStop.exitCode === null) {
          processToStop.kill('SIGKILL');
        }
      }, 2000);

      setTimeout(done, 7000);
    });
  };

  const startServerIfNeeded = async (): Promise<boolean> => {
    if (await isServerHealthy()) {
      return false;
    }

    const bunCommand = process.platform === 'win32' ? 'bun.exe' : 'bun';

    const spawnedProcess = spawn(bunCommand, ['run', 'dev:simple'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(testPort),
        NODE_ENV: 'test',
      },
      stdio: 'ignore',
    });

    serverProcess = spawnedProcess;

    const spawnErrorPromise = new Promise<never>((_, reject) => {
      spawnedProcess.once('error', reject);
    });

    try {
      await Promise.race([waitForServerReady(), spawnErrorPromise]);
    } catch (error) {
      await stopServer();
      throw error;
    }

    return true;
  };

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    startedServer = await startServerIfNeeded();
  }, 120000);

  afterAll(async () => {
    await prisma.$disconnect();
    if (startedServer) {
      await stopServer();
    }
  }, 30000);

  describe('Health Endpoint', () => {
    it('GET /api/health - should return health status', async () => {
      const response = await fetch(`${baseUrl}/api/health`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('database');
      expect(data.database).toHaveProperty('status');
      expect(data.database).toHaveProperty('tables');
    });

    it('GET /api/health - should show database tables', async () => {
      const response = await fetch(`${baseUrl}/api/health`);
      const data = await response.json();

      expect(data.database.tables).toBeInstanceOf(Array);
      expect(data.database.tables.length).toBeGreaterThan(0);
    });
  });

  describe('Capture API', () => {
    let testItemId: string;

    it('POST /api/capture - should create a new capture item', async () => {
      const newItem = {
        type: 'note',
        title: 'API Test Note',
        content: 'This note was created via API test',
        tags: ['api-test', 'automated'],
        priority: 'medium',
        status: 'inbox',
      };

      const response = await fetch(`${baseUrl}/api/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data.title).toBe(newItem.title);
      expect(data.type).toBe(newItem.type);

      testItemId = data.id;
    });

    it('GET /api/capture - should list capture items', async () => {
      const response = await fetch(`${baseUrl}/api/capture`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('items');
      expect(data.items).toBeInstanceOf(Array);
      expect(data).toHaveProperty('pagination');
    });

    it('GET /api/capture - should filter by type', async () => {
      const response = await fetch(`${baseUrl}/api/capture?type=note`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      data.items.forEach((item: any) => {
        expect(item.type).toBe('note');
      });
    });

    it('GET /api/capture - should filter by status', async () => {
      const response = await fetch(`${baseUrl}/api/capture?status=inbox`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      data.items.forEach((item: any) => {
        expect(item.status).toBe('inbox');
      });
    });

    it('GET /api/capture/:id - should get single item', async () => {
      if (!testItemId) {
        // Create a test item first
        const createResponse = await fetch(`${baseUrl}/api/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'note',
            title: 'Test Item for GET',
            content: 'Test content',
          }),
        });
        const created = await createResponse.json();
        testItemId = created.id;
      }

      const response = await fetch(`${baseUrl}/api/capture/${testItemId}`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.id).toBe(testItemId);
    });

    it('PUT /api/capture/:id - should update an item', async () => {
      if (!testItemId) {
        const createResponse = await fetch(`${baseUrl}/api/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'note',
            title: 'Test Item for UPDATE',
            content: 'Test content',
          }),
        });
        const created = await createResponse.json();
        testItemId = created.id;
      }

      const updates = {
        title: 'Updated via API',
        priority: 'high',
      };

      const response = await fetch(`${baseUrl}/api/capture/${testItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.title).toBe(updates.title);
      expect(data.priority).toBe(updates.priority);
    });

    it('DELETE /api/capture/:id - should delete an item', async () => {
      // Create a test item to delete
      const createResponse = await fetch(`${baseUrl}/api/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'note',
          title: 'Test Item for DELETE',
          content: 'This will be deleted',
        }),
      });
      const created = await createResponse.json();

      const deleteResponse = await fetch(`${baseUrl}/api/capture/${created.id}`, {
        method: 'DELETE',
      });

      expect(deleteResponse.ok).toBe(true);

      // Verify it's deleted
      const getResponse = await fetch(`${baseUrl}/api/capture/${created.id}`);
      expect(getResponse.status).toBe(404);
    });
  });

  describe('Projects API', () => {
    let testProjectId: string;

    it('POST /api/projects - should create a new project', async () => {
      const newProject = {
        name: 'API Test Project',
        description: 'Project created via API test',
        color: '#8b5cf6',
        status: 'active',
        priority: 'medium',
      };

      const response = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('project');
      expect(data.project).toHaveProperty('id');
      expect(data.project.name).toBe(newProject.name);
      expect(data.project.color).toBe(newProject.color);

      testProjectId = data.project.id;
    });

    it('GET /api/projects - should list projects', async () => {
      const response = await fetch(`${baseUrl}/api/projects`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('projects');
      expect(data.projects).toBeInstanceOf(Array);
    });

    it('GET /api/projects/:id - should get single project', async () => {
      if (!testProjectId) {
        const createResponse = await fetch(`${baseUrl}/api/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test Project for GET',
            color: '#6366f1',
          }),
        });
        const created = await createResponse.json();
        testProjectId = created.project.id;
      }

      const response = await fetch(`${baseUrl}/api/projects/${testProjectId}`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.project.id).toBe(testProjectId);
    });

    it('PATCH /api/projects/:id - should update a project', async () => {
      if (!testProjectId) {
        const createResponse = await fetch(`${baseUrl}/api/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test Project for PATCH',
            color: '#6366f1',
          }),
        });
        const created = await createResponse.json();
        testProjectId = created.project.id;
      }

      const updates = {
        name: 'Updated via API',
        status: 'completed',
      };

      const response = await fetch(`${baseUrl}/api/projects/${testProjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.project.name).toBe(updates.name);
      expect(data.project.status).toBe(updates.status);
    });

    it('DELETE /api/projects/:id - should delete a project', async () => {
      // Create a test project to delete
      const createResponse = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Project for DELETE',
          color: '#f59e0b',
        }),
      });
      const created = await createResponse.json();

      const deleteResponse = await fetch(`${baseUrl}/api/projects/${created.project.id}`, {
        method: 'DELETE',
      });

      expect(deleteResponse.ok).toBe(true);
    });
  });

  describe('Search API', () => {
    it('GET /api/search - should return search results', async () => {
      const response = await fetch(`${baseUrl}/api/search?q=test`);
      const data = await response.json();
      
      expect(response.ok).toBe(true);
      expect(data).toHaveProperty('results');
      expect(data.results).toBeInstanceOf(Array);
    });

    it('GET /api/search - should handle empty query', async () => {
      const response = await fetch(`${baseUrl}/api/search?q=`);
      const data = await response.json();
      
      expect(response.ok).toBe(true);
      expect(data).toHaveProperty('results');
      expect(data.results).toBeInstanceOf(Array);
    });
  });

  describe('Stats API', () => {
    it('GET /api/stats - should return statistics', async () => {
      const response = await fetch(`${baseUrl}/api/stats`);
      const data = await response.json();
      
      expect(response.ok).toBe(true);
      expect(data).toHaveProperty('totalItems');
      expect(data).toHaveProperty('inboxCount');
      expect(data).toHaveProperty('todayCount');
      expect(data).toHaveProperty('weekCount');
      expect(data).toHaveProperty('staleItems');
      expect(data).toHaveProperty('recentItems');
      expect(data).toHaveProperty('topTags');
    });

    it('GET /api/stats - should return valid counts', async () => {
      const response = await fetch(`${baseUrl}/api/stats`);
      const data = await response.json();
      
      expect(response.ok).toBe(true);
      expect(typeof data.totalItems).toBe('number');
      expect(typeof data.inboxCount).toBe('number');
      expect(typeof data.todayCount).toBe('number');
      expect(typeof data.weekCount).toBe('number');
    });
  });

  describe('Templates API', () => {
    it('GET /api/templates - should list templates', async () => {
      const response = await fetch(`${baseUrl}/api/templates`);
      const data = await response.json();
      
      expect(response.ok).toBe(true);
      expect(data).toHaveProperty('templates');
      expect(data.templates).toBeInstanceOf(Array);
    });

    it('GET /api/templates - should filter by category', async () => {
      const response = await fetch(`${baseUrl}/api/templates?category=meeting`);
      const data = await response.json();
      
      expect(response.ok).toBe(true);
      data.templates.forEach((template: any) => {
        expect(template.category).toBe('meeting');
      });
    });

    it('POST /api/templates - should create a template', async () => {
      const newTemplate = {
        name: 'Test Template',
        description: 'Template for testing',
        content: '# Test Template\n\n{{variable}}',
        category: 'general',
      };

      const response = await fetch(`${baseUrl}/api/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      });

      const data = await response.json();
      
      expect(response.ok).toBe(true);
      expect(data.template.name).toBe(newTemplate.name);
      expect(data.template.content).toBe(newTemplate.content);
    });
  });

  describe('Links API', () => {
    let sourceId: string;
    let targetId: string;

    beforeAll(async () => {
      // Create test items
      const source = await prisma.captureItem.create({
        data: {
          type: 'note',
          title: 'Source Item',
          content: 'Source',
          tags: JSON.stringify(['test']),
          status: 'inbox',
        },
      });
      sourceId = source.id;

      const target = await prisma.captureItem.create({
        data: {
          type: 'note',
          title: 'Target Item',
          content: 'Target',
          tags: JSON.stringify(['test']),
          status: 'inbox',
        },
      });
      targetId = target.id;
    });

    it('POST /api/links - should create a link', async () => {
      const linkData = {
        sourceId,
        targetId,
        relationType: 'related',
      };

      const response = await fetch(`${baseUrl}/api/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(linkData),
      });

      const data = await response.json();
      
      expect(response.ok).toBe(true);
      expect(data.link.sourceId).toBe(sourceId);
      expect(data.link.targetId).toBe(targetId);
      expect(data.link.relationType).toBe('related');
    });

    it('GET /api/links - should get links for an item', async () => {
      const response = await fetch(`${baseUrl}/api/links?itemId=${sourceId}`);
      const data = await response.json();
      
      expect(response.ok).toBe(true);
      expect(data).toHaveProperty('links');
      expect(data.links).toBeInstanceOf(Array);
    });

    it('DELETE /api/links - should delete a link', async () => {
      const response = await fetch(`${baseUrl}/api/links?sourceId=${sourceId}&targetId=${targetId}`, {
        method: 'DELETE',
      });

      expect(response.ok).toBe(true);
    });
  });

  describe('Export API', () => {
    it('GET /api/export - should export as JSON', async () => {
      const response = await fetch(`${baseUrl}/api/export?format=json`);
      const data = await response.json();
      
      expect(response.ok).toBe(true);
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('projects');
      expect(data).toHaveProperty('templates');
      expect(data).toHaveProperty('exportedAt');
    });

    it('GET /api/export - should export as Markdown', async () => {
      const response = await fetch(`${baseUrl}/api/export?format=markdown`);
      const text = await response.text();
      
      expect(response.ok).toBe(true);
      expect(text.length).toBeGreaterThan(0);
    });

    it('GET /api/export - should export as CSV', async () => {
      const response = await fetch(`${baseUrl}/api/export?format=csv`);
      const text = await response.text();
      
      expect(response.ok).toBe(true);
      expect(text.length).toBeGreaterThan(0);
      expect(text.split('\n').length).toBeGreaterThan(1); // Has header + data
    });
  });

  describe('Devices API', () => {
    it('GET /api/devices - should list connected devices', async () => {
      const response = await fetch(`${baseUrl}/api/devices`);
      const data = await response.json();
      
      expect(response.ok).toBe(true);
      expect(data).toHaveProperty('devices');
      expect(data.devices).toBeInstanceOf(Array);
    });
  });
});
