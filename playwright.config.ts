import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.CV_ORIGIN ?? 'http://localhost:5173'
const startLocalDevServer = !process.env.CV_ORIGIN && process.env.CV_SKIP_WEB_SERVER !== '1'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  ...(startLocalDevServer ? {
    webServer: {
      command: 'npm run dev',
      url: baseURL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  } : {}),
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
})
