/**
 * landr-uuntm.3: GET /geo -> {"country": "DE" | null}
 *
 * The booking widget pre-fills the billing-address country from the
 * visitor's edge location (request.cf.country, Cloudflare). 'XX' (unknown)
 * and 'T1' (Tor) are not countries -> null. no-store: the answer is per
 * visitor and must never be served from a shared cache.
 *
 * CORS: the widget bundle runs in an iframe on the Pages origin (same-origin
 * for this request) but is also loaded cross-origin on operator sites, so GET
 * is allowed from anywhere — the response carries nothing secret (the
 * visitor's own country).
 */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
}

export function cleanCountry(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const c = raw.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c) || c === 'XX' || c === 'T1') return null
  return c
}

export const onRequest: PagesFunction = async (ctx) => {
  if (ctx.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }
  if (ctx.request.method !== 'GET' && ctx.request.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { ...CORS, allow: 'GET, HEAD, OPTIONS' },
    })
  }
  const cf = (ctx.request as Request & { cf?: { country?: unknown } }).cf
  return new Response(JSON.stringify({ country: cleanCountry(cf?.country) }), {
    headers: {
      ...CORS,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
