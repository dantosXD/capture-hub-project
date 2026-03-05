const { chromium } = require('playwright');

(async () => {
    // We launch chromium with WebAuthn mock enabled
    const browser = await chromium.launch({ headless: true });

    // Create an incognito context
    const context = await browser.newContext();

    const page = await context.newPage();

    // Setup Virtual Authenticator (Mock Passkey hardware)
    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send('WebAuthn.enable');
    await cdpSession.send('WebAuthn.addVirtualAuthenticator', {
        options: {
            protocol: 'ctap2',
            transport: 'internal',
            hasResidentKey: true,
            hasUserVerification: true,
            isUserVerified: true // Mock that the user successfully touched the biometric sensor
        }
    });

    console.log('[Playwright E2E] Virtual Authenticator Added');

    try {
        await page.goto('http://127.0.0.1:3000/auth_client.html');

        // Emulate user input
        await page.fill('#username', 'test_zero_trust_user');

        // Emulate passkey registration
        console.log('[Playwright E2E] Clicking Register...');
        await page.click('#registerBtn');

        // Wait for success status
        await page.waitForSelector('#status:has-text("Passkey Registration Successful!")', { timeout: 5000 });
        console.log('[Playwright E2E] ✅ Registration Verification Passed');

        // Clear status manually for visual clean up before login
        await page.evaluate(() => document.getElementById('status').innerText = '');

        // Emulate passkey login
        console.log('[Playwright E2E] Clicking Login...');
        await page.click('#loginBtn');

        await page.waitForSelector('#status:has-text("Login Successful! Access Granted.")', { timeout: 5000 });
        console.log('[Playwright E2E] ✅ Login Authentication Passed');

        // Screenshot for visual gate verification
        await page.screenshot({ path: 'zero-trust-success.png' });
        console.log('[Playwright E2E] Screenshot saved: zero-trust-success.png');

    } catch (e) {
        console.error('[Playwright E2E] ❌ Test Failed:', e);
    } finally {
        await browser.close();
    }
})();
