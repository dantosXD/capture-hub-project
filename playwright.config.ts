import { defineConfig } from '@playwright/test';

const traceMode = process.env.PLAYWRIGHT_TRACE_MODE === 'on' ? 'on' : 'off';
const videoMode = process.env.PLAYWRIGHT_VIDEO_MODE === 'on' ? 'on' : 'off';

export default defineConfig({
  testDir: '.',
  testMatch: ['test-api-endpoints.spec.ts', 'test-ui.spec.ts'],
  timeout: 90000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: traceMode,
    video: videoMode,
    navigationTimeout: 60000,
    actionTimeout: 15000,
  },
});
