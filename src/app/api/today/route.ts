import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeParseTags, safeParseJSON } from '@/lib/parse-utils';
import { apiError, classifyError } from '@/lib/api-route-handler';
import { validateRequest } from '@/lib/api-security';

// GET /api/today - Return items for the Today view
// Includes: overdue, due today, items with past reminders, and pinned inbox items
export async function GET(request: NextRequest) {
  const security = await validateRequest(request, { requireCsrf: false, rateLimitPreset: 'read' });
  if (!security.success) return NextResponse.json({ error: security.error }, { status: security.status });

  try {
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEndISO = todayEnd.toISOString();
    const todayStartISO = todayStart.toISOString();

    // Fetch all non-archived, non-trash items with a dueDate or that are pinned
    const [dueTodayItems, overdueItems, pinnedItems, reminderItems] = await Promise.all([
      // Due today
      db.$queryRawUnsafe<any[]>(
        `SELECT * FROM "CaptureItem" WHERE "dueDate" >= ? AND "dueDate" <= ? AND "status" NOT IN ('archived','trash') ORDER BY "dueDate" ASC LIMIT 50`,
        todayStartISO,
        todayEndISO
      ),
      // Overdue (past due date, not done/archived/trash)
      db.$queryRawUnsafe<any[]>(
        `SELECT * FROM "CaptureItem" WHERE "dueDate" < ? AND "status" NOT IN ('archived','trash') ORDER BY "dueDate" ASC LIMIT 50`,
        todayStartISO
      ),
      // Pinned inbox items
      db.$queryRawUnsafe<any[]>(
        `SELECT * FROM "CaptureItem" WHERE "pinned" = 1 AND "status" NOT IN ('archived','trash') ORDER BY "createdAt" DESC LIMIT 20`
      ),
      // Past reminders not yet sent
      db.$queryRawUnsafe<any[]>(
        `SELECT * FROM "CaptureItem" WHERE "reminder" IS NOT NULL AND "reminder" <= ? AND "reminderSent" = 0 AND "status" NOT IN ('archived','trash') ORDER BY "reminder" ASC LIMIT 20`,
        now.toISOString()
      ),
    ]);

    const parseItem = (item: any) => ({
      ...item,
      tags: safeParseTags(item.tags),
      metadata: safeParseJSON(item.metadata),
      pinned: !!item.pinned,
      reminderSent: !!item.reminderSent,
    });

    // Deduplicate across sections by id
    const seen = new Set<string>();
    const dedup = (items: any[]) => items.map(parseItem).filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    const overdue = dedup(overdueItems);
    const dueToday = dedup(dueTodayItems);
    const pinned = dedup(pinnedItems);
    const pastReminders = dedup(reminderItems);

    return NextResponse.json({
      overdue,
      dueToday,
      pinned,
      pastReminders,
      counts: {
        overdue: overdue.length,
        dueToday: dueToday.length,
        pinned: pinned.length,
        pastReminders: pastReminders.length,
        total: overdue.length + dueToday.length + pinned.length + pastReminders.length,
      },
    });
  } catch (error) {
    const { message, status, details } = classifyError(error);
    const safeDetails = process.env.NODE_ENV === 'production' ? undefined : details;
    return apiError(message, status, { details: safeDetails, logPrefix: '[GET /api/today]', error });
  }
}
