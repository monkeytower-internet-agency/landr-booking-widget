/**
 * landr-6eita.1: iframe auto-height.
 *
 * The widget is embedded in an operator page via an <iframe> (WP plugin
 * shortcode, dashboard raw-iframe snippet). A fixed iframe height made the
 * widget scroll INSIDE the frame once the content outgrew it (e.g. adding 2-3
 * participants). When embedded, the widget now tells its parent how tall its
 * content is and the parent sizes the iframe to match:
 *
 *   window.parent.postMessage({ type: 'landr:resize', height }, '*')
 *
 * `height` is the integer CSS px height of the full document content. It is
 * posted whenever it changes (ResizeObserver, coalesced to one measurement per
 * animation frame) and never twice in a row with the same value. The target is
 * '*' on purpose — a height is not sensitive, and the widget cannot know the
 * embedding origin up front. The PARENT verifies event.source / event.origin
 * (landr-6eita contract).
 *
 * Content-height layout: the app shells carry `min-h-screen`, which inside an
 * iframe means "at least the iframe's height" — the measured height could
 * then only ever grow, never shrink back (a shorter step would leave the old
 * height behind). startAutoHeight therefore marks <html> with
 * `data-landr-embedded`; index.css resets those shells to `min-height: 0`
 * under that attribute (the `embedded:` variant) so the document is exactly
 * as tall as its content.
 *
 * Dialogs are `position: fixed`, so they add nothing to the document height.
 * An open dialog taller than the content would be clipped by the iframe, so
 * its height (plus a margin) counts as a floor on the posted height — and so
 * does its bottom edge (landr-tkgx8.3): once anchored lower down (below) or
 * grown after opening, a dialog shorter than the content can still reach
 * past the iframe's bottom. Portalled Radix popper content (Select / Popover
 * menus) is fixed-positioned outside #root as well and floors the height on
 * its bottom edge the same way. And once
 * the iframe is as tall as the widget, "centred in the viewport" means centred
 * in the whole widget — possibly far off the part of the host page the
 * customer is looking at. The widget cannot scroll a cross-origin parent
 * (Chrome ignores scrollIntoView across that boundary, verified), so a newly
 * opened dialog is instead centred on the customer's last interaction (the
 * pointer-down / focus that opened it), which is by definition on screen.
 *
 * Additive only: the staff-mode messages (landr:staff-init / staff-dirty /
 * booking-created) are untouched; a parent that doesn't listen for
 * landr:resize simply ignores it.
 */

export const RESIZE_MESSAGE_TYPE = 'landr:resize'

/** Marker attribute on <html> while the widget runs embedded. */
export const EMBEDDED_ATTR = 'data-landr-embedded'

/** Breathing room kept around an open dialog when it sets the height floor. */
const DIALOG_MARGIN_PX = 32

const DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"]'

/** Portalled Radix popper content (Select / Popover / DropdownMenu). */
const POPPER_SELECTOR = '[data-radix-popper-content-wrapper]'

/** Breathing room kept below open popper content. */
const POPPER_MARGIN_PX = 8

/** Everything outside #root's flow that the iframe must still fit. */
const OVERLAY_SELECTOR = `${DIALOG_SELECTOR}, ${POPPER_SELECTOR}`

/** The window globals startAutoHeight uses (injectable for tests). */
export type AutoHeightWindow = Window &
  Pick<
    typeof globalThis,
    'ResizeObserver' | 'MutationObserver' | 'Element' | 'HTMLElement'
  >

export interface ResizeMessage {
  type: typeof RESIZE_MESSAGE_TYPE
  height: number
}

/** True when the widget runs inside a frame (window.parent !== window). */
export function isEmbedded(win: Window): boolean {
  try {
    return win.parent !== win
  } catch {
    // A cross-origin parent can't throw on this comparison in practice, but
    // if a browser ever does, "we have a parent we can't inspect" means we
    // are embedded.
    return true
  }
}

/**
 * The integer CSS px height the iframe needs to show everything: the app
 * root's content height, floored by any open dialog or popper. Measured from
 * #root (not documentElement.scrollHeight, which never drops below the
 * viewport and would ratchet the iframe up forever).
 *
 * Overlays are fixed-positioned, so their rect is in iframe-viewport px —
 * exactly the iframe height needed to show their bottom edge.
 */
export function measureContentHeight(doc: Document): number {
  const root = doc.getElementById('root') ?? doc.body
  let height = Math.max(root.getBoundingClientRect().height, root.scrollHeight)
  doc.querySelectorAll(DIALOG_SELECTOR).forEach((el) => {
    const rect = el.getBoundingClientRect()
    height = Math.max(
      height,
      rect.height + DIALOG_MARGIN_PX * 2,
      rect.bottom + DIALOG_MARGIN_PX,
    )
  })
  doc.querySelectorAll(POPPER_SELECTOR).forEach((el) => {
    height = Math.max(height, el.getBoundingClientRect().bottom + POPPER_MARGIN_PX)
  })
  return Math.ceil(height)
}

/**
 * Start posting landr:resize to the parent. No-op (returns a no-op teardown)
 * when not embedded or when ResizeObserver is unavailable. Returns a teardown
 * that disconnects the observers and removes the <html> marker.
 */
export function startAutoHeight(win: AutoHeightWindow = window): () => void {
  if (!isEmbedded(win) || typeof win.ResizeObserver === 'undefined') {
    return () => {}
  }
  const doc = win.document
  doc.documentElement.setAttribute(EMBEDDED_ATTR, '')

  let lastPosted: number | null = null
  let frame = 0

  const post = () => {
    frame = 0
    const height = measureContentHeight(doc)
    // 0 = React hasn't rendered into #root yet; posting it would collapse the
    // iframe for a frame before the first real height arrives.
    if (height === 0 || height === lastPosted) return
    lastPosted = height
    const message: ResizeMessage = { type: RESIZE_MESSAGE_TYPE, height }
    win.parent.postMessage(message, '*')
  }
  const schedule = () => {
    if (frame) return
    frame = win.requestAnimationFrame(post)
  }

  // Viewport Y (= document Y: the embedded document never scrolls) of the
  // customer's last interaction outside a dialog — where a dialog it opens
  // gets centred.
  let anchorY: number | null = null
  const rememberAnchor = (event: Event) => {
    const target = event.target
    if (!(target instanceof win.Element) || target.closest(DIALOG_SELECTOR)) {
      return
    }
    const rect = target.getBoundingClientRect()
    anchorY = rect.top + rect.height / 2
  }
  doc.addEventListener('pointerdown', rememberAnchor, true)
  doc.addEventListener('focusin', rememberAnchor, true)
  const anchorDialog = (el: HTMLElement) => {
    if (anchorY === null) return
    // Keep the whole dialog inside the iframe; the dialog classes centre it
    // on `top` (translate-y-[-50%]).
    const half = el.getBoundingClientRect().height / 2 + DIALOG_MARGIN_PX
    const top = Math.min(
      Math.max(anchorY, half),
      Math.max(half, win.innerHeight - half),
    )
    el.style.top = `${Math.round(top)}px`
  }

  const resizeObserver = new win.ResizeObserver(schedule)
  resizeObserver.observe(doc.getElementById('root') ?? doc.body)

  // Moves don't resize: re-measure when an overlay's inline style changes
  // (the popper positioning itself, anchorDialog setting `top`).
  const styleObserver = new win.MutationObserver(schedule)

  // Dialog / popper portals mount as direct children of <body>, outside
  // #root, so the root observer never sees them open. Watch body's children
  // for portals, observe any overlay they carry (its content can change size
  // too) and centre a newly opened dialog where the customer is looking.
  const observedOverlays = new WeakSet<Element>()
  const mutationObserver = new win.MutationObserver(() => {
    doc.querySelectorAll(OVERLAY_SELECTOR).forEach((el) => {
      if (observedOverlays.has(el)) return
      observedOverlays.add(el)
      resizeObserver.observe(el)
      styleObserver.observe(el, { attributes: true, attributeFilter: ['style'] })
      if (el instanceof win.HTMLElement && el.matches(DIALOG_SELECTOR)) {
        anchorDialog(el)
      }
    })
    schedule()
  })
  mutationObserver.observe(doc.body, { childList: true })

  schedule()

  return () => {
    resizeObserver.disconnect()
    mutationObserver.disconnect()
    styleObserver.disconnect()
    doc.removeEventListener('pointerdown', rememberAnchor, true)
    doc.removeEventListener('focusin', rememberAnchor, true)
    if (frame) win.cancelAnimationFrame(frame)
    frame = 0
    doc.documentElement.removeAttribute(EMBEDDED_ATTR)
  }
}
