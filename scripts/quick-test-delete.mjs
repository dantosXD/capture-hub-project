#!/usr/bin/env bun
// Quick test for DELETE endpoint core functionality

const API_BASE = 'http://127.0.0.1:3000';

async function main() {
  console.log('Testing DELETE endpoint core functionality...\n');

  // Create item
  console.log('1. Creating test item...');
  const createRes = await fetch(`${API_BASE}/api/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'note',
      title: 'FINAL_TEST_21_DELETE',
      content: 'Testing feature 21',
    }),
  });
  const created = await createRes.json();
  console.log(`   Created: id=${created.id}, title=${created.title}`);

  // Verify exists
  console.log('\n2. Verifying item exists...');
  const getBefore = await fetch(`${API_BASE}/api/capture/${created.id}`);
  const beforeData = await getBefore.json();
  console.log(`   Found: id=${beforeData.id}, title=${beforeData.title}`);

  // Delete
  console.log('\n3. Deleting item...');
  const deleteRes = await fetch(`${API_BASE}/api/capture/${created.id}`, {
    method: 'DELETE',
  });
  const deleteResult = await deleteRes.json();
  console.log(`   Result: ${JSON.stringify(deleteResult)}`);

  // Verify gone
  console.log('\n4. Verifying item is deleted...');
  const getAfter = await fetch(`${API_BASE}/api/capture/${created.id}`);
  console.log(`   Status: ${getAfter.status} (should be 404)`);

  if (getAfter.status === 404 && deleteResult.success) {
    console.log('\n✅ DELETE endpoint works correctly!');
  } else {
    console.log('\n❌ DELETE endpoint has issues!');
    process.exit(1);
  }
}

main().catch(console.error);
