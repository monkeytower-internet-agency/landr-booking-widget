/**
 * landr-70jcy.3: compact build chip under the TierBadge pill (dev/staging only,
 * rendered by TierBadge): dot + sha7, "built ..." / "checked ..." lines. Amber
 * when a newer build is deployed; click reloads, but only while the guest is
 * on the landing/first step (never mid-booking).
 */
import { useEffect, useState, useSyncExternalStore } from 'react'

import { buildInfo } from '@/lib/buildInfo'
import { agoLabel, pickBuildBadgeBundle } from '@/lib/buildBadgeStrings'
import { browserLocale } from '@/lib/locale'
import {
  getVersionCheckSnapshot,
  installVersionCheck,
  reloadIfIdle,
  subscribeVersionCheck,
} from '@/lib/versionCheck'

const TICK_MS = 15_000

export function BuildChip() {
  const snap = useSyncExternalStore(subscribeVersionCheck, getVersionCheckSnapshot, getVersionCheckSnapshot)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    installVersionCheck()
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  const locale = browserLocale()
  const s = pickBuildBadgeBundle(locale)
  const nowMs = Math.max(now, snap.lastCheckedAt ?? 0)
  const info = buildInfo()
  const builtMs = info.builtAt ? new Date(info.builtAt).getTime() : NaN
  const built = Number.isNaN(builtMs) ? s.never : agoLabel(builtMs, nowMs, locale)
  const checked = snap.lastCheckedAt === null ? s.never : agoLabel(snap.lastCheckedAt, nowMs, locale)
  const update = snap.status === 'update-available'
  const hint = update ? (snap.idle ? s.updateAvailable : s.finishFirst) : ''
  const sha = info.id.slice(0, 7)

  return (
    <button
      type="button"
      data-testid="build-chip"
      data-status={snap.status}
      disabled={update && !snap.idle}
      title={hint || undefined}
      aria-label={[sha, s.built(built), s.checked(checked), hint].filter(Boolean).join('. ')}
      onClick={() => {
        if (update) reloadIfIdle()
      }}
      className={[
        'fixed top-9 left-2 z-[9999] pointer-events-auto',
        'flex items-start gap-1.5 rounded-md px-1.5 py-1 text-left text-[10px] leading-tight shadow-md',
        update ? 'bg-amber-400 text-amber-950' : 'bg-white/90 text-neutral-700',
        update && snap.idle ? 'cursor-pointer' : 'cursor-default',
      ].join(' ')}
    >
      <span
        data-testid="build-chip-dot"
        aria-hidden
        className={['mt-0.5 size-2 shrink-0 rounded-full', update ? 'bg-amber-700' : snap.status === 'up-to-date' ? 'bg-green-600' : 'bg-neutral-400'].join(' ')}
      />
      <span className="flex flex-col">
        <span className="font-mono">{sha}</span>
        <span data-testid="build-chip-built">{s.built(built)}</span>
        <span data-testid="build-chip-checked">{s.checked(checked)}</span>
      </span>
    </button>
  )
}
