/**
 * Data Migration: Fix "now()" literal strings in date fields.
 *
 * The Prisma schema used `String @default("now()")` which stores the literal
 * text "now()" instead of an actual timestamp. This script converts all
 * "now()" values to valid ISO-8601 timestamps.
 *
 * Strategy per row:
 *   - If `updatedAt` is a valid ISO date, use it for `createdAt` too.
 *   - Otherwise, fall back to the current time.
 *
 * Run: bunx tsx prisma/fix-now-literals.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function isValidISODate(value: string): boolean {
  if (!value || value === 'now()') return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

async function fixCaptureItems() {
  const items = await prisma.captureItem.findMany({
    where: {
      OR: [
        { createdAt: 'now()' },
        { updatedAt: 'now()' },
      ],
    },
    select: { id: true, createdAt: true, updatedAt: true },
  });

  let fixed = 0;
  for (const item of items) {
    const fallback = new Date().toISOString();
    const validUpdatedAt = isValidISODate(item.updatedAt) ? item.updatedAt : null;
    const validCreatedAt = isValidISODate(item.createdAt) ? item.createdAt : null;

    const newCreatedAt = validCreatedAt ?? validUpdatedAt ?? fallback;
    const newUpdatedAt = validUpdatedAt ?? validCreatedAt ?? fallback;

    await prisma.captureItem.update({
      where: { id: item.id },
      data: { createdAt: newCreatedAt, updatedAt: newUpdatedAt },
    });
    fixed++;
  }
  console.log(`  CaptureItem: fixed ${fixed}/${items.length} rows`);
  return fixed;
}

async function fixProjects() {
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { createdAt: 'now()' },
        { updatedAt: 'now()' },
      ],
    },
    select: { id: true, createdAt: true, updatedAt: true },
  });

  let fixed = 0;
  for (const project of projects) {
    const fallback = new Date().toISOString();
    const validUpdatedAt = isValidISODate(project.updatedAt) ? project.updatedAt : null;
    const validCreatedAt = isValidISODate(project.createdAt) ? project.createdAt : null;

    const newCreatedAt = validCreatedAt ?? validUpdatedAt ?? fallback;
    const newUpdatedAt = validUpdatedAt ?? validCreatedAt ?? fallback;

    await prisma.project.update({
      where: { id: project.id },
      data: { createdAt: newCreatedAt, updatedAt: newUpdatedAt },
    });
    fixed++;
  }
  console.log(`  Project: fixed ${fixed}/${projects.length} rows`);
  return fixed;
}

async function fixTemplates() {
  const templates = await prisma.template.findMany({
    where: {
      OR: [
        { createdAt: 'now()' },
        { updatedAt: 'now()' },
      ],
    },
    select: { id: true, createdAt: true, updatedAt: true },
  });

  let fixed = 0;
  for (const template of templates) {
    const fallback = new Date().toISOString();
    const validUpdatedAt = isValidISODate(template.updatedAt) ? template.updatedAt : null;
    const validCreatedAt = isValidISODate(template.createdAt) ? template.createdAt : null;

    const newCreatedAt = validCreatedAt ?? validUpdatedAt ?? fallback;
    const newUpdatedAt = validUpdatedAt ?? validCreatedAt ?? fallback;

    await prisma.template.update({
      where: { id: template.id },
      data: { createdAt: newCreatedAt, updatedAt: newUpdatedAt },
    });
    fixed++;
  }
  console.log(`  Template: fixed ${fixed}/${templates.length} rows`);
  return fixed;
}

async function fixItemLinks() {
  const links = await prisma.itemLink.findMany({
    where: { createdAt: 'now()' },
    select: { id: true, createdAt: true },
  });

  let fixed = 0;
  const fallback = new Date().toISOString();
  for (const link of links) {
    await prisma.itemLink.update({
      where: { id: link.id },
      data: { createdAt: fallback },
    });
    fixed++;
  }
  console.log(`  ItemLink: fixed ${fixed}/${links.length} rows`);
  return fixed;
}

async function fixConnectedDevices() {
  const devices = await prisma.connectedDevice.findMany({
    where: { connectedAt: 'now()' },
    select: { id: true, connectedAt: true, lastSeen: true },
  });

  let fixed = 0;
  for (const device of devices) {
    const fallback = new Date().toISOString();
    const validLastSeen = isValidISODate(device.lastSeen) ? device.lastSeen : null;
    const newConnectedAt = validLastSeen ?? fallback;

    await prisma.connectedDevice.update({
      where: { id: device.id },
      data: { connectedAt: newConnectedAt },
    });
    fixed++;
  }
  console.log(`  ConnectedDevice: fixed ${fixed}/${devices.length} rows`);
  return fixed;
}

async function main() {
  console.log('=== Fix "now()" literal strings in date fields ===\n');

  let totalFixed = 0;
  totalFixed += await fixCaptureItems();
  totalFixed += await fixProjects();
  totalFixed += await fixTemplates();
  totalFixed += await fixItemLinks();
  totalFixed += await fixConnectedDevices();

  console.log(`\n=== Done: ${totalFixed} total rows fixed ===`);

  // Verify no "now()" remains
  const remaining = await prisma.$queryRawUnsafe<{ count: number }[]>(
    `SELECT
       (SELECT COUNT(*) FROM CaptureItem WHERE createdAt = 'now()' OR updatedAt = 'now()') +
       (SELECT COUNT(*) FROM Project WHERE createdAt = 'now()' OR updatedAt = 'now()') +
       (SELECT COUNT(*) FROM Template WHERE createdAt = 'now()' OR updatedAt = 'now()') +
       (SELECT COUNT(*) FROM ItemLink WHERE createdAt = 'now()') +
       (SELECT COUNT(*) FROM ConnectedDevice WHERE connectedAt = 'now()')
     AS count`
  );

  const remainingCount = Number(remaining[0]?.count ?? 0);
  if (remainingCount > 0) {
    console.error(`\n⚠ WARNING: ${remainingCount} rows still have "now()" values!`);
    process.exit(1);
  } else {
    console.log('\n✓ Verification passed: no "now()" literals remain.');
  }
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
