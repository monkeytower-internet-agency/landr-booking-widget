/**
 * landr-tkgx8.2: bake the operator logo into the boot splash at the edge.
 *
 * index.html paints `#landr-boot-logo` (the Landr mark) before the bundle or
 * the settings fetch exist; src/lib/bootSplash.ts only swaps in the operator
 * logo after a previous visit cached it, so visit #1 (and any iframe with
 * blocked storage) showed Landr. For `?w=<token>` page loads this middleware
 * looks the logo up in the public settings endpoint and rewrites the img's
 * src, so first paint is the operator logo. Any failure (slow API, bad
 * token, no logo) serves the page untouched — the splash falls back as before.
 *
 * API base comes from functions/_config.json, written by the deploy workflow
 * per tier (the Pages build has no runtime env). Same visibility rule as the
 * header logo: widget_show_logo === false hides it.
 */
import config from "./_config.json";

const LOOKUP_TIMEOUT_MS = 800;
const CACHE_TTL_S = 60;

interface SplashSettings {
  logo_url?: string | null;
  widget_show_logo?: boolean | null;
}

async function lookupLogo(token: string): Promise<string | null> {
  const url = `${config.apiBase}/api/public/operators/${encodeURIComponent(token)}/settings`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      cf: { cacheTtl: CACHE_TTL_S, cacheEverything: true },
    } as RequestInit);
    if (!res.ok) return null;
    const s = (await res.json()) as SplashSettings;
    if (s.widget_show_logo === false || !s.logo_url) return null;
    return /^https?:\/\//i.test(s.logo_url) ? s.logo_url : null;
  } catch {
    return null;
  }
}

export const onRequest: PagesFunction = async (ctx) => {
  const res = await ctx.next();
  const url = new URL(ctx.request.url);
  const token = url.searchParams.get("w");
  const isHtml = (res.headers.get("content-type") ?? "").includes("text/html");
  if (!token || !isHtml || ctx.request.method !== "GET") return res;

  const logo = await lookupLogo(token);
  if (!logo) return res;
  return new HTMLRewriter()
    .on("img#landr-boot-logo", {
      element(el) {
        el.setAttribute("src", logo);
      },
    })
    .transform(res);
};
