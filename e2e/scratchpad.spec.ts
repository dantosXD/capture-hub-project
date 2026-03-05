import { test, expect } from '@playwright/test';

test('Scratchpad has new UI elements', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Open Scratchpad
    await page.click('[id="capture-hub"]'); // Assuming the FloatingHub has an ID or we can find the trigger
    await page.click('text="Scratchpad"');

    // 1. Verify Templates and Maximize buttons exist
    const templateBtn = page.getByRole('button', { name: /Templates/i });
    await expect(templateBtn).toBeVisible({ timeout: 5000 });

    const maximizeBtn = page.getByTitle(/Toggle Fullscreen/i);
    await expect(maximizeBtn).toBeVisible();

    // 2. Verify 3 tabs exist
    await expect(page.getByRole('tab', { name: /Edit/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Split/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Preview/i })).toBeVisible();

    // 3. Verify Formatting Toolbar (bold, italic, etc)
    await expect(page.getByTitle(/Bold \(Cmd\+B\)/i)).toBeVisible();
    await expect(page.getByTitle(/Italic \(Cmd\+I\)/i)).toBeVisible();
});
