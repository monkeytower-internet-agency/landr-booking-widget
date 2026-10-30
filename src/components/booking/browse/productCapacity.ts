/** Kinds that sleep guests, so a "max. N guests" chip makes sense. */
const STAY_KINDS = new Set<string>(['stay', 'hotel_room'])

/**
 * Most guests one unit of a stay product takes: capacity_per_unit, lowered to
 * max_party_size when that is stricter. null for non-stay kinds or an unknown
 * capacity (no chip, never dimmed).
 */
export function stayMaxGuests(p: {
  product_kind?: string | null
  capacity_per_unit?: number | null
  max_party_size?: number | null
}): number | null {
  if (!p.product_kind || !STAY_KINDS.has(p.product_kind)) return null
  const cap = p.capacity_per_unit
  if (cap == null || cap <= 0) return null
  const maxParty = p.max_party_size
  return maxParty != null && maxParty > 0 ? Math.min(cap, maxParty) : cap
}

/** True once the party is known and no unit of this product can take it. */
export function tooSmallForParty(
  p: Parameters<typeof stayMaxGuests>[0],
  party: number | undefined,
): boolean {
  if (!party || party <= 0) return false
  const max = stayMaxGuests(p)
  return max !== null && party > max
}
