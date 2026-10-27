import { resolveShortLink } from '../api/client'
import { shortLinkCode } from '../detectRoute'

/**
 * landr-nun2y: a `/s/<code>` short link carries no query string. Before the
 * app mounts, resolve it and rewrite the address bar to `/?<query>` so every
 * downstream reader (readQueryParams etc.) sees an ordinary long link.
 *
 * A miss (unknown code, network error) rewrites to `/?invite=invalid-short-link`,
 * which the existing invite flow answers with its 404 path: the "link isn't
 * valid" notice plus the landing page.
 */
export async function resolveShortLinkPath(
  loc: Pick<Location, 'pathname'> = window.location,
  history: Pick<History, 'replaceState'> = window.history,
): Promise<void> {
  const code = shortLinkCode(loc.pathname)
  if (!code) return
  let target = '/?invite=invalid-short-link'
  try {
    const { query } = await resolveShortLink(code)
    const q = String(query ?? '').replace(/^\?/, '')
    if (q) target = `/?${q}`
  } catch {
    // fall through to the invalid-link target
  }
  history.replaceState(null, '', target)
}
