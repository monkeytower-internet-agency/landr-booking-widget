/**
 * landr-hdk4y.2 — the second-guiding-language rule, mirrored from the API
 * (app/services/second_guiding_language.py, landr-hdk4y.1). The cases below are
 * the ones that file's own tests pin: keep the two in step.
 */
import { describe, expect, it, vi } from 'vitest'
import type { Product } from '@/api/types'
import type { ExtraLine } from './crossSell'
import { DEFAULT_OFFERED_LANGUAGES } from './participantLanguages'
import {
  applyAnswerToEveryone,
  askedParticipants,
  buildSecondLanguageCart,
  pruneAcceptedAnswers,
  secondLanguageCartFor,
  secondLanguageLine,
  secondLanguageOptions,
  settledParticipants,
  toggleAcceptedLanguage,
  toggleOnlyMainLanguage,
  unansweredIndices,
} from './secondLanguage'

const product = (
  mode: 'off' | 'not_preferred' | 'always',
  preferred: string[] = ['en', 'de'],
  options: 'all' | 'preferred' = 'all',
) => ({
  second_language_mode: mode,
  preferred_guide_languages: preferred,
  second_language_options: options,
})
const GUIDE = ['en', 'de', 'es', 'fr']
const cartOf = (p: ReturnType<typeof product>, langs: string[] = GUIDE) =>
  buildSecondLanguageCart([p], [langs])

describe('secondLanguageOptions', () => {
  it('mode off asks nobody', () => {
    expect(secondLanguageOptions(cartOf(product('off')), 'fr')).toEqual([])
  })

  it('not_preferred: asks a French guest, not a German one (preferred EN/DE)', () => {
    const cart = cartOf(product('not_preferred'))
    expect(secondLanguageOptions(cart, 'fr')).toEqual(['de', 'en', 'es'])
    expect(secondLanguageOptions(cart, 'de')).toEqual([])
    expect(secondLanguageOptions(cart, 'en')).toEqual([])
  })

  it('always: asks everyone, options are the guide languages minus the main one', () => {
    const cart = cartOf(product('always'))
    expect(secondLanguageOptions(cart, 'de')).toEqual(['en', 'es', 'fr'])
    expect(secondLanguageOptions(cart, 'fr')).toEqual(['de', 'en', 'es'])
  })

  it('preferred-only options follow the preferred list, minus the main language', () => {
    const cart = cartOf(product('always', ['en', 'de'], 'preferred'))
    expect(secondLanguageOptions(cart, 'fr')).toEqual(['de', 'en'])
    expect(secondLanguageOptions(cart, 'de')).toEqual(['en'])
  })

  it('a product whose only preferred languages are all of its languages never asks in not_preferred', () => {
    const cart = cartOf(product('not_preferred', ['en', 'de'], 'all'), ['en', 'de'])
    expect(secondLanguageOptions(cart, 'en')).toEqual([])
    expect(secondLanguageOptions(cart, 'de')).toEqual([])
  })

  it('no options left means not asked (a one-language product)', () => {
    expect(secondLanguageOptions(cartOf(product('always'), ['en']), 'en')).toEqual([])
  })

  it('an unrestricted (any-language) cart has no language step, so nobody is asked', () => {
    const any = buildSecondLanguageCart([product('always')], [[]])
    expect(any.cartLanguages).toBeNull()
    expect(secondLanguageOptions(any, 'fr')).toEqual([])
    const pref = buildSecondLanguageCart([product('always', ['en', 'de'], 'preferred')], [[]])
    expect(secondLanguageOptions(pref, 'fr')).toEqual([])
    expect(askedParticipants(pref, { 0: 'fr' }, 1)).toEqual({})
  })

  it('multi-product cart: asked if any line asks, options union, inside the cart intersection', () => {
    const cart = buildSecondLanguageCart(
      [product('off'), product('always', ['en'], 'all')],
      [['en', 'de', 'es'], ['en', 'de', 'fr']],
    )
    expect(cart.cartLanguages).toEqual(['en', 'de'])
    expect(secondLanguageOptions(cart, 'en')).toEqual(['de'])
    // preferred pool is cut to the cart's set
    const narrowed = buildSecondLanguageCart(
      [product('always', ['en', 'fr'], 'preferred'), product('off')],
      [['en', 'de', 'fr'], ['en', 'de']],
    )
    expect(secondLanguageOptions(narrowed, 'de')).toEqual(['en'])
  })

  it('unknown settings read as off / all, as the API does', () => {
    expect(secondLanguageLine({})).toEqual({ mode: 'off', preferred: [], options: 'all' })
  })

  it('an unknown main language is never asked', () => {
    expect(secondLanguageOptions(cartOf(product('not_preferred')), null)).toEqual([])
    expect(secondLanguageOptions(cartOf(product('always')), '  ')).toEqual([])
  })
})

/**
 * Parity table with the API's own pure-rule table
 * (app/tests/test_second_guiding_language.py `test_second_language_options`):
 * the same rows, the same answers. Change one side, change the other.
 */
describe('rule parity with the API', () => {
  const CART = ['en', 'de', 'fr', 'es']
  const line = (
    mode: 'off' | 'not_preferred' | 'always' = 'always',
    preferred: string[] = [],
    options: 'all' | 'preferred' = 'all',
  ) => product(mode, preferred, options)
  const table: Array<
    [string, ReturnType<typeof line>[], string | null, string[] | null, string[]]
  > = [
    ['always minus main', [line()], 'en', CART, ['de', 'es', 'fr']],
    ['not_preferred, main preferred', [line('not_preferred', ['en', 'de'])], 'en', CART, []],
    ['not_preferred, main not preferred', [line('not_preferred', ['en', 'de'])], 'fr', CART, ['de', 'en', 'es']],
    ['preferred list inside the cart', [line('always', ['en', 'fr', 'it'], 'preferred')], 'de', CART, ['en', 'fr']],
    ['preferred list minus main', [line('always', ['en', 'fr'], 'preferred')], 'en', CART, ['fr']],
    ['off never asks', [line('off')], 'en', CART, []],
    ['no options left', [line('always', ['en'], 'preferred')], 'en', CART, []],
    ['single-language cart', [line()], 'en', ['en'], []],
    ['any-language cart', [line()], 'en', null, []],
    ['any-language cart with a preferred list', [line('always', ['en', 'fr'], 'preferred')], 'en', null, []],
    ['single-language cart with a preferred list', [line('always', ['en', 'fr'], 'preferred')], 'en', ['en'], []],
    ['single language, other main', [line('always', ['fr'], 'preferred')], 'de', ['fr'], []],
    ['no main language, not_preferred', [line('not_preferred', ['en'])], null, CART, []],
    ['no main language, always', [line()], null, CART, []],
    ['blank main language', [line()], '  ', CART, []],
    ['main case and whitespace', [line()], ' EN ', CART, ['de', 'es', 'fr']],
    ['union over lines', [line('off'), line('always', ['fr'], 'preferred')], 'en', CART, ['fr']],
    ['any line asks', [line('not_preferred', ['en']), line('always', ['de'], 'preferred')], 'en', CART, ['de']],
  ]
  it.each(table)('%s', (_name, lines, main, cart, expected) => {
    const sets = lines.map(() => cart ?? [])
    const built = buildSecondLanguageCart(lines, sets)
    // the cart's languages are the table's, not the intersection of per-line sets
    expect(secondLanguageOptions({ ...built, cartLanguages: cart }, main)).toEqual(expected)
  })

  it('a product open to any or one language is read as off, wherever the cart languages come from', () => {
    for (const set of [[], ['en']]) {
      const cart = buildSecondLanguageCart([line('always')], [set])
      expect(cart.lines[0]!.mode).toBe('off')
    }
    const two = buildSecondLanguageCart([line('always')], [['en', 'de']])
    expect(two.lines[0]!.mode).toBe('always')
  })

  it('an open product beside a restricted one asks nothing for itself', () => {
    const cart = buildSecondLanguageCart(
      [line('always'), line('off')],
      [[], ['en', 'de']],
    )
    expect(cart.cartLanguages).toEqual(['en', 'de'])
    expect(secondLanguageOptions(cart, 'en')).toEqual([])
  })
})

describe('askedParticipants', () => {
  const cart = cartOf(product('not_preferred'))
  it('asks only participants that have a main language the rule asks about', () => {
    expect(askedParticipants(cart, { 0: 'fr', 1: 'de', 2: 'es' }, 3)).toEqual({
      0: ['de', 'en', 'es'],
      2: ['de', 'en', 'fr'],
    })
    expect(askedParticipants(cart, { 1: 'de' }, 3)).toEqual({})
  })
  it('is empty when no line asks', () => {
    expect(askedParticipants(cartOf(product('off')), { 0: 'fr' }, 1)).toEqual({})
  })
})

describe('answers', () => {
  const asked = { 0: ['de', 'en', 'es'], 2: ['de', 'en'] }

  it('ticking the exclusive answer clears the others and vice versa', () => {
    expect(toggleAcceptedLanguage(undefined, 'en')).toEqual(['en'])
    expect(toggleAcceptedLanguage(['en'], 'de')).toEqual(['en', 'de'])
    expect(toggleAcceptedLanguage(['en'], 'en')).toBeUndefined()
    expect(toggleOnlyMainLanguage(['en', 'de'])).toEqual([])
    expect(toggleAcceptedLanguage([], 'de')).toEqual(['de'])
    expect(toggleOnlyMainLanguage([])).toBeUndefined()
    expect(toggleOnlyMainLanguage(undefined)).toEqual([])
  })

  it('prune drops values that are no options, and an answer that lost every value', () => {
    expect(pruneAcceptedAnswers({ 0: ['en', 'fr'], 2: ['es'], 1: ['en'] }, asked)).toEqual({ 0: ['en'] })
    expect(pruneAcceptedAnswers({ 0: [] }, asked)).toEqual({ 0: [] })
  })

  it('unanswered lists asked participants without an entry', () => {
    expect(unansweredIndices(asked, { 0: [] })).toEqual([2])
    expect(unansweredIndices(asked, { 0: [], 2: ['en'] })).toEqual([])
  })

  it('apply to everyone copies only values that are valid options for each', () => {
    expect(applyAnswerToEveryone({ 0: ['es', 'en'] }, asked, 0)).toEqual({ 0: ['es', 'en'], 2: ['en'] })
    expect(applyAnswerToEveryone({ 0: [] }, asked, 0)).toEqual({ 0: [], 2: [] })
    // nothing valid for the other participant: they stay unanswered, never "only"
    expect(applyAnswerToEveryone({ 0: ['es'] }, asked, 0)).toEqual({ 0: ['es'] })
    // no answer yet: nothing to copy
    expect(applyAnswerToEveryone({}, asked, 0)).toEqual({})
  })
})

describe('secondLanguageCartFor (the lines the API counts)', () => {
  const svc = (id: string, langs: string[], mode: 'off' | 'always' = 'off', kind = 'service') =>
    ({
      product_id: id,
      product_kind: kind,
      guide_languages: langs,
      second_language_mode: mode,
      preferred_guide_languages: [],
      second_language_options: 'all',
    }) as unknown as Product
  const line = (product: Product, offerId?: string) =>
    ({ key: product.product_id, product, ...(offerId ? { offerId, lineId: 'o1' } : {}) }) as unknown as ExtraLine

  it('an add-on line attached from an offer neither asks nor narrows the cart', () => {
    const main = svc('main', ['en', 'de', 'fr'])
    const addon = svc('video', ['en'], 'always')
    const cart = secondLanguageCartFor(main, [line(addon, 'offer-1')])
    expect(cart.lines).toHaveLength(1)
    expect(cart.cartLanguages).toEqual(['en', 'de', 'fr'])
    expect(askedParticipants(cart, { 0: 'fr' }, 1)).toEqual({})
  })

  it('a plainly added service product counts: it asks and narrows', () => {
    const cart = secondLanguageCartFor(svc('main', ['en', 'de', 'fr']), [line(svc('b', ['en', 'fr'], 'always'))])
    expect(cart.lines).toHaveLength(2)
    expect(cart.cartLanguages).toEqual(['en', 'fr'])
    expect(askedParticipants(cart, { 0: 'fr' }, 1)).toEqual({ 0: ['en'] })
  })

  it('non-service lines (stays, rooms) are ignored', () => {
    const cart = secondLanguageCartFor(svc('main', ['en', 'de']), [line(svc('room', ['fr'], 'always', 'hotel_room'))])
    expect(cart.lines).toHaveLength(1)
    expect(cart.cartLanguages).toEqual(['en', 'de'])
  })

  it('only add-on service lines left: they count instead', () => {
    const cart = secondLanguageCartFor(svc('stay', [], 'off', 'stay'), [line(svc('video', ['en', 'de'], 'always'), 'o1')])
    expect(cart.lines).toHaveLength(1)
    expect(cart.cartLanguages).toEqual(['en', 'de'])
  })
})

describe('secondLanguageCartFor with a product that has no guide_languages (landr-tk66y)', () => {
  it('reads the platform default, like the language step does', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const main = {
      id: 'p',
      product_kind: 'service',
      guide_languages: null,
      ...product('always'),
    } as unknown as Product
    const cart = secondLanguageCartFor(main, [])
    expect(cart.cartLanguages).toEqual([...DEFAULT_OFFERED_LANGUAGES])
    // The cart agrees with the step: the question runs, and offers the other languages.
    expect(cart.lines[0]?.mode).toBe('always')
    expect(secondLanguageOptions(cart, DEFAULT_OFFERED_LANGUAGES[0])).toEqual(
      DEFAULT_OFFERED_LANGUAGES.slice(1).sort(),
    )
    warn.mockRestore()
  })

  it('still reads an empty list as any language (no question)', () => {
    const main = {
      id: 'p',
      product_kind: 'service',
      guide_languages: [],
      ...product('always'),
    } as unknown as Product
    expect(secondLanguageCartFor(main, []).cartLanguages).toBeNull()
  })
})

describe('settledParticipants (landr-nr4ok)', () => {
  const cart = cartOf(product('not_preferred'))

  it('lists who has a main language the operator always covers, plus those languages', () => {
    expect(settledParticipants(cart, { 0: 'en', 1: 'de' }, 2)).toEqual({
      settled: { 0: 'en', 1: 'de' },
      preferred: ['en', 'de'],
    })
  })

  it('mixed: the asked participant is left out, the covered one is in', () => {
    const r = settledParticipants(cart, { 0: 'fr', 1: 'en' }, 2)
    expect(r.settled).toEqual({ 1: 'en' })
    expect(r.preferred).toEqual(['en', 'de'])
  })

  it('nobody is asked: everyone settled', () => {
    expect(Object.keys(settledParticipants(cart, { 0: 'en', 1: 'en', 2: 'de' }, 3).settled)).toEqual(['0', '1', '2'])
  })

  it('a participant without a main language yet is excluded', () => {
    expect(settledParticipants(cart, { 1: 'en' }, 3).settled).toEqual({ 1: 'en' })
  })

  it('mode always and off explain nothing', () => {
    expect(settledParticipants(cartOf(product('always')), { 0: 'en' }, 1)).toEqual({ settled: {}, preferred: [] })
    expect(settledParticipants(cartOf(product('off')), { 0: 'en' }, 1)).toEqual({ settled: {}, preferred: [] })
  })

  it('keeps the preferred list inside the cart languages', () => {
    const narrow = cartOf(product('not_preferred', ['en', 'de', 'it']))
    expect(settledParticipants(narrow, { 0: 'en' }, 1).preferred).toEqual(['en', 'de'])
  })

  it('not asked as the language step does not run (single language)', () => {
    const single = cartOf(product('not_preferred'), ['en'])
    expect(settledParticipants(single, { 0: 'en' }, 1)).toEqual({ settled: {}, preferred: [] })
  })

  it('options="preferred" changes the options, not who is covered', () => {
    const c = cartOf(product('not_preferred', ['en', 'de'], 'preferred'))
    expect(settledParticipants(c, { 0: 'en', 1: 'fr' }, 2).settled).toEqual({ 0: 'en' })
  })

  it('a second asking line takes a participant out of the settled set', () => {
    const c = buildSecondLanguageCart(
      [product('not_preferred', ['en', 'de']), product('not_preferred', ['de'])],
      [GUIDE, GUIDE],
    )
    // English is preferred on line 1 only: line 2 still asks an English guest.
    expect(settledParticipants(c, { 0: 'en', 1: 'de' }, 2).settled).toEqual({ 1: 'de' })
  })
})
