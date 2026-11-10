/**
 * GET /version.json on the Vite dev server: answers with the checkout's live
 * HEAD (builds emit version.json as an asset; the dev server has none).
 * Vite-import-free so it is unit-testable.
 */
export const DEV_VERSION_PATH = '/version.json'
const CACHE_MS = 5_000

interface ResLike {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body: string): void
}
interface ReqLike {
  method?: string
  url?: string
}

export interface DevVersionOptions {
  /** HEAD of the checkout; null when git is unavailable. */
  getHead: () => string | null
  version: string
  builtAt: string
  now?: () => number
}

export function createDevVersionHandler(opts: DevVersionOptions) {
  const now = opts.now ?? Date.now
  let cached: { id: string; at: number } | null = null
  const head = (): string => {
    const t = now()
    if (cached && t - cached.at < CACHE_MS) return cached.id
    // Git unavailable: keep the last known id (never invent one, that would flag a false update).
    const id = opts.getHead() ?? cached?.id ?? ''
    cached = { id, at: t }
    return id
  }
  return (req: ReqLike, res: ResLike, next: () => void): void => {
    const path = (req.url ?? '').split('?')[0]
    if (path !== DEV_VERSION_PATH || (req.method && req.method !== 'GET')) return next()
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.end(JSON.stringify({ buildId: head(), version: opts.version, builtAt: opts.builtAt }))
  }
}
