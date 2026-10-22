import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // The browser tests are shared with the Vue example: both must behave the same.
  testDir: '../shared/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, grepInvert: /@perf/ },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grepInvert: /@perf/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, grepInvert: /@perf/ },
    // Timing checks run alone, after the functional tests, so parallel workers don't skew them.
    { name: 'perf', use: { ...devices['Desktop Chrome'] }, grep: /@perf/, dependencies: ['chromium'] },
  ],
  webServer: {
    command: 'pnpm build && pnpm preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
