import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:4175', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'pnpm sync-server', port: 4174, reuseExistingServer: !process.env.CI },
    { command: 'pnpm build && pnpm preview', url: 'http://localhost:4175', reuseExistingServer: !process.env.CI, timeout: 120_000 },
  ],
});
