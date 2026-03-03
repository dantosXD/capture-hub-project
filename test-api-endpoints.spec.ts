import { test, expect } from '@playwright/test';

test.describe('API Endpoint Tests', () => {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

  test('GET /api/capture - should return valid JSON', async ({ page }) => {
    // Navigate to the API endpoint
    await page.goto(`${baseUrl}/api/capture`);

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Take a screenshot
    await page.screenshot({ path: 'api-capture-response.png' });

    // Get the page content
    const content = await page.content();

    // Try to get the text content (API responses are usually plain text/JSON)
    const textContent = await page.innerText('body');

    console.log('=== /api/capture Response ===');
    console.log('Status:', page.url());
    console.log('Content length:', textContent.length);
    console.log('First 500 chars:', textContent.substring(0, 500));

    // Verify it's valid JSON
    try {
      const json = JSON.parse(textContent);
      console.log('Valid JSON: YES');
      console.log('Has items key:', 'items' in json);
      console.log('Has pagination key:', 'pagination' in json);
      console.log('Items count:', json.items?.length || 0);

      if (json.items && json.items.length > 0) {
        console.log('First item structure:', JSON.stringify(json.items[0], null, 2).substring(0, 300));
      }

      expect(json).toHaveProperty('items');
      expect(json).toHaveProperty('pagination');
    } catch (e) {
      console.log('Valid JSON: NO');
      console.log('Parse error:', e);
      throw new Error('Response is not valid JSON');
    }
  });

  test('GET /api/projects - should return valid JSON', async ({ page }) => {
    // Navigate to the API endpoint
    await page.goto(`${baseUrl}/api/projects`);

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Take a screenshot
    await page.screenshot({ path: 'api-projects-response.png' });

    // Get the text content
    const textContent = await page.innerText('body');

    console.log('=== /api/projects Response ===');
    console.log('Status:', page.url());
    console.log('Content length:', textContent.length);
    console.log('First 500 chars:', textContent.substring(0, 500));

    // Verify it's valid JSON
    try {
      const json = JSON.parse(textContent);
      console.log('Valid JSON: YES');
      console.log('Has projects key:', 'projects' in json);
      console.log('Projects count:', json.projects?.length || 0);

      if (json.projects && json.projects.length > 0) {
        console.log('First project structure:', JSON.stringify(json.projects[0], null, 2).substring(0, 300));
      }

      expect(json).toHaveProperty('projects');
    } catch (e) {
      console.log('Valid JSON: NO');
      console.log('Parse error:', e);
      throw new Error('Response is not valid JSON');
    }
  });

  test('GET /api/health - should show database tables', async ({ page }) => {
    // Navigate to the API endpoint
    await page.goto(`${baseUrl}/api/health`);

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Take a screenshot
    await page.screenshot({ path: 'api-health-response.png' });

    // Get the text content
    const textContent = await page.innerText('body');

    console.log('=== /api/health Response ===');
    console.log('Status:', page.url());
    console.log('Content length:', textContent.length);
    console.log('Full response:', textContent);

    // Verify it's valid JSON
    try {
      const json = JSON.parse(textContent);
      console.log('Valid JSON: YES');
      console.log('Status:', json.status);
      console.log('Database status:', json.database?.status);
      console.log('Database tables:', json.database?.tables);
      console.log('WebSocket status:', json.websocket?.status);
      console.log('Connected devices:', json.websocket?.connectedDevices);

      expect(json).toHaveProperty('status');
      expect(json).toHaveProperty('database');
      expect(json.database).toHaveProperty('tables');
    } catch (e) {
      console.log('Valid JSON: NO');
      console.log('Parse error:', e);
      throw new Error('Response is not valid JSON');
    }
  });
});
