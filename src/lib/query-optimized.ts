/**
 * Optimized query helpers to reduce data transfer and improve performance.
 * Uses selective field fetching and efficient query patterns.
 */

import { db } from './db';
import type { CaptureItem, Project } from '@prisma/client';

/**
 * Minimal item fields for list views (reduces data transfer by ~80%)
 */
export const ITEM_LIST_SELECT = {
  id: true,
  type: true,
  title: true,
  tags: true,
  priority: true,
  status: true,
  assignedTo: true,
  pinned: true,
  projectId: true,
  dueDate: true,
  reminder: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Full item fields for detail views
 */
export const ITEM_DETAIL_SELECT = {
  id: true,
  type: true,
  title: true,
  content: true,
  extractedText: true,
  imageUrl: true,
  sourceUrl: true,
  metadata: true,
  tags: true,
  priority: true,
  status: true,
  assignedTo: true,
  dueDate: true,
  reminder: true,
  reminderSent: true,
  pinned: true,
  projectId: true,
  processedAt: true,
  processedBy: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Get recent items efficiently
 */
export async function getRecentItems(limit = 10) {
  return db.captureItem.findMany({
    where: { status: { not: 'trash' } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      title: true,
      type: true,
      createdAt: true,
    },
  });
}

/**
 * Get dashboard stats with parallel queries
 */
export async function getDashboardStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const staleDate = new Date(todayStart);
  staleDate.setDate(staleDate.getDate() - 7);

  // Run all queries in parallel
  const [
    total,
    inbox,
    assigned,
    archived,
    trash,
    processed,
    today,
    thisWeek,
    lastWeek,
    inboxThisWeek,
    inboxLastWeek,
    processedThisWeek,
    processedLastWeek,
    stale,
    recentItems,
  ] = await Promise.all([
    db.captureItem.count(),
    db.captureItem.count({ where: { status: 'inbox' } }),
    db.captureItem.count({ where: { status: 'assigned' } }),
    db.captureItem.count({ where: { status: 'archived' } }),
    db.captureItem.count({ where: { status: 'trash' } }),
    db.captureItem.count({ where: { processedAt: { not: null } } }),
    db.captureItem.count({ where: { createdAt: { gte: todayStart.toISOString() } } }),
    db.captureItem.count({ where: { createdAt: { gte: weekStart.toISOString() } } }),
    db.captureItem.count({
      where: {
        createdAt: {
          gte: lastWeekStart.toISOString(),
          lt: weekStart.toISOString(),
        },
      },
    }),
    db.captureItem.count({
      where: {
        status: 'inbox',
        createdAt: { gte: weekStart.toISOString() },
      },
    }),
    db.captureItem.count({
      where: {
        status: 'inbox',
        createdAt: {
          gte: lastWeekStart.toISOString(),
          lt: weekStart.toISOString(),
        },
      },
    }),
    db.captureItem.count({
      where: {
        processedAt: {
          not: null,
          gte: weekStart.toISOString(),
        },
      },
    }),
    db.captureItem.count({
      where: {
        processedAt: {
          not: null,
          gte: lastWeekStart.toISOString(),
          lt: weekStart.toISOString(),
        },
      },
    }),
    db.captureItem.count({
      where: {
        status: 'inbox',
        updatedAt: { lt: staleDate.toISOString() },
      },
    }),
    getRecentItems(10),
  ]);

  return {
    inbox,
    assigned,
    archived,
    trash,
    total,
    today,
    thisWeek,
    lastWeek,
    inboxThisWeek,
    inboxLastWeek,
    processedThisWeek,
    processedLastWeek,
    processed,
    stale,
    recentItems,
  };
}

/**
 * Get projects with item counts (optimized)
 */
export async function getProjectsWithCounts() {
  const projects = await db.project.findMany({
    orderBy: { order: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      icon: true,
      status: true,
      priority: true,
      dueDate: true,
      order: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { items: true },
      },
    },
  });

  return projects.map(p => ({
    ...p,
    itemCount: p._count.items,
  }));
}
