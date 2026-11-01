/**
 * landr-tm48v.2 — the offer rule evaluator, TS half.
 *
 * ONE semantics, three evaluators: SQL `offer_rule_matches(rules, ctx)` in
 * landr-api (the definition), landr-api `app/services/offer_rules.py` and this
 * file. All three run the same fixture: `__fixtures__/offerRules.cases.json`
 * is a verbatim copy of landr-api `app/tests/fixtures/offer_rules_cases.json`,
 * and both repos pin its sha256 in `offer_rules_cases.sha256` (the test fails
 * when the copy drifts). Change the fixture in landr-api first, then copy it
 * here byte for byte with the same pin.
 *
 * The server stays the authority: `POST /api/public/offers/evaluate` decides
 * what a cart sees and submit re-judges it. This evaluator lets the widget
 * re-judge instantly while the guest edits the party.
 *
 * Rules: `{mode: 'all' | 'any', items: [{cond, op, value[, key][, anchor]}]}`;
 * `null` = no rules (offered to everyone). `guest_attr` = SOME guest has the
 * key and matches; `guest_attr_all` = EVERY guest does (an empty party never
 * does). `date_window` judges every night, or with `anchor: 'arrival'` the
 * arrival date alone. Context (dates are operator-local):
 * `{parent_product_id, parent_available, participants: [{id, guest_attributes}],
 *   arrival, departure, nights, season_ids}` — a key the caller does not know
 * is left out, and every condition needing it is false.
 *
 * Port notes: a key absent from its object (`undefined`) is SQL NULL, JSON
 * `null` is a value; a boolean is never a number (`true` ≠ `1`); numbers
 * compare by value (`12` = `12.0`); a malformed document fails closed.
 */

export type RuleMode = 'all' | 'any'

export type DateWindowAnchor = 'every_night' | 'arrival'

export interface OfferRuleItem {
  cond: string
  op: string
  value: unknown
  key?: string
  /** `date_window` only; absent = `every_night`. */
  anchor?: DateWindowAnchor
}

export interface OfferRules {
  mode: RuleMode
  items: OfferRuleItem[]
}

export interface RuleParticipant {
  id?: string
  guest_attributes?: Record<string, unknown>
}

export interface RuleContext {
  parent_product_id?: string
  parent_available?: boolean
  participants?: RuleParticipant[]
  arrival?: string
  departure?: string
  nights?: number
  season_ids?: string[]
}

type JType = 'null' | 'boolean' | 'number' | 'string' | 'array' | 'object'

const DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/
const MONTH_DAY_RE = /^[0-9]{2}-[0-9]{2}$/
const ATTRIBUTE_KEY_RE = /^[a-z][a-z0-9_]{0,39}$/
const ATTR_OPS = ['eq', 'in', 'gte', 'lte', 'between']
/** The conds that read a guest attribute `key`. */
const GUEST_ATTR_CONDS = ['guest_attr', 'guest_attr_all']
const DAY_MS = 86_400_000

/** `jsonb_typeof`; undefined for a missing key (SQL NULL). */
function jtype(v: unknown): JType | undefined {
  if (v === undefined) return undefined
  if (v === null) return 'null'
  if (typeof v === 'boolean') return 'boolean'
  if (typeof v === 'number') return Number.isFinite(v) ? 'number' : undefined
  if (typeof v === 'string') return 'string'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'object') return 'object'
  return undefined
}

function isObject(v: unknown): v is Record<string, unknown> {
  return jtype(v) === 'object'
}

/** `obj -> key`: undefined when absent (or obj is no object). */
function get(obj: unknown, key: string): unknown {
  return isObject(obj) && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined
}

/** `p ->> 'k'`: a string as-is, any other JSON value as its JSON text. */
function text(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}

/** jsonb `=`. */
function jeq(a: unknown, b: unknown): boolean {
  const ta = jtype(a)
  if (ta === undefined || ta !== jtype(b)) return false
  if (ta === 'array') {
    const x = a as unknown[]
    const y = b as unknown[]
    return x.length === y.length && x.every((v, i) => jeq(v, y[i]))
  }
  if (ta === 'object') {
    const x = a as Record<string, unknown>
    const y = b as Record<string, unknown>
    const kx = Object.keys(x)
    return kx.length === Object.keys(y).length && kx.every((k) => Object.prototype.hasOwnProperty.call(y, k) && jeq(x[k], y[k]))
  }
  return a === b
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

/** SQL `_offer_ctx_date`: a strict YYYY-MM-DD calendar date as a UTC day number, else null. */
function ctxDay(v: unknown): number | null {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return null
  const y = Number(v.slice(0, 4))
  const m = Number(v.slice(5, 7))
  const d = Number(v.slice(8, 10))
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null // 2026-02-30 and friends
  const dt = new Date(0)
  dt.setUTCFullYear(y, m - 1, d)
  return Math.round(dt.getTime() / DAY_MS)
}

function isMonthDay(v: unknown): v is string {
  if (typeof v !== 'string' || !MONTH_DAY_RE.test(v)) return false
  const m = Number(v.slice(0, 2))
  const d = Number(v.slice(3))
  const max = m === 2 ? 29 : [4, 6, 9, 11].includes(m) ? 30 : 31
  return m >= 1 && m <= 12 && d >= 1 && d <= max
}

/** SQL `_offer_value_cmp`. */
function valueCmp(actual: unknown, op: unknown, value: unknown): boolean {
  const ta = jtype(actual)
  if (ta === undefined || ta === 'null') return false
  if (op === 'eq') return jeq(actual, value)
  if (op === 'in') return Array.isArray(value) && value.some((e) => jeq(e, actual))
  if (ta !== 'number') return false
  const n = actual as number
  if (op === 'gte') return jtype(value) === 'number' && n >= (value as number)
  if (op === 'lte') return jtype(value) === 'number' && n <= (value as number)
  if (op === 'between') {
    return (
      Array.isArray(value) &&
      value.length === 2 &&
      jtype(value[0]) === 'number' &&
      jtype(value[1]) === 'number' &&
      (value[0] as number) <= n &&
      n <= (value[1] as number)
    )
  }
  return false
}

/** SQL `_offer_uuid_list_hit`: any needle string in the haystack array, case-insensitively. */
function uuidListHit(needle: unknown, haystack: unknown): boolean {
  if (!Array.isArray(haystack)) return false
  const needles = Array.isArray(needle) ? needle : typeof needle === 'string' ? [needle] : []
  const hay = new Set(haystack.filter((h): h is string => typeof h === 'string').map((h) => h.toLowerCase()))
  return needles.some((n) => typeof n === 'string' && hay.has(n.toLowerCase()))
}

/**
 * SQL `_offer_date_window_hit`: EVERY night inside [lo, hi] (month*100+day,
 * inclusive; lo > hi wraps the year end). Nights are arrival .. departure-1,
 * or the arrival alone without a later departure. Calendar days, so a DST
 * change inside the stay changes nothing.
 */
function dateWindowHit(value: unknown, ctx: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 2 || !isMonthDay(value[0]) || !isMonthDay(value[1])) return false
  const arrival = ctxDay(get(ctx, 'arrival'))
  if (arrival === null) return false
  const departure = ctxDay(get(ctx, 'departure'))
  const last = departure !== null && departure > arrival ? departure - 1 : arrival
  const lo = Number(value[0].replace('-', ''))
  const hi = Number(value[1].replace('-', ''))
  const seen = new Set<number>()
  for (let day = arrival; day <= last; day += 1) {
    const dt = new Date(day * DAY_MS)
    const md = (dt.getUTCMonth() + 1) * 100 + dt.getUTCDate()
    if (seen.has(md)) continue
    const inside = lo <= hi ? md >= lo && md <= hi : md >= lo || md <= hi
    if (!inside) return false
    seen.add(md)
    if (seen.size === 366) return true // every calendar day judged
  }
  return true
}

/**
 * SQL `offer_rule_item_matches` date_window branch: `anchor` absent or
 * `every_night` judges every night; `arrival` the arrival date alone (the ctx
 * without its departure); any other anchor never matches.
 */
function dateWindowItemHit(item: Record<string, unknown>, ctx: Record<string, unknown>): boolean {
  const anchor = get(item, 'anchor')
  const value = get(item, 'value')
  if (anchor === undefined || anchor === 'every_night') return dateWindowHit(value, ctx)
  if (anchor === 'arrival') {
    const arrivalOnly = Object.fromEntries(Object.entries(ctx).filter(([k]) => k !== 'departure'))
    return dateWindowHit(value, arrivalOnly)
  }
  return false
}

function participantHas(p: unknown, key: string, op: unknown, val: unknown): boolean {
  const attrs = get(p, 'guest_attributes')
  return isObject(attrs) && Object.prototype.hasOwnProperty.call(attrs, key) && valueCmp(attrs[key], op, val)
}

/** SQL `offer_rule_item_matches`: one condition against the context. */
export function ruleItemMatches(item: unknown, ctx: unknown): boolean {
  if (!isObject(item) || !isObject(ctx)) return false
  const cond = get(item, 'cond')
  const op = get(item, 'op')
  const val = get(item, 'value')
  switch (cond) {
    case 'parent_in': {
      const parent = get(ctx, 'parent_product_id')
      return op === 'in' && typeof parent === 'string' && uuidListHit(parent, val)
    }
    case 'season_in': {
      const seasons = get(ctx, 'season_ids')
      return op === 'in' && Array.isArray(seasons) && uuidListHit(seasons, val)
    }
    case 'guest_attr': {
      const key = text(get(item, 'key'))
      const participants = get(ctx, 'participants')
      if (key === undefined || !ATTR_OPS.includes(op as string)) return false
      if (!Array.isArray(participants)) return false
      return participants.some((p) => participantHas(p, key, op, val))
    }
    case 'guest_attr_all': {
      const key = text(get(item, 'key'))
      const participants = get(ctx, 'participants')
      if (key === undefined || !ATTR_OPS.includes(op as string)) return false
      if (!Array.isArray(participants) || participants.length === 0) return false
      return participants.every((p) => participantHas(p, key, op, val))
    }
    case 'date_window':
      return op === 'between' && dateWindowItemHit(item, ctx)
    case 'stay_nights':
      return ['eq', 'gte', 'lte', 'between'].includes(op as string) && valueCmp(get(ctx, 'nights'), op, val)
    case 'parent_unavailable': {
      const available = get(ctx, 'parent_available')
      return op === 'eq' && typeof val === 'boolean' && typeof available === 'boolean' && !available === val
    }
    default:
      return false // unknown cond = never
  }
}

function wellFormed(rules: unknown): rules is { mode: RuleMode; items: unknown[] } {
  const mode = get(rules, 'mode')
  return isObject(rules) && Array.isArray(get(rules, 'items')) && (mode === 'all' || mode === 'any')
}

/**
 * SQL `offer_rule_matches`: null rules or empty items → true; `all` = every
 * item, `any` = at least one; a malformed document fails closed.
 */
export function ruleMatches(rules: unknown, ctx: unknown): boolean {
  if (rules === null || rules === undefined) return true
  if (!wellFormed(rules)) return false
  if (rules.items.length === 0) return true
  for (const item of rules.items) {
    const hit = ruleItemMatches(item, ctx)
    if (rules.mode === 'all' && !hit) return false
    if (rules.mode === 'any' && hit) return true
  }
  return rules.mode === 'all'
}

/** The `guest_attr` / `guest_attr_all` keys a rule set reads, in first-use order. */
export function ruleKeys(rules: unknown): string[] {
  if (!wellFormed(rules)) return []
  const out: string[] = []
  for (const item of rules.items) {
    const key = get(item, 'key')
    const cond = get(item, 'cond')
    if (
      typeof cond === 'string' &&
      GUEST_ATTR_CONDS.includes(cond) &&
      typeof key === 'string' &&
      ATTRIBUTE_KEY_RE.test(key) &&
      !out.includes(key)
    ) {
      out.push(key)
    }
  }
  return out
}

interface ProductAttributeSource {
  required_attributes?: readonly string[] | null
  eligibility_rules?: unknown
}

interface OfferAttributeSource {
  required_attributes?: readonly string[] | null
  rules?: unknown
}

/**
 * Sorted union of the guest attribute keys a cart must ask (same as landr-api
 * `required_attribute_keys`): the main product(s)' `required_attributes` and
 * eligibility-rule keys, every offer's `required_attributes` and rule keys
 * (DECIDED: a key a rule reads is implicitly required), and `extraKeys`.
 */
export function requiredAttributeKeys(
  products: ProductAttributeSource | readonly ProductAttributeSource[] | null | undefined,
  offers: readonly OfferAttributeSource[],
  extraKeys: readonly string[] = [],
): string[] {
  const list = products == null ? [] : Array.isArray(products) ? products : [products as ProductAttributeSource]
  const keys = new Set<string>()
  for (const p of list) {
    for (const k of p.required_attributes ?? []) keys.add(k)
    for (const k of ruleKeys(p.eligibility_rules)) keys.add(k)
  }
  for (const o of offers) {
    for (const k of o.required_attributes ?? []) keys.add(k)
    for (const k of ruleKeys(o.rules)) keys.add(k)
  }
  for (const k of extraKeys) keys.add(k)
  return [...keys].filter((k) => typeof k === 'string' && ATTRIBUTE_KEY_RE.test(k)).sort()
}

/**
 * The keys of `keys` some participant has no value for — all of them when the
 * party is empty. A key a rule reads that a guest has not answered hides the
 * offer (DECIDED), so the widget asks for it first.
 */
export function missingAttributeKeys(keys: readonly string[], ctx: RuleContext | null | undefined): string[] {
  const parts = (ctx?.participants ?? []).filter((p) => isObject(p))
  const out: string[] = []
  for (const key of keys) {
    if (out.includes(key)) continue
    const answered = (p: RuleParticipant) => {
      const v = p.guest_attributes?.[key]
      return v !== undefined && v !== null
    }
    if (parts.length === 0 || parts.some((p) => !answered(p))) out.push(key)
  }
  return out
}
