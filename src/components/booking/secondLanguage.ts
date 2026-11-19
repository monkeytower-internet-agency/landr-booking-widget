/**
 * landr-hdk4y.2 — the second-guiding-language question (pure helpers).
 *
 * After a guided participant has picked their main guiding language, the
 * operator may ask which OTHER guiding languages they would accept when no
 * guide of the main one is available. The API (landr-hdk4y.1) owns the rule and
 * enforces it on submit; `secondLanguageOptions` below is a line-for-line mirror
 * of its `second_language_options` (app/services/second_guiding_language.py), so
 * the widget asks exactly the people, with exactly the options, the API will
 * accept. Keep the two in step.
 *
 * An answer is a list of language codes, `[]` meaning "I only speak my main
 * language"; a participant who has not answered has no entry. That is the same
 * encoding the wire uses (`participants[].accepted_languages`).
 *
 * NEVER throws: the widget has no React error boundary (bd memory landr-9ut4).
 */
import type { Product } from '@/api/types'
import type { ExtraLine } from './crossSell'
import { productDisplayLanguages } from './participantLanguages'

export type SecondLanguageMode = 'off' | 'not_preferred' | 'always'
export type SecondLanguageOffer = 'all' | 'preferred'

/** One counted service line's settings (the API's `SecondLanguageLine`). */
export interface SecondLanguageLine {
  mode: SecondLanguageMode
  preferred: readonly string[]
  options: SecondLanguageOffer
}

/** The cart the rule runs over: its lines, and the languages every line shares. */
export interface SecondLanguageCart {
  lines: readonly SecondLanguageLine[]
  /** Intersection of the lines' guide languages; null = unrestricted (any language). */
  cartLanguages: readonly string[] | null
}

/** Party-member index → accepted other languages (`[]` = only the main language). */
export type AcceptedLanguagesMap = Record<number, string[]>

const clean = (code: unknown): string => (typeof code === 'string' ? code.trim().toLowerCase() : '')

/** A product's settings as a line; anything unknown reads as `off` / `all` (as the API does). */
export function secondLanguageLine(
  product: Pick<
    Product,
    'second_language_mode' | 'preferred_guide_languages' | 'second_language_options'
  >,
): SecondLanguageLine {
  const mode = product.second_language_mode
  const options = product.second_language_options
  return {
    mode: mode === 'not_preferred' || mode === 'always' ? mode : 'off',
    preferred: Array.isArray(product.preferred_guide_languages)
      ? product.preferred_guide_languages.map(clean).filter(Boolean)
      : [],
    options: options === 'preferred' ? 'preferred' : 'all',
  }
}

/** True when any line could ask the question at all (a cheap "is the feature in play" test). */
export function cartMaySecondLanguage(cart: SecondLanguageCart): boolean {
  return cart.lines.some((l) => l.mode !== 'off')
}

function lineAsks(line: SecondLanguageLine, main: string | null): boolean {
  if (line.mode === 'always') return true
  if (line.mode === 'not_preferred') return main === null || !line.preferred.includes(main)
  return false
}

/**
 * The languages a participant is asked to tick; `[]` = not asked.
 *
 * Asked when ANY line asks (mode `always`, or `not_preferred` with the main
 * language outside that line's preferred list). Per asking line the options are
 * the cart's guide languages minus the main language (`all`; an unrestricted cart
 * has no list to offer, so none) or that line's preferred languages minus the main
 * language (`preferred`, kept inside the cart's set when it is restricted); the
 * participant's options are the union over the asking lines, sorted. No options =
 * not asked.
 */
export function secondLanguageOptions(
  cart: SecondLanguageCart,
  mainLanguage: string | null | undefined,
): string[] {
  const main = clean(mainLanguage) || null
  const options = new Set<string>()
  for (const line of cart.lines) {
    if (!lineAsks(line, main)) continue
    let pool: string[]
    if (line.options === 'preferred') {
      pool = [...line.preferred]
      if (cart.cartLanguages !== null) pool = pool.filter((c) => cart.cartLanguages!.includes(c))
    } else {
      pool = cart.cartLanguages !== null ? [...cart.cartLanguages] : []
    }
    for (const code of pool) options.add(code)
  }
  if (main !== null) options.delete(main)
  return [...options].sort()
}

/**
 * The cart for a booking's counted product lines: the main product first, then
 * any added product. `languageSets` are the lines' guide-language lists in the
 * same order (an empty list = any language, which does not restrict the cart).
 */
export function buildSecondLanguageCart(
  products: ReadonlyArray<Parameters<typeof secondLanguageLine>[0]>,
  languageSets: ReadonlyArray<readonly string[]>,
): SecondLanguageCart {
  const restricted = languageSets.filter((s) => s.length > 0)
  const cartLanguages =
    restricted.length === 0
      ? null
      : restricted[0]!.filter((code) => restricted.every((s) => s.includes(code)))
  return { lines: products.map(secondLanguageLine), cartLanguages }
}

/**
 * The cart for a booking: the main product plus the added lines THE API COUNTS
 * (app/services/booking_submit.py `_counted_service_rows`): service-kind lines
 * only, and add-ons attached to another product of the cart (an offer's line)
 * are dropped; if nothing but add-on service lines remain they count instead.
 * The widget's catalogue does not carry `is_addon_only`, so a plainly added
 * product counts as primary. A line that does not count never asks, and does not
 * narrow the cart's languages either.
 */
export function secondLanguageCartFor(
  main: Product,
  lines: readonly ExtraLine[],
): SecondLanguageCart {
  const candidates = [
    { product: main, attached: false },
    ...lines.map((l) => ({ product: l.product, attached: l.offerId !== undefined })),
  ].filter((c) => c.product.product_kind === 'service')
  const primary = candidates.filter((c) => !c.attached)
  const counted = primary.length > 0 ? primary : candidates
  return buildSecondLanguageCart(
    counted.map((c) => c.product),
    counted.map((c) => productDisplayLanguages(c.product.guide_languages)),
  )
}

/** Who is asked what: party index → options, for the participants that have a main language. */
export function askedParticipants(
  cart: SecondLanguageCart,
  mainLanguages: Readonly<Record<number, string>>,
  participantCount: number,
): Record<number, string[]> {
  const out: Record<number, string[]> = {}
  if (!cartMaySecondLanguage(cart)) return out
  for (let i = 0; i < participantCount; i += 1) {
    const main = mainLanguages[i]
    // No main language yet (the board is still being filled): nothing to ask.
    if (typeof main !== 'string' || main === '') continue
    const options = secondLanguageOptions(cart, main)
    if (options.length > 0) out[i] = options
  }
  return out
}

/**
 * The answers that still stand against the current question: only for asked
 * participants, only values that are options, and a non-empty answer whose values
 * all fell away is "unanswered" (never silently turned into "only my language").
 */
export function pruneAcceptedAnswers(
  answers: Readonly<Record<number, readonly string[]>>,
  asked: Readonly<Record<number, readonly string[]>>,
): AcceptedLanguagesMap {
  const out: AcceptedLanguagesMap = {}
  for (const [key, options] of Object.entries(asked)) {
    const idx = Number(key)
    const answer = answers[idx]
    if (!Array.isArray(answer)) continue
    const kept = answer.filter((c) => options.includes(c))
    if (answer.length > 0 && kept.length === 0) continue
    out[idx] = kept
  }
  return out
}

/** Asked participants that have no answer yet, in party order. */
export function unansweredIndices(
  asked: Readonly<Record<number, readonly string[]>>,
  answers: Readonly<Record<number, readonly string[]>>,
): number[] {
  return Object.keys(asked)
    .map(Number)
    .filter((i) => !Array.isArray(answers[i]))
    .sort((a, b) => a - b)
}

/** Tick / untick one language: ticking drops the exclusive "only" answer; unticking the last one clears. */
export function toggleAcceptedLanguage(
  current: readonly string[] | undefined,
  code: string,
): string[] | undefined {
  const base = current ?? []
  const next = base.includes(code) ? base.filter((c) => c !== code) : [...base, code]
  return next.length === 0 ? undefined : next
}

/** The exclusive "I only speak X": ticking clears every other tick, ticking again clears the answer. */
export function toggleOnlyMainLanguage(current: readonly string[] | undefined): string[] | undefined {
  return Array.isArray(current) && current.length === 0 ? undefined : []
}

/**
 * "Apply to everyone": copy `source`'s answer to every other asked participant,
 * keeping only the values that are valid options for each. An answer whose values
 * are none of a participant's options leaves that participant unanswered.
 */
export function applyAnswerToEveryone(
  answers: Readonly<Record<number, readonly string[]>>,
  asked: Readonly<Record<number, readonly string[]>>,
  source: number,
): AcceptedLanguagesMap {
  const out: AcceptedLanguagesMap = { ...pruneAcceptedAnswers(answers, asked) }
  const from = out[source]
  if (!Array.isArray(from)) return out
  for (const [key, options] of Object.entries(asked)) {
    const idx = Number(key)
    if (idx === source) continue
    const kept = from.filter((c) => options.includes(c))
    if (from.length > 0 && kept.length === 0) delete out[idx]
    else out[idx] = kept
  }
  return out
}
