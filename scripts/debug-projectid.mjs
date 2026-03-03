const API_BASE = 'http://127.0.0.1:3000';

async function main() {
  // Create project
  const projectRes = await fetch(`${API_BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Debug Project',
      color: '#6366f1',
    }),
  });
  const projectData = await projectRes.json();
  const project = projectData.project;
  console.log('Project created:', project.id);

  // Create item
  const itemRes = await fetch(`${API_BASE}/api/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'note',
      title: 'Debug Item',
      content: 'Test',
    }),
  });
  const item = await itemRes.json();
  console.log('Item created:', item.id);

  // Update with projectId
  const assignRes = await fetch(`${API_BASE}/api/inbox/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ids: [item.id],
      projectId: project.id,
    }),
  });
  console.log('Assign response status:', assignRes.status);
  const assignData = await assignRes.json();
  console.log('Assign response:', JSON.stringify(assignData, null, 2));
  console.log('Item projectId:', assignData.items?.[0]?.projectId);
  console.log('Expected:', project?.id);

  // Cleanup
  if (project?.id) {
    await fetch(`${API_BASE}/api/projects/${project.id}`, { method: 'DELETE' });
  }
  await fetch(`${API_BASE}/api/capture/${item.id}`, { method: 'DELETE' });
}

main().catch(console.error);
