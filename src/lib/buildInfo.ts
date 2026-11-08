// Identity of the bundle this tab runs. Dev server: the live HEAD stamped into
// index.html wins over the define constants (frozen at dev-server start).
// typeof guards: vitest has no vite `define`.
export interface BuildInfo {
  id: string
  builtAt: string
}

export function buildInfo(): BuildInfo {
  const live = typeof window !== 'undefined' ? window.__LANDR_BUILD__ : undefined
  if (live?.buildId) return { id: live.buildId, builtAt: live.builtAt }
  return {
    id: typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'unknown',
    builtAt: typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '',
  }
}
