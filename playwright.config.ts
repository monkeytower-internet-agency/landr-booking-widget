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
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
