/**
 * Normalize all date fields from text format to Prisma's integer (epoch ms) DateTime format.
 * 
 * After migrating schema from String to DateTime, old records stored dates as text strings.
 * New records (via Prisma @default(now())) store as integers. This mismatch breaks SQLite sorting
 * because text values sort differently from integers.
 * 
 * This script reads all records and re-saves date fields through Prisma to normalize the format.
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function normalizeTable(
  tableName: string,
  dateFields: string[],
  findMany: () => Promise<any[]>,
  update: (id: string, data: Record<string, any>) => Promise<any>
) {
  const items = await findMany();
  let fixed = 0;

  for (const item of items) {
    const updates: Record<string, Date> = {};
    
    for (const field of dateFields) {
      const val = item[field];
      if (val === null || val === undefined) continue;
      
      // Check if value needs normalization (raw query would show typeof=text)
      // Re-parse and set as Date object so Prisma stores as integer
      const date = new Date(val);
      if (!isNaN(date.getTime())) {
        updates[field] = date;
      }
    }

    if (Object.keys(updates).length > 0) {
      await update(item.id, updates);
      fixed++;
    }
  }

  console.log(`  ${tableName}: normalized ${fixed}/${items.length} records`);
  return fixed;
}

async function main() {
  console.log('=== Normalizing date fields to Prisma DateTime format ===\n');

  let totalFixed = 0;

  // CaptureItem
  totalFixed += await normalizeTable(
    'CaptureItem',
    ['createdAt', 'updatedAt', 'processedAt'],
    () => db.captureItem.findMany(),
    (id, data) => db.captureItem.update({ where: { id }, data })
  );

  // Project
  totalFixed += await normalizeTable(
    'Project',
    ['createdAt', 'updatedAt'],
    () => db.project.findMany(),
    (id, data) => db.project.update({ where: { id }, data })
  );

  // Template
  totalFixed += await normalizeTable(
    'Template',
    ['createdAt', 'updatedAt'],
    () => db.template.findMany(),
    (id, data) => db.template.update({ where: { id }, data })
  );

  // ItemLink
  totalFixed += await normalizeTable(
    'ItemLink',
    ['createdAt'],
    () => db.itemLink.findMany(),
    (id, data) => db.itemLink.update({ where: { id }, data })
  );

  // ConnectedDevice
  totalFixed += await normalizeTable(
    'ConnectedDevice',
    ['connectedAt', 'lastSeen'],
    () => db.connectedDevice.findMany(),
    (id, data) => db.connectedDevice.update({ where: { id }, data })
  );

  console.log(`\nDone! Normalized ${totalFixed} total records.`);

  // Verify sort works
  console.log('\n=== Verification: top 3 items by createdAt DESC ===');
  const top3 = await db.captureItem.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { id: true, title: true, createdAt: true },
  });
  for (const item of top3) {
    console.log(`  "${item.title}" — ${new Date(item.createdAt).toISOString()}`);
  }

  await db.$disconnect();
}

main().catch(console.error);
