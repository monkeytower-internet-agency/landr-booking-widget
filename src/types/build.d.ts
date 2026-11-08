// Build identity injected by vite.config.ts (define). Absent under vitest.
declare const __BUILD_ID__: string
declare const __BUILD_TIME__: string
declare const __APP_VERSION__: string

interface Window {
  /** Dev server only: live checkout HEAD stamped into index.html. */
  __LANDR_BUILD__?: { buildId: string; builtAt: string }
}
