import { buildInfo } from '@/lib/buildInfo'
import { getTier } from '@/lib/tier'

// Build self-check for the dev/staging badge. Each tier serves its own
// /version.json (no-store); a tab compares its baked-in build id with it on
// focus and every 60 s. External store (useSyncExternalStore friendly).
// Reload is never automatic and never mid-booking: the guest's own click does
// it, and only while the booking flow reports idle (landing / first step).

const INTERVAL_MS = 60_000

export type VersionStatus = 'up-to-date' | 'update-available' | 'checking' | 'unknown'

export interface VersionCheckState {
  current: string
  remote: string | null
  lastCheckedAt: number | null
  status: VersionStatus
  /** True while the guest is on the landing/first step (safe to reload). */
  idle: boolean
}

export async function fetchRemoteBuildId(): Promise<string | null> {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' })
    if (!res.ok) return null
    const body = (await res.json()) as { buildId?: unknown }
    return typeof body.buildId === 'string' && body.buildId ? body.buildId : null
  } catch {
    return null
  }
}

let state: VersionCheckState = { current: buildInfo().id, remote: null, lastCheckedAt: null, status: 'unknown', idle: false }
const listeners = new Set<() => void>()

function setState(patch: Partial<VersionCheckState>): void {
  state = { ...state, ...patch } // new object per change: stable snapshot between changes
  listeners.forEach((l) => l())
}

export function subscribeVersionCheck(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getVersionCheckSnapshot(): VersionCheckState {
  return state
}

/** The booking flow reports whether a reload would lose the guest's progress. */
export function setBookingIdle(idle: boolean): void {
  if (state.idle !== idle) setState({ idle })
}

/** Test-only reset. */
export function resetVersionCheckForTests(current: string = buildInfo().id): void {
  state = { current, remote: null, lastCheckedAt: null, status: 'unknown', idle: false }
  listeners.forEach((l) => l())
}

export async function checkNow(): Promise<void> {
  if (state.status === 'checking') return
  const previous = state.status
  setState({ status: 'checking' })
  const remote = await fetchRemoteBuildId()
  const lastCheckedAt = Date.now()
  if (!remote) {
    setState({ lastCheckedAt, status: previous === 'update-available' ? 'update-available' : 'unknown' })
    return
  }
  setState({ remote, lastCheckedAt, status: remote === state.current ? 'up-to-date' : 'update-available' })
}

/** Reload to pick up the new build; refuses while the guest is mid-booking. */
export function reloadIfIdle(): boolean {
  if (!state.idle) return false
  window.location.reload()
  return true
}

let installed = false

/** Dev/staging only; prod never polls. */
export function installVersionCheck(): void {
  const tier = getTier()
  if (installed || (tier !== 'dev' && tier !== 'staging')) return
  installed = true
  const check = () => {
    if (document.visibilityState === 'visible') void checkNow()
  }
  document.addEventListener('visibilitychange', check)
  window.addEventListener('focus', check)
  window.setInterval(check, INTERVAL_MS)
  check()
}
