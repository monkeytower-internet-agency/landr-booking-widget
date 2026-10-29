/**
 * Agent referral link (`?a=<token>`): remember it, send it on submit.
 *
 * A sales agent's link or QR opens the widget as `/?w=<widget>&a=<token>`. The
 * guest often books later than the scan, so the token is kept in first-party
 * storage on the widget's own origin and sent as `agent_token` on any submit
 * inside the attribution window. A fresh `?a=` replaces the stored one (last
 * click wins). The API decides whether the token really belongs to a live agent
 * of this operator; a stale or unknown one is ignored there, never an error.
 *
 * Storage is best-effort: every access is wrapped, because embeds can run in a
 * sandboxed iframe where localStorage throws. Without it the token still works
 * for the page load that carried `?a=`.
 */

/** How long a scan keeps crediting the agent for the guest's later bookings. */
export const AGENT_ATTRIBUTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export const AGENT_STORAGE_KEY = 'landr-widget-agent-ref.v1'

interface StoredAgentRef {
  /** Widget token the link was opened for: a token never crosses operators. */
  w: string
  a: string
  /** Epoch ms of the scan that stored it. */
  at: number
}

export function writeStoredAgentToken(
  widgetToken: string,
  agentToken: string,
  now: number = Date.now(),
): void {
  try {
    const value: StoredAgentRef = { w: widgetToken, a: agentToken, at: now }
    window.localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // storage unavailable: attribution then lasts for this page load only
  }
}

export function readStoredAgentToken(
  widgetToken: string | null,
  now: number = Date.now(),
): string | null {
  if (!widgetToken) return null
  try {
    const raw = window.localStorage.getItem(AGENT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredAgentRef> | null
    if (
      !parsed ||
      parsed.w !== widgetToken ||
      typeof parsed.a !== 'string' ||
      parsed.a === '' ||
      typeof parsed.at !== 'number'
    ) {
      return null
    }
    if (now - parsed.at > AGENT_ATTRIBUTION_WINDOW_MS || parsed.at > now) return null
    return parsed.a
  } catch {
    return null
  }
}

/** The token to send: the link's own `?a=`, else a stored one still in window. */
export function resolveAgentToken(
  widgetToken: string | null,
  fromUrl: string | null,
  now: number = Date.now(),
): string | null {
  return fromUrl ?? readStoredAgentToken(widgetToken, now)
}
