/**
 * Sanitizer for after-booking rich text (landr-nva1a.4 review round).
 * The API already sanitizes on save (`app/services/html_sanitize.py`) —
 * this is defence in depth before the content ever reaches
 * `dangerouslySetInnerHTML`, plus two behaviours the API's own
 * sanitizer doesn't need to care about because it never renders the
 * content itself:
 *
 * 1. DOMPurify's default allowlist does not force `target`/`rel` on
 *    anchors — a link authored via the dashboard's tiptap editor with no
 *    explicit target opens IN PLACE. Inside the WordPress iframe embed
 *    that's most of this widget's deployment, navigating in place
 *    destroys the success screen (and the iframe has no way back). Every
 *    surviving `<a href>` gets `target="_blank" rel="noopener noreferrer"`
 *    forced via an `afterSanitizeAttributes` hook — unconditionally, not
 *    just when the source HTML omitted one.
 * 2. `href` is restricted to http(s)/mailto/tel — anything else
 *    (`javascript:`, `data:`, a bare relative path that would resolve
 *    against the iframe's own origin, …) is stripped from the anchor
 *    entirely rather than merely left unclickable.
 *
 * ALLOWED_TAGS/ALLOWED_ATTR are scoped to the tiptap output set the
 * dashboard's RichTextEditor can actually produce (landr-nva1a.3) —
 * no `style`, `form`, `input`, or anything else DOMPurify's own default
 * (broader, general-purpose HTML) allowlist would otherwise let through.
 *
 * The hook is added once, at module load, on the shared DOMPurify
 * instance — this file is the ONLY caller of DOMPurify in the widget, so
 * there's no other consumer for the hook to leak into.
 */
import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'a',
]

const ALLOWED_ATTR = ['href', 'target', 'rel']

const ALLOWED_HREF_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])

function isAllowedHref(href: string): boolean {
  try {
    // No base: a relative/protocol-relative href throws here (no scheme),
    // which is exactly what we want to drop.
    return ALLOWED_HREF_SCHEMES.has(new URL(href).protocol)
  } catch {
    return false
  }
}

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName !== 'A') return
  const href = node.getAttribute('href')
  if (!href || !isAllowedHref(href)) {
    node.removeAttribute('href')
    return
  }
  node.setAttribute('target', '_blank')
  node.setAttribute('rel', 'noopener noreferrer')
})

/** Sanitize one after-booking HTML blob for `dangerouslySetInnerHTML`. */
export function sanitizePostBookingHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
}
