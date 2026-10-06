import { defineConfig, devices } from '@playwright/test'

/**
 * landr-t0do: deliberately tiny Playwright smoke net for the widget.
 *
 * Base URL defaults to the live dev deployment (bw-dev.landr.de — the
 * Cloudflare Pages build of this repo's `dev` branch, publicly reachable
 * from CI runners, see dalm/infrastructure/tofu/landr.tf). This is a
 * *smoke* test against the real dev stack (API + Supabase), not an
 * isolated preview build — the point is to catch the dev environment
 * actually breaking, seed data included.
 *
 * Override WIDGET_BASE_URL to point at a local `vite` dev/preview server
 * (e.g. http://localhost:5174 — see e2e/README below) while iterating.
 */
const baseURL = process.env.WIDGET_BASE_URL ?? 'https://bw-dev.landr.de'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // landr-xxh5r: the calendar layout guard is hermetic (API mocked in-spec)
  // and runs on a local vite server, on WebKit (iOS Safari) AND Chromium.
  webServer: {
    command: 'npx vite --port 5175 --strictPort',
    url: 'http://localhost:5175',
    reuseExistingServer: !process.env.CI,
    env: { VITE_USE_MOCKS: '0', VITE_API_BASE_URL: 'http://api.e2e.test' },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /calendar-layout\.spec\.ts/,
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 12 Pro Max'], baseURL: 'http://localhost:5175' },
      testMatch: /calendar-layout\.spec\.ts/,
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'], baseURL: 'http://localhost:5175' },
      testMatch: /calendar-layout\.spec\.ts/,
    },
  ],
})
