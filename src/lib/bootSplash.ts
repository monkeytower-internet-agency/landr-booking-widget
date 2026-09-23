/**
 * landr-tkgx8.1: boot splash.
 *
 * index.html paints `#landr-boot` (a sibling of #root) straight from the HTML,
 * before the bundle, the operator settings or the first step's data have
 * loaded — a slow embed would otherwise sit blank for many seconds. Its inline
 * script shows the operator logo cached under `landr:logo:<token>` by an
 * earlier visit, else the Landr mark (/landr-mark.svg), and removes the splash
 * after a hard 8s timeout in case the app never reports ready.
 *
 * While the splash is in the DOM, index.html's CSS keeps #root display:none,
 * so the half-loaded step UI (default theme, empty catalogue) never flashes
 * underneath it; autoHeight measures #root, reads 0 and posts nothing, so the
 * iframe keeps the plugin's height meanwhile.
 *
 * This module is the app side of that contract: swap in the operator logo
 * once settings resolve (and keep the cache current), and remove the splash
 * once the first step has its data (BookingFlowApp's bootReady).
 */
import { useEffect } from 'react'

export const BOOT_SPLASH_ID = 'landr-boot'
export const BOOT_LOGO_ID = 'landr-boot-logo'
export const LOGO_CACHE_PREFIX = 'landr:logo:'

export function logoCacheKey(token: string): string {
  return LOGO_CACHE_PREFIX + token
}

/**
 * Show the operator's logo on the splash (while it is still up) and remember
 * it for the next visit's first paint. A null logo clears the cache so the
 * next boot shows the Landr mark rather than a logo the operator removed.
 * Storage can throw (sandboxed iframe, Safari private) — the cache is a
 * nicety, never an error.
 */
export function applyBootLogo(
  token: string,
  logoUrl: string | null,
  doc: Document = document,
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null = safeLocalStorage(),
): void {
  if (logoUrl) {
    const img = doc.getElementById(BOOT_LOGO_ID)
    if (img instanceof HTMLImageElement && img.getAttribute('src') !== logoUrl) {
      img.src = logoUrl
    }
  }
  try {
    if (logoUrl) storage?.setItem(logoCacheKey(token), logoUrl)
    else storage?.removeItem(logoCacheKey(token))
  } catch {
    // Storage blocked — the splash just falls back to the Landr mark.
  }
}

/** Remove the splash (idempotent); #root becomes visible with it gone. */
export function dismissBootSplash(doc: Document = document): void {
  doc.getElementById(BOOT_SPLASH_ID)?.remove()
}

/**
 * Report a step component's initial fetch as settled (data OR error) — the
 * `onLoaded` callback the first step hands down so the splash stays up until
 * there is something real to show.
 */
export function useReportLoaded(settled: boolean, onLoaded?: () => void): void {
  useEffect(() => {
    if (settled) onLoaded?.()
  }, [settled, onLoaded])
}

export interface BootReadiness {
  /** Operator settings fetch settled (resolved or failed). */
  settingsSettled: boolean
  /** `?invite=` link still resolving (the "Resolving your invite…" state). */
  inviteResolving: boolean
  stepName: string
  catalogMode: 'categories' | 'expanded'
  /** `?group=`/`?product=` deep link — the groups fetch is skipped. */
  deepLink: boolean
  /** listProductGroups settled (null state → false). */
  groupsSettled: boolean
  /** ProductList reported its products fetch settled. */
  productListLoaded: boolean
  /** ExpandedCatalog reported its products fetch settled. */
  expandedCatalogLoaded: boolean
  /** The pick-selection step renders a picker that fetches availability. */
  selectionNeedsData: boolean
  /** That picker reported its availability/windows fetch settled. */
  selectionLoaded: boolean
}

/**
 * True once the first step the customer will actually see has its data. The
 * catalogue entry waits for the groups fetch too, since it can still swap
 * pick-product for pick-category; a `?product=` deep link that lands on the
 * date picker waits for that picker's availability.
 */
export function isBootReady(r: BootReadiness): boolean {
  if (!r.settingsSettled || r.inviteResolving) return false
  switch (r.stepName) {
    case 'pick-category':
      return r.catalogMode === 'categories' || r.expandedCatalogLoaded
    case 'pick-product':
      return r.productListLoaded && (r.deepLink || r.groupsSettled)
    case 'pick-selection':
      return !r.selectionNeedsData || r.selectionLoaded
    default:
      return true
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}
