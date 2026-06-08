/**
 * landr-aoak.2 [S3]: staff / agent mode for the embedded booking widget.
 *
 * The widget is embedded in the operator dashboard (landr-aoak.3) inside an
 * authenticated "staff" iframe. In that mode an operator books ON BEHALF of a
 * customer and gains two operator-only powers the customer widget never has:
 *   - force-book a blocked / full day or fixed-date window (ignore_capacity),
 *   - override the gross total at create time (override_gross_total + reason).
 *
 * SECURITY MODEL: the powers are gated server-side (landr-aoak.1) behind a
 * short-lived SIGNED `staff_session` token. The widget merely CARRIES the token
 * and exposes the operator-only affordances; a public widget_token submit can
 * NEVER reach any of these branches because no staff session is present.
 *
 * THE INVARIANT (ticket ABSOLUTE REQUIREMENT): with NO staff session the widget
 * behaves 100% byte-identically to today. Every staff branch in the UI is gated
 * behind the single `useStaffMode().active` signal that this module resolves
 * ONCE at boot. This file holds the pure window-reading logic PLUS the React
 * context + `useStaffMode` hook (mirrors variant.ts: the .ts file may export the
 * context + hook; the StaffModeProvider component lives in staffMode.tsx so the
 * react-refresh/only-export-components lint gate stays happy).
 */
import { createContext, useContext } from 'react'

/**
 * The operator-only powers a staff session may carry. Mirrors the epic [S1]
 * `powers:[force_book, price_override, skip_customer_email]` claim list. The
 * widget reads these to decide which affordances to surface; the server is the
 * real authority (a token without `force_book` cannot force-book even if the
 * widget rendered the button). Absent / unknown powers default to "all on" so
 * an older mint endpoint can never silently hide an affordance — the server
 * still rejects anything the token doesn't actually authorise.
 */
export type StaffPower = 'force_book' | 'price_override' | 'skip_customer_email'

export const ALL_STAFF_POWERS: readonly StaffPower[] = [
  'force_book',
  'price_override',
  'skip_customer_email',
]

export interface StaffSession {
  /** Whether a staff session is active. When false the widget is 100% normal. */
  active: boolean
  /**
   * The opaque, server-signed session token. Carried verbatim on submit
   * (see staffSubmitAdapter). Null when no session is active.
   */
  token: string | null
  /** Operator-only powers this session claims. Empty when inactive. */
  powers: readonly StaffPower[]
  /**
   * The operator UUID this session is scoped to (landr-aoak.4). REQUIRED to
   * build the staff submit path POST /api/staff/operators/{operator_id}/
   * bookings/submit. Resolved from the staff-init message's explicit
   * `operator_id` when present, otherwise decoded from the (opaque) token's
   * own signed payload (`operator_id`). Null when inactive OR when the token
   * payload could not be decoded (in which case the widget cannot route the
   * staff submit and falls back — see staffSubmitAdapter).
   */
  operatorId: string | null
}

export const INACTIVE_STAFF_SESSION: StaffSession = {
  active: false,
  token: null,
  powers: [],
  operatorId: null,
}

/**
 * Decode the `operator_id` embedded in a signed staff session token WITHOUT
 * verifying the signature (the server is the sole signature authority — see
 * landr-aoak.1). The token format (aoak.1 [S1]) is:
 *
 *   <b64url(payload_json)>.<sig_hex>
 *
 * where the canonical payload JSON carries `operator_id`. We read it only to
 * build the operator-scoped staff submit PATH; tampering is irrelevant here
 * because the server re-verifies the HMAC and binds the session to the path
 * operator anyway (a mismatch → 403). Returns null on any malformation so the
 * caller can fall back gracefully. The token stays opaque to the rest of the
 * widget — this is the one place that peeks inside it.
 */
export function operatorIdFromStaffToken(token: string): string | null {
  if (!token) return null
  const dot = token.indexOf('.')
  const payloadB64 = dot === -1 ? token : token.slice(0, dot)
  if (!payloadB64) return null
  try {
    // base64url → base64, then decode. atob is available in browsers + jsdom.
    const b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const json = atob(b64 + pad)
    const payload: unknown = JSON.parse(json)
    if (payload && typeof payload === 'object') {
      const opId = (payload as Record<string, unknown>).operator_id
      if (typeof opId === 'string' && opId.length > 0) return opId
    }
  } catch {
    // Malformed token / payload — fall through to null.
  }
  return null
}

const STAFF_SESSION_PARAM = 'staff_session'

/**
 * Parse a `?staff_session=<token>` query string into a StaffSession. PURE —
 * takes the raw search string so it is testable without a window. An empty /
 * missing token yields the inactive session (the byte-identical normal path).
 *
 * Powers are intentionally NOT encoded in the URL: the token is opaque to the
 * widget and the server is the authority. We surface ALL_STAFF_POWERS so every
 * affordance is available client-side; the server enforces the real claim set
 * (and rejects any power the signed token doesn't actually carry). When the
 * dashboard later mints a token with a narrower claim list it can pass the
 * powers via the postMessage init (see staffInitFromMessage) to hide
 * affordances the operator isn't allowed to use.
 */
export function parseStaffSession(search: string): StaffSession {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  )
  const token = params.get(STAFF_SESSION_PARAM)?.trim()
  if (!token) return INACTIVE_STAFF_SESSION
  // operator_id is decoded from the token payload (the URL entry path carries
  // no separate operator_id field). Needed to build the staff submit path.
  return {
    active: true,
    token,
    powers: ALL_STAFF_POWERS,
    operatorId: operatorIdFromStaffToken(token),
  }
}

/**
 * Resolve the staff session from the live URL at boot. Guards non-browser
 * (test/SSR) environments where `window` is absent — there it is always
 * inactive, preserving the normal path.
 */
export function staffSessionFromLocation(): StaffSession {
  if (typeof window === 'undefined') return INACTIVE_STAFF_SESSION
  return parseStaffSession(window.location.search)
}

/**
 * The postMessage init the dashboard parent (landr-aoak.3) sends to hand the
 * widget a freshly-minted staff session without putting the token in the URL.
 * Shape PINNED for the dashboard worker:
 *   { type: 'landr:staff-init', token: string, powers?: StaffPower[] }
 */
export interface StaffInitMessage {
  type: 'landr:staff-init'
  token: string
  powers?: StaffPower[]
  /**
   * landr-aoak.4: the operator UUID the session was minted for. OPTIONAL on the
   * wire — the dashboard (aoak.3) has it from the [S1] mint response and SHOULD
   * send it, but when omitted the widget decodes it from the token payload, so
   * an older dashboard still routes the staff submit correctly.
   */
  operator_id?: string
}

export const STAFF_INIT_MESSAGE_TYPE = 'landr:staff-init'

/**
 * Type-guard for the staff-init postMessage payload. Defensive: a widget
 * iframe receives messages from anything on the page, so the caller MUST also
 * verify event.origin (see isAllowedStaffOrigin) before trusting this.
 */
export function isStaffInitMessage(data: unknown): data is StaffInitMessage {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return d.type === STAFF_INIT_MESSAGE_TYPE && typeof d.token === 'string' && d.token.length > 0
}

/**
 * Build a StaffSession from a verified staff-init message. Powers default to
 * ALL_STAFF_POWERS when the parent omits them (same rationale as the URL path);
 * when supplied, only valid power codes are kept so a malformed parent can't
 * inject arbitrary strings.
 */
export function staffInitFromMessage(msg: StaffInitMessage): StaffSession {
  const powers =
    Array.isArray(msg.powers) && msg.powers.length > 0
      ? msg.powers.filter((p): p is StaffPower =>
          ALL_STAFF_POWERS.includes(p as StaffPower),
        )
      : ALL_STAFF_POWERS
  // Prefer the explicit operator_id the dashboard sends; fall back to decoding
  // it from the token payload so an older dashboard (no operator_id field) and
  // the URL-param path both resolve the operator for the staff submit route.
  const operatorId =
    typeof msg.operator_id === 'string' && msg.operator_id.length > 0
      ? msg.operator_id
      : operatorIdFromStaffToken(msg.token)
  return { active: true, token: msg.token, powers, operatorId }
}

/**
 * Origin allowlist for the staff-init postMessage. A staff session is a
 * security-sensitive credential, so we ONLY accept an init message whose
 * event.origin is the embedding dashboard host. The allowlist covers the dev
 * + production dashboard origins; any other origin (including a hostile page
 * that iframes the widget) is rejected and the message ignored.
 *
 * Kept narrow on purpose — extend here, in ONE place, when a new dashboard
 * origin ships.
 */
export const STAFF_ORIGIN_ALLOWLIST: readonly string[] = [
  'https://dashboard.dev.landr.de',
  'https://dashboard.landr.de',
  'https://app.landr.de',
]

/**
 * True when `origin` is permitted to hand the widget a staff session.
 *
 * Besides the static allowlist we also accept the widget's OWN embedding
 * ancestor when the page is same-origin with the widget (covers local dev
 * where the dashboard + widget are served from one origin, and any future
 * same-origin embed). `localhost` / `127.0.0.1` dev origins on any port are
 * also accepted so `npm run dev` works without editing the allowlist.
 */
export function isAllowedStaffOrigin(origin: string): boolean {
  if (!origin) return false
  if (STAFF_ORIGIN_ALLOWLIST.includes(origin)) return true
  // Same-origin as the widget itself (covers a same-origin dashboard embed).
  if (typeof window !== 'undefined' && origin === window.location.origin) return true
  // Local dev: any localhost / 127.0.0.1 origin regardless of port.
  try {
    const host = new URL(origin).hostname
    if (host === 'localhost' || host === '127.0.0.1') return true
  } catch {
    return false
  }
  return false
}

/**
 * Resolve the targetOrigin for messages the widget POSTs back to its parent
 * (completion postMessage, landr-aoak.2 [S3].5). Prefers the document.referrer
 * origin (the embedding dashboard) when it is allow-listed; otherwise falls
 * back to the FIRST static allowlist entry so a real dashboard still receives
 * it. Never returns '*' — a booking_id must not be broadcast to any origin.
 */
export function resolveParentTargetOrigin(): string {
  if (typeof document !== 'undefined' && document.referrer) {
    try {
      const refOrigin = new URL(document.referrer).origin
      if (isAllowedStaffOrigin(refOrigin)) return refOrigin
    } catch {
      // fall through to the static default
    }
  }
  return STAFF_ORIGIN_ALLOWLIST[0]!
}

/**
 * React context carrying the active staff session. Default is inactive so any
 * component reading useStaffMode() outside a provider behaves as a normal
 * customer (the byte-identical path). StaffModeProvider (staffMode.tsx) supplies
 * the real value.
 */
export const StaffModeContext = createContext<StaffSession>(INACTIVE_STAFF_SESSION)

/**
 * useStaffMode — returns the active staff session. When no session is present
 * this is INACTIVE_STAFF_SESSION ({active:false}) and the widget renders 100%
 * identically to today.
 */
export function useStaffMode(): StaffSession {
  return useContext(StaffModeContext)
}
