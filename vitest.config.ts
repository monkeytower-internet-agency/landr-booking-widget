import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const shared = {
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}

const sharedTest = {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/test/setup.ts'],
  css: false,
} as const

// `*.tz.test.tsx` files run once per non-UTC browser timezone (the `tz-*`
// projects). They use the forks pool: worker_threads fix their timezone at
// startup and ignore a TZ set later, so only a process-per-file pool honours
// it. Projects do not extend the root test config (`extends: true` would
// MERGE the root `include`, running the whole suite once per timezone).
const TZ_FILES = 'src/**/*.tz.test.tsx'

export default defineConfig({
  ...shared,
  test: {
    projects: [
      {
        ...shared,
        test: {
          ...sharedTest,
          name: 'unit',
          // Prevent vitest from sweeping .claude/worktrees — same fix as dashboard PR #257.
          include: ['src/**/*.test.{ts,tsx}', 'functions/**/*.test.ts', 'scripts/**/*.test.mjs'],
          exclude: ['**/node_modules/**', TZ_FILES],
        },
      },
      ...['Pacific/Auckland', 'America/Los_Angeles'].map((tz) => ({
        ...shared,
        test: {
          ...sharedTest,
          name: `tz-${tz}`,
          include: [TZ_FILES],
          pool: 'forks' as const,
          env: { TZ: tz },
        },
      })),
    ],
  },
})
