#!/usr/bin/env node

/**
 * Deep Clean Prisma Client
 *
 * This script removes and reinstalls the Prisma client to fix file lock issues.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const prismaClientDir = path.join(projectRoot, 'node_modules', '.prisma', 'client');

console.log('🧹 Deep cleaning Prisma client...\n');

// Step 1: Kill any remaining processes
console.log('Step 1: Ensuring all Node processes are stopped...');

try {
  const killResult = execSync('taskkill /F /IM node.exe 2>&1', {
    encoding: 'utf-8',
    stdio: 'pipe',
    shell: true
  });
  console.log('   ✅ Node processes terminated\n');
} catch (err) {
  console.log('   ℹ️  No Node processes found (or already terminated)\n');
}

// Step 2: Wait for file handles to be released
console.log('Step 2: Waiting for file handles to be released...');
const startTime = Date.now();
while (Date.now() - startTime < 3000) {
  // Busy wait for 3 seconds
}
console.log('   ✅ Wait complete\n');

// Step 3: Delete the entire Prisma client directory
console.log('Step 3: Removing Prisma client directory...');
if (fs.existsSync(prismaClientDir)) {
  try {
    fs.rmSync(prismaClientDir, { recursive: true, force: true });
    console.log('   ✅ Prisma client directory removed\n');
  } catch (err) {
    console.log(`   ⚠️  Could not remove: ${err.message}\n`);
  }
} else {
  console.log('   ℹ️  Directory does not exist\n');
}

// Step 4: Reinstall Prisma
console.log('Step 4: Reinstalling Prisma packages...');
try {
  execSync('bun install --force @prisma/client prisma', {
    encoding: 'utf-8',
    stdio: 'inherit',
    cwd: projectRoot,
    shell: true
  });
  console.log('\n   ✅ Prisma packages reinstalled\n');
} catch (err) {
  console.log('\n   ⚠️  Reinstall had issues\n');
}

// Step 5: Generate Prisma client
console.log('Step 5: Generating Prisma client...');
try {
  execSync('bun prisma generate', {
    encoding: 'utf-8',
    stdio: 'inherit',
    cwd: projectRoot,
    shell: true
  });
  console.log('\n   ✅ Prisma client generated\n');
} catch (err) {
  console.log('\n   ⚠️  Generation had issues\n');
}

console.log('✅ Deep clean complete!');
console.log('   You can now run: bun run dev\n');
