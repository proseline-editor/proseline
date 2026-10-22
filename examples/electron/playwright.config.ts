import { defineConfig } from '@playwright/test';

// Tests launch the Electron app themselves (no web server); `pnpm e2e` builds the renderer first.
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: { trace: 'retain-on-failure' },
});
