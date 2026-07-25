import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/site-e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/serve-site.mjs',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
})
