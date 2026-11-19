/**
 * landr-hdk4y.2 — the second-guiding-language rule, mirrored from the API
 * (app/services/second_guiding_language.py, landr-hdk4y.1). The cases below are
 * the ones that file's own tests pin: keep the two in step.
 */
import { describe, expect, it } from 'vitest'
import {
  applyAnswerToEveryone,
  askedParticipants,
  buildSecondLanguageCart,
  pruneAcceptedAnswers,
  secondLanguageLine,
  secondLanguageOptions,
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

  it('an unrestricted (any-language) cart has no list to offer for "all", but does for "preferred"', () => {
    const any = buildSecondLanguageCart([product('always')], [[]])
    expect(any.cartLanguages).toBeNull()
    expect(secondLanguageOptions(any, 'fr')).toEqual([])
    const pref = buildSecondLanguageCart([product('always', ['en', 'de'], 'preferred')], [[]])
    expect(secondLanguageOptions(pref, 'fr')).toEqual(['de', 'en'])
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

  it('an unknown main language counts as not preferred', () => {
    expect(secondLanguageOptions(cartOf(product('not_preferred')), null)).toEqual(['de', 'en', 'es', 'fr'])
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
