/**
 * landr-a5i49.3 — widget colour mode (light / dark / auto).
 *
 * Precedence, first that is set wins:
 *   1. the visitor's own pick from the sun/moon switcher (operator setting
 *      widget_color_switcher; remembered in localStorage)
 *   2. the embed URL's `?theme=light|dark|auto` (one embed differs from the
 *      operator default)
 *   3. the operator's widget_color_mode (dashboard Settings → Embed)
 *   4. light
 *
 * `auto` follows the visitor's OS (prefers-color-scheme). An iframe can't see
 * the host page's colours, so a site that is dark on every screen wants
 * `dark`, not `auto`.
 *
 * Dark is applied by putting `.dark` on <html> (index.css's dark tokens + the
 * `dark:` variants) and setting `color-scheme` so native controls match.
 * <html>, not the widget root, so Radix portals on <body> are dark too.
 */

import { useSyncExternalStore } from 'react'

export type ColorMode = 'light' | 'dark' | 'auto'

/** A valid mode, or null for absent / unknown values (= "not set"). */
export function parseColorMode(raw: string | null | undefined): ColorMode | null {
  const v = (raw ?? '').trim().toLowerCase()
  return v === 'light' || v === 'dark' || v === 'auto' ? v : null
}

const DARK_QUERY = '(prefers-color-scheme: dark)'
const STORAGE_KEY = 'landr:widget-color-mode'
/** Last-seen operator mode per widget token, for a dark first paint. */
const operatorKey = (token: string) => `landr:widget-operator-color-mode:${token}`

export function resolveIsDark(mode: ColorMode, prefersDark: boolean): boolean {
  return mode === 'dark' || (mode === 'auto' && prefersDark)
}

/** Pure precedence rule (see module doc). */
export function effectiveColorMode(sources: {
  visitor: ColorMode | null
  url: ColorMode | null
  operator: ColorMode | null
}): ColorMode {
  return sources.visitor ?? sources.url ?? sources.operator ?? 'light'
}

const state = {
  visitor: null as ColorMode | null,
  url: null as ColorMode | null,
  operator: null as ColorMode | null,
  prefersDark: false,
}
let isDark = false
let mediaBound = false
const listeners = new Set<() => void>()

function readStored(key: string): ColorMode | null {
  try {
    return parseColorMode(window.localStorage.getItem(key))
  } catch {
    return null
  }
}

function writeStored(key: string, mode: ColorMode | null) {
  try {
    if (mode) window.localStorage.setItem(key, mode)
    else window.localStorage.removeItem(key)
  } catch {
    // Storage blocked (third-party iframe, private mode): the value still
    // holds for this page view.
  }
}

function apply() {
  const next = resolveIsDark(effectiveColorMode(state), state.prefersDark)
  const root = document.documentElement
  root.classList.toggle('dark', next)
  root.style.colorScheme = next ? 'dark' : 'light'
  if (next === isDark) return
  isDark = next
  listeners.forEach((l) => l())
}

/**
 * Read `?theme=` and any remembered visitor pick, apply, and follow OS
 * changes. Call once before mount.
 */
export function startColorMode(search: string = window.location.search): void {
  const params = new URLSearchParams(search)
  state.url = parseColorMode(params.get('theme'))
  state.visitor = readStored(STORAGE_KEY)
  const token = params.get('w')
  state.operator = token ? readStored(operatorKey(token)) : null
  if (typeof window.matchMedia === 'function') {
    const mq = window.matchMedia(DARK_QUERY)
    state.prefersDark = mq.matches
    if (!mediaBound) {
      mediaBound = true
      mq.addEventListener?.('change', (e) => {
        state.prefersDark = e.matches
        apply()
      })
    }
  }
  apply()
}

/**
 * The operator's saved widget_color_mode, once settings have loaded. Cached
 * per widget token so the next visit paints in the right mode immediately.
 */
export function setOperatorColorMode(raw: string | null | undefined, token?: string | null): void {
  state.operator = parseColorMode(raw)
  if (token) writeStored(operatorKey(token), state.operator)
  apply()
}

/**
 * The visitor's own pick (switcher, demo toggle): wins over everything and is
 * remembered for their next visit.
 */
export function setDark(next: boolean): void {
  state.visitor = next ? 'dark' : 'light'
  writeStored(STORAGE_KEY, state.visitor)
  apply()
}

/** Test hook: forget every source. */
export function resetColorModeForTests(): void {
  state.visitor = state.url = state.operator = null
  state.prefersDark = false
  try {
    window.localStorage.clear()
  } catch {
    /* ignore */
  }
  apply()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** True while the widget renders dark. */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isDark,
    () => false,
  )
}
