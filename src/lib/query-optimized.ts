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
 * Get dashboard stats with parallel queries (uses raw SQL to avoid P2023
 * DateTime coercion errors from legacy malformed date strings in SQLite).
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

  const todayISO = todayStart.toISOString();
  const weekISO = weekStart.toISOString();
  const lastWeekISO = lastWeekStart.toISOString();
  const staleISO = staleDate.toISOString();

  type CountRow = { count: number };
  type RecentRow = { id: string; title: string; type: string; createdAt: string };

  const [
    totalRows, inboxRows, assignedRows, archivedRows, trashRows, processedRows,
    todayRows, thisWeekRows, lastWeekRows, inboxThisWeekRows, inboxLastWeekRows,
    processedThisWeekRows, processedLastWeekRows, staleRows, recentRows,
  ] = await Promise.all([
    db.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*) as count FROM CaptureItem`),
    db.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*) as count FROM CaptureItem WHERE status='inbox'`),
    db.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*) as count FROM CaptureItem WHERE status='assigned'`),
    db.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*) as count FROM CaptureItem WHERE status='archived'`),
    db.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*) as count FROM CaptureItem WHERE status='trash'`),
    db.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*) as count FROM CaptureItem WHERE processedAt IS NOT NULL AND processedAt != ''`),
    db.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*) as count FROM CaptureItem WHERE createdAt >= '${todayISO}'`),
    db.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*) as count FROM CaptureItem WHERE createdAt >= '${weekISO}'`),
    db.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*) as count FROM CaptureItem WHERE createdAt >= '${lastWeekISO}' AND createdAt < '${weekISO}'`),
    db.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*) as count FROM CaptureItem WHERE status='inbox' AND createdAt >= '${weekISO}'`),
    db.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*) as count FROM CaptureItem WHERE status='inbox' AND createdAt >= '${lastWeekISO}' AND createdAt < '${weekISO}'`),
    db.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*) as count FROM CaptureItem WHERE processedAt IS NOT NULL AND processedAt >= '${weekISO}'`),
    db.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*) as count FROM CaptureItem WHERE processedAt IS NOT NULL AND processedAt >= '${lastWeekISO}' AND processedAt < '${weekISO}'`),
    db.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*) as count FROM CaptureItem WHERE status='inbox' AND updatedAt < '${staleISO}'`),
    db.$queryRawUnsafe<RecentRow[]>(`SELECT id, title, type, createdAt FROM CaptureItem WHERE status != 'trash' ORDER BY createdAt DESC LIMIT 10`),
  ]);

  const n = (rows: CountRow[]) => Number(rows[0]?.count ?? 0);

  return {
    inbox: n(inboxRows),
    assigned: n(assignedRows),
    archived: n(archivedRows),
    trash: n(trashRows),
    total: n(totalRows),
    today: n(todayRows),
    thisWeek: n(thisWeekRows),
    lastWeek: n(lastWeekRows),
    inboxThisWeek: n(inboxThisWeekRows),
    inboxLastWeek: n(inboxLastWeekRows),
    processedThisWeek: n(processedThisWeekRows),
    processedLastWeek: n(processedLastWeekRows),
    processed: n(processedRows),
    stale: n(staleRows),
    recentItems: recentRows,
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
