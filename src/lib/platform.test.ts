/**
 * Platform Validation Tests (Project Omni P2)
 * Verifies event mesh bridge, database configuration,
 * and IaC file structure.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eventBus } from '@/contracts/event-bus';
import { EventType } from '@/contracts/events';
import {
  detectDatabaseProvider,
  supportsVectorSearch,
  supportsNativeJson,
  supportsFullTextSearch,
  getDatabaseConfig,
} from './db-config';
import {
  initializeEventMesh,
  shutdownEventMesh,
  getEventMeshStatus,
} from './event-mesh';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// Database Configuration Tests
// ============================================================================

describe('Database Configuration', () => {
  const originalEnv = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.DATABASE_URL = originalEnv;
  });

  it('should detect SQLite from file: URL', () => {
    process.env.DATABASE_URL = 'file:./prisma/dev.db';
    expect(detectDatabaseProvider()).toBe('sqlite');
  });

  it('should detect PostgreSQL from postgresql:// URL', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    expect(detectDatabaseProvider()).toBe('postgresql');
  });

  it('should detect PostgreSQL from postgres:// URL', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
    expect(detectDatabaseProvider()).toBe('postgresql');
  });

  it('should default to SQLite for empty/missing DATABASE_URL', () => {
    process.env.DATABASE_URL = '';
    expect(detectDatabaseProvider()).toBe('sqlite');
  });

  it('SQLite should not support vector search', () => {
    process.env.DATABASE_URL = 'file:./prisma/dev.db';
    expect(supportsVectorSearch()).toBe(false);
    expect(supportsNativeJson()).toBe(false);
    expect(supportsFullTextSearch()).toBe(false);
  });

  it('PostgreSQL should support all advanced features', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    expect(supportsVectorSearch()).toBe(true);
    expect(supportsNativeJson()).toBe(true);
    expect(supportsFullTextSearch()).toBe(true);
  });

  it('getDatabaseConfig returns complete config for SQLite', () => {
    process.env.DATABASE_URL = 'file:./prisma/dev.db';
    const config = getDatabaseConfig();
    expect(config.provider).toBe('sqlite');
    expect(config.features.vectorSearch).toBe(false);
    expect(config.features.eventOutbox).toBe(false);
    expect(config.connectionPool.maxConnections).toBe(1);
  });

  it('getDatabaseConfig returns complete config for PostgreSQL', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    const config = getDatabaseConfig();
    expect(config.provider).toBe('postgresql');
    expect(config.features.vectorSearch).toBe(true);
    expect(config.features.eventOutbox).toBe(true);
    expect(config.features.embeddings).toBe(true);
    expect(config.connectionPool.maxConnections).toBe(20);
  });
});

// ============================================================================
// Event Mesh Bridge Tests
// ============================================================================

describe('Event Mesh Bridge', () => {
  beforeEach(() => {
    shutdownEventMesh();
    eventBus.reset();
  });

  it('should initialize and report status', () => {
    initializeEventMesh();
    const status = getEventMeshStatus();
    expect(status.initialized).toBe(true);
    expect(status.eventCount).toBe(0);
    expect(status.errorCount).toBe(0);
    expect(status.subscriberCount).toBeGreaterThanOrEqual(1);
  });

  it('should not double-initialize', () => {
    initializeEventMesh();
    const count1 = getEventMeshStatus().subscriberCount;
    initializeEventMesh(); // Second call
    const count2 = getEventMeshStatus().subscriberCount;
    expect(count2).toBe(count1); // Same count, no duplicate subscriber
  });

  it('should bridge domain events to broadcast (increments event count)', async () => {
    initializeEventMesh();
    const before = getEventMeshStatus().eventCount;

    // Publish a domain event
    await eventBus.publish(EventType.STATS_UPDATED, {
      scope: 'all',
      timestamp: new Date().toISOString(),
    }, { source: 'test' });

    const after = getEventMeshStatus().eventCount;
    expect(after - before).toBe(1);
  });

  it('should bridge multiple event types', async () => {
    initializeEventMesh();
    const before = getEventMeshStatus().eventCount;

    await eventBus.publish(EventType.ITEM_CREATED, {
      id: 'item-1',
      type: 'note',
      title: 'Test',
      status: 'inbox',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { source: 'test' });

    await eventBus.publish(EventType.PROJECT_CREATED, {
      id: 'proj-1',
      name: 'Test Project',
      createdAt: new Date().toISOString(),
    }, { source: 'test' });

    await eventBus.publish(EventType.LINK_CREATED, {
      id: 'link-1',
      sourceId: 'item-1',
      targetId: 'item-2',
      createdAt: new Date().toISOString(),
    }, { source: 'test' });

    const after = getEventMeshStatus().eventCount;
    expect(after - before).toBe(3);
    expect(getEventMeshStatus().errorCount).toBe(0);
  });

  it('should handle AI events (no legacy mapping)', async () => {
    initializeEventMesh();
    const before = getEventMeshStatus().eventCount;

    await eventBus.publish(EventType.AI_PROCESSING_STARTED, {
      taskId: 'task-1',
      taskType: 'summary',
      startedAt: new Date().toISOString(),
    }, { source: 'test' });

    const after = getEventMeshStatus().eventCount;
    expect(after - before).toBe(1);
  });

  it('should shut down cleanly', async () => {
    initializeEventMesh();

    await eventBus.publish(EventType.STATS_UPDATED, {
      scope: 'all',
      timestamp: new Date().toISOString(),
    }, { source: 'test' });

    shutdownEventMesh();

    const status = getEventMeshStatus();
    expect(status.initialized).toBe(false);
  });
});

// ============================================================================
// IaC File Structure Tests
// ============================================================================

describe('IaC File Structure', () => {
  const projectRoot = path.resolve(__dirname, '../..');

  it('docker-compose.platform.yml should exist', () => {
    const filePath = path.join(projectRoot, 'docker-compose.platform.yml');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('docker-compose.platform.yml should define postgres, redis, and app services', () => {
    const filePath = path.join(projectRoot, 'docker-compose.platform.yml');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('postgres:');
    expect(content).toContain('redis:');
    expect(content).toContain('app:');
    expect(content).toContain('pgvector/pgvector');
    expect(content).toContain('redis:7-alpine');
  });

  it('PostgreSQL init script should exist and enable pgvector', () => {
    const filePath = path.join(projectRoot, 'infra/postgres/init.sql');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('CREATE EXTENSION IF NOT EXISTS vector');
    expect(content).toContain('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  });

  it('PostgreSQL Prisma schema should exist with Embedding model', () => {
    const filePath = path.join(projectRoot, 'prisma/schema.postgresql.prisma');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('provider   = "postgresql"');
    expect(content).toContain('model Embedding');
    expect(content).toContain('vector(1536)');
    expect(content).toContain('model EventOutbox');
  });

  it('original SQLite schema should remain intact', () => {
    const filePath = path.join(projectRoot, 'prisma/schema.prisma');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('provider = "sqlite"');
    expect(content).toContain('model CaptureItem');
    expect(content).toContain('model Project');
  });

  it('.env.example should document PostgreSQL and Redis configuration', () => {
    const filePath = path.join(projectRoot, '.env.example');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('PostgreSQL Configuration');
    expect(content).toContain('POSTGRES_USER');
    expect(content).toContain('Redis Configuration');
    expect(content).toContain('REDIS_URL');
  });
});
