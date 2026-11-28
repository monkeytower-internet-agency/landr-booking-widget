import type { ProductGroup } from '../api/types'

/** landr-3tpmm: `?group=a,b` — comma-separated slugs or ids. */
export function parseGroupParam(raw: string | null): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  for (const part of raw.split(',')) {
    const t = part.trim()
    if (t) seen.add(t)
  }
  return [...seen]
}

/**
 * A single value keeps the lock-to-one-group deep link (resolved server-side,
 * unknown values included). Two or more values give a limited entrance: see
 * limitGroups.
 */
export function singleGroup(tokens: string[]): string | null {
  return tokens.length === 1 ? tokens[0] : null
}

/**
 * The fetched groups limited to the listed slugs/ids, in the operator's
 * order. Unknown values are ignored; nothing known -> the full set.
 * A listed parent keeps its sub-categories (the products query does).
 */
export function limitGroups(groups: ProductGroup[], tokens: string[]): ProductGroup[] {
  if (tokens.length < 2) return groups
  const want = new Set(tokens)
  const direct = groups.filter((g) => want.has(g.slug) || want.has(g.id))
  if (direct.length === 0) return groups
  const ids = new Set(direct.map((g) => g.id))
  return groups.filter((g) => ids.has(g.id) || (g.parent_id != null && ids.has(g.parent_id)))
}
