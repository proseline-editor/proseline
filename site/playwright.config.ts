import { defineConfig, devices } from '@playwright/test';

// Smoke tests of the built site (`pnpm docs:build` first). Paths are relative, so they also run against a
// build for a sub-path (DOCS_BASE=/proseline/, as on GitHub Pages).
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:4183${process.env.DOCS_BASE ?? '/'}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'pnpm preview', url: `http://localhost:4183${process.env.DOCS_BASE ?? '/'}`, reuseExistingServer: !process.env.CI },
});
