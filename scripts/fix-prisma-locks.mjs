#!/usr/bin/env node

/**
 * Fix Prisma Query Engine File Lock Issues
 *
 * This script cleans up temporary Prisma query engine files
 * that can cause EPERM errors during development.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const prismaClientDir = path.join(projectRoot, 'node_modules', '.prisma', 'client');

console.log('🔧 Fixing Prisma query engine file locks...\n');

try {
  // Read the client directory
  const files = fs.readdirSync(prismaClientDir);

  // Find all temp query engine files
  const tempFiles = files.filter(f =>
    f.startsWith('query_engine-windows.dll.node.tmp')
  );

  if (tempFiles.length === 0) {
    console.log('✅ No temporary query engine files found.');
    console.log('   Prisma client is clean.\n');
    process.exit(0);
  }

  console.log(`📁 Found ${tempFiles.length} temporary file(s):\n`);
  tempFiles.forEach(f => console.log(`   - ${f}`));

  console.log('\n🧹 Cleaning up temporary files...\n');

  let removed = 0;
  let failed = 0;

  for (const file of tempFiles) {
    const filePath = path.join(prismaClientDir, file);
    try {
      fs.unlinkSync(filePath);
      console.log(`   ✅ Removed: ${file}`);
      removed++;
    } catch (err) {
      if (err.code === 'EBUSY' || err.code === 'EPERM') {
        console.log(`   ⚠️  Skipped (in use): ${file}`);
        console.log(`      💡 Stop all dev servers first, then run this script again.`);
        failed++;
      } else {
        console.log(`   ❌ Failed to remove: ${file}`);
        console.log(`      Error: ${err.message}`);
        failed++;
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Summary: ${removed} removed, ${failed} failed`);
  console.log('='.repeat(50));

  if (failed > 0) {
    console.log('\n💡 Tip: Some files could not be removed because they are in use.');
    console.log('   1. Stop all running Node/Next.js servers');
    console.log('   2. Run this script again: node scripts/fix-prisma-locks.mjs');
    console.log('   3. Then restart the dev server\n');
    process.exit(1);
  }

  console.log('\n✅ Prisma client cleaned successfully!');
  console.log('   You can now restart the dev server.\n');

} catch (err) {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
}
