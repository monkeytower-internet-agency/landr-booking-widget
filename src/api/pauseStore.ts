/**
 * Off-season pause state. The public API answers a paused operator's
 * booking surface with `409 {"error": "operator_paused", "resume_on": "YYYY-MM-DD"}`
 * (either at the top level or nested under FastAPI's `detail`). The HTTP
 * layer records it here; `PausedGate` swaps the booking flow for a friendly
 * "back in season" screen. Module state + subscription, same shape as the UI
 * catalog version in lib/strings.ts, so any failing call anywhere trips it.
 */

export interface PauseInfo {
  /** ISO date (YYYY-MM-DD) the operator reopens, when the API said so. */
  resumeOn: string | null
}

let current: PauseInfo | null = null
const listeners = new Set<() => void>()

export function getPauseInfo(): PauseInfo | null {
  return current
}

export function subscribePause(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setPaused(info: PauseInfo | null): void {
  if (current === info) return
  if (current && info && current.resumeOn === info.resumeOn) return
  current = info
  listeners.forEach((l) => l())
}

/** Parse a 409 body; returns the pause info when it is an operator_paused answer. */
export function parsePausedBody(body: string): PauseInfo | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return null
  }
  const pick = (o: unknown): PauseInfo | null => {
    if (!o || typeof o !== 'object') return null
    const rec = o as Record<string, unknown>
    if (rec.error !== 'operator_paused') return null
    const r = rec.resume_on
    return { resumeOn: typeof r === 'string' && /^\d{4}-\d{2}-\d{2}/.test(r) ? r.slice(0, 10) : null }
  }
  const top = pick(parsed)
  if (top) return top
  if (parsed && typeof parsed === 'object' && 'detail' in parsed) {
    return pick((parsed as { detail: unknown }).detail)
  }
  return null
}
