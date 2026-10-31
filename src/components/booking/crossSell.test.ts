import { describe, expect, it } from 'vitest'
import type { AvailabilitySlot, EstimateResponse, FixedDateWindow, Product } from '@/api/types'
import {
  crossSellCandidates,
  crossSellExclusion,
  effectiveLanguages,
  EMPTY_INLINE_MODULES,
  inlineModulesPending,
  lineNeeds,
  type CrossSellContext,
  type ExtraLine,
  extraEstimateRequests,
  extraLinesBlocking,
  extraProductLines,
  freeUnitsFor,
  freeUnitsOfSeats,
  maxQuantityFor,
  inheritLine,
  lineIssue,
  lineMode,
  mergeEstimates,
  preferredWindow,
  unavailableDaysFor,
} from './crossSell'

function product(id: string, over: Partial<Product> = {}): Product {
  return {
    product_id: id,
    slug: id,
    name: id,
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'days_range',
    is_contiguous: false,
    duration_minutes: null,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: null,
    group_slug: null,
    group_name: null,
    sort_order: 0,
    sport_subcategory_codes: [],
    location_ids: [],
    ...over,
  }
}

function slot(date: string, over: Partial<AvailabilitySlot> = {}): AvailabilitySlot {
  return {
    availability_id: `a-${date}`,
    date,
    start_time: null,
    end_time: null,
    capacity: 10,
    capacity_reserved: 0,
    available_seats: 10,
    status: 'open',
    ...over,
  }
}

const MAIN_DAYS = ['2026-11-03', '2026-11-02']

describe('crossSellCandidates', () => {
  it('drops cart products, sold-out, drafts and kinds the funnel cannot book', () => {
    const list = [
      product('main'),
      product('camping', { product_kind: 'stay', service_time_shape: null }),
      product('sold', { bookable: false }),
      product('draft', { is_publicly_listed: false }),
      product('room', { product_kind: 'hotel_room', service_time_shape: null }),
      product('shirt', { product_kind: 'merchandise' as Product['product_kind'], service_time_shape: null }),
      product('tandem', { service_time_shape: 'single_date', daily_start_times: ['10:00'] }),
    ]
    expect(crossSellCandidates(list, ['main']).map((p) => p.product_id)).toEqual([
      'camping',
      'tandem',
    ])
  })
})

describe('inheritLine', () => {
  it('a day product takes the main days, sorted, quantity 1', () => {
    const line = inheritLine(product('pass'), MAIN_DAYS, 'k')
    expect(line).toMatchObject({ mode: 'days', days: ['2026-11-02', '2026-11-03'], quantity: 1 })
  })

  it('a stay books one night per main day', () => {
    const line = inheritLine(
      product('camping', { product_kind: 'stay', service_time_shape: null }),
      MAIN_DAYS,
      'k',
    )
    expect(line).toMatchObject({ mode: 'nights', days: ['2026-11-02', '2026-11-03'] })
  })

  it('a fixed-time product starts on the first main date with no time picked', () => {
    const line = inheritLine(product('tandem', { daily_start_times: ['10:00'] }), MAIN_DAYS, 'k')
    expect(line).toMatchObject({ mode: 'slot', days: ['2026-11-02'], slot: null })
    expect(lineIssue(line)).toBe('needs_time')
  })

  it('a course product waits for its window', () => {
    const p = product('course', { service_time_shape: 'fixed_window' })
    expect(lineMode(p)).toBe('window')
    expect(lineIssue(inheritLine(p, MAIN_DAYS, 'k'))).toBe('needs_window')
  })
})

describe('preferredWindow', () => {
  const w = (id: string, start: string, end: string, reserved = 0) =>
    ({
      id,
      start_date: start,
      end_date: end,
      capacity: 4,
      capacity_reserved: reserved,
    }) as FixedDateWindow
  it('prefers the open window covering the main date, else the next one', () => {
    const ws = [w('full', '2026-11-01', '2026-11-05', 4), w('later', '2026-11-10', '2026-11-12')]
    expect(preferredWindow(ws, MAIN_DAYS)?.id).toBe('later')
    expect(preferredWindow([...ws, w('cover', '2026-11-01', '2026-11-04')], MAIN_DAYS)?.id).toBe('cover')
  })
})

describe('unavailableDaysFor', () => {
  it('flags days with rows but no room for the party; unjudged days pass', () => {
    const slots = [
      slot('2026-11-02', { available_seats: 1 }),
      slot('2026-11-03', { status: 'closed' }),
    ]
    expect(unavailableDaysFor(slots, ['2026-11-02', '2026-11-03', '2026-11-04'], 2)).toEqual([
      '2026-11-02',
      '2026-11-03',
    ])
    expect(unavailableDaysFor(slots, ['2026-11-02'], 1)).toEqual([])
  })
})

describe('submit lines', () => {
  it('maps added lines onto the submit contract (days, slot, window)', () => {
    const days = inheritLine(product('pass'), MAIN_DAYS, 'a')
    const timed = {
      ...inheritLine(product('tandem', { daily_start_times: ['10:00'] }), MAIN_DAYS, 'b'),
      slot: slot('2026-11-02', { availability_id: null, start_time: '10:00:00' }),
      quantity: 2,
    }
    const course = {
      ...inheritLine(product('course', { service_time_shape: 'fixed_window' }), MAIN_DAYS, 'c'),
      windowId: 'w1',
      days: ['2026-11-10'],
    }
    expect(extraProductLines([days, timed, course])).toEqual([
      { product_id: 'pass', quantity: 1, selected_days: ['2026-11-02', '2026-11-03'] },
      { product_id: 'tandem', quantity: 2, selected_days: ['2026-11-02'], slot_start_time: '10:00' },
      { product_id: 'course', quantity: 1, selected_days: ['2026-11-10'], fixed_date_window_id: 'w1' },
    ])
    expect(extraLinesBlocking([days, timed, course])).toBe(false)
    expect(extraLinesBlocking([{ ...days, unavailableDays: ['2026-11-02'] }])).toBe(true)
  })

  it('estimates each added line for the whole party', () => {
    const reqs = extraEstimateRequests([inheritLine(product('pass'), MAIN_DAYS, 'a')], 3)
    expect(reqs).toEqual([
      expect.objectContaining({
        productId: 'pass',
        body: expect.objectContaining({ participants_count: 3, selected_days: ['2026-11-02', '2026-11-03'] }),
      }),
    ])
  })
})

describe('mergeEstimates', () => {
  const est = (id: string, total: string, over: Partial<EstimateResponse> = {}): EstimateResponse => ({
    line_items: [
      { product_id: id, label: id, qty: 1, units: 1, unit_price: total, line_total: total, paid_to: 'operator' },
    ],
    operator_total: total,
    hotel_total: '0.00',
    grand_total: total,
    currency: 'EUR',
    applied_rules: [],
    warnings: [],
    un_priceable: false,
    amount_due: total,
    ...over,
  })

  it('sums every line (times its quantity) into one total', () => {
    const merged = mergeEstimates(est('main', '100.00'), [
      { estimate: est('camping', '12.50'), quantity: 2 },
    ])
    expect(merged.line_items.map((l) => [l.product_id, l.line_total])).toEqual([
      ['main', '100.00'],
      ['camping', '25.00'],
    ])
    expect(merged.amount_due).toBe('125.00')
    expect(merged.grand_total).toBe('125.00')
    expect(merged.un_priceable).toBe(false)
  })

  it('carries an un-priceable added line and keeps savings adding up', () => {
    const merged = mergeEstimates(
      est('main', '90.00', {
        savings: [{ kind: 'multi_day', label: 'Multi-day', amount: '10.00' }],
        savings_total: '10.00',
        subtotal_before_savings: '100.00',
      }),
      [{ estimate: est('x', '0.00', { un_priceable: true }), quantity: 1 }],
    )
    expect(merged.un_priceable).toBe(true)
    expect(merged.subtotal_before_savings).toBe('100.00')
    expect(merged.savings_total).toBe('10.00')
    expect(merged.amount_due).toBe('90.00')
  })
})

const ctx: CrossSellContext = {
  participantLanguages: { 0: 'de', 1: 'en' },
  participantCount: 2,
  mainLanguages: [],
  answeredFormKeys: ['waiver'],
  hasPickup: false,
}
const formModule = (key: string) => ({
  kind: 'custom_form',
  position: 1,
  form: { key, version: 1, name: key, name_localized: null, fields: [] },
})
const lineOf = (p: Product, flow: ExtraLine['flow'] = null) => inheritLine(p, MAIN_DAYS, `x-${p.product_id}`, flow)

describe('crossSellExclusion', () => {
  it('offers any product that shares a guide language with the booking', () => {
    expect(crossSellExclusion(product('a'), ctx, [])).toBeNull()
    expect(crossSellExclusion(product('a', { guide_languages: ['fr'] }), ctx, [])).toBeNull()
    expect(
      crossSellExclusion(product('a', { guide_languages: ['fr'] }), { ...ctx, mainLanguages: ['en', 'de'] }, []),
    ).toBe('language')
  })

  it('leaves out a product sharing no language with an already added line', () => {
    const added = lineOf(product('b', { guide_languages: ['de'] }))
    expect(crossSellExclusion(product('a', { guide_languages: ['en'] }), ctx, [added])).toBe('language')
    expect(crossSellExclusion(product('a', { guide_languages: ['en', 'de'] }), ctx, [added])).toBeNull()
  })

  it('never restricts a stay, which has no guide', () => {
    const stay = product('s', { product_kind: 'stay', service_time_shape: null, guide_languages: ['fr'] })
    expect(crossSellExclusion(stay, { ...ctx, mainLanguages: ['en'] }, [])).toBeNull()
  })
})

describe('lineNeeds', () => {
  it('needs nothing from a product with no own modules', () => {
    expect(lineNeeds([lineOf(product('a'))], ctx)['x-a']).toEqual({ language: false, pickup: false, forms: [] })
  })

  it('asks for a language when the assigned ones do not fit the product', () => {
    const fits = lineOf(product('a', { guide_languages: ['de', 'en'] }))
    expect(lineNeeds([fits], ctx)['x-a']!.language).toBe(false)
    const misses = lineOf(product('a', { guide_languages: ['de', 'fr'] }))
    expect(lineNeeds([misses], ctx)['x-a']!.language).toBe(true)
    expect(lineNeeds([misses], { ...ctx, participantLanguages: {} })['x-a']!.language).toBe(true)
  })

  it('does not ask when one shared language settles it', () => {
    const only = lineOf(product('a', { guide_languages: ['fr'] }))
    expect(lineNeeds([only], { ...ctx, participantLanguages: {} })['x-a']!.language).toBe(false)
  })

  it('asks for the forms the main flow has not answered, once per key', () => {
    const flow = { modules: [formModule('waiver'), formModule('medical')] }
    const a = lineOf(product('a'), flow)
    const b = lineOf(product('b'), flow)
    const needs = lineNeeds([a, b], ctx)
    expect(needs['x-a']!.forms.map((f) => f.key)).toEqual(['medical'])
    expect(needs['x-b']!.forms).toEqual([])
  })

  it('asks for a pickup unless one is set or auto-selected, once for the booking', () => {
    const a = lineOf(product('a', { needs_pickup: true }))
    const b = lineOf(product('b', { needs_pickup: true }))
    const needs = lineNeeds([a, b], ctx)
    expect(needs['x-a']!.pickup).toBe(true)
    expect(needs['x-b']!.pickup).toBe(false)
    expect(lineNeeds([a], { ...ctx, hasPickup: true })['x-a']!.pickup).toBe(false)
    const auto = lineOf(product('c', { needs_pickup: true, auto_pickup_location_id: 'loc' }))
    expect(lineNeeds([auto], ctx)['x-c']!.pickup).toBe(false)
  })
})

describe('inlineModulesPending', () => {
  it('clears as the customer answers each inline module', () => {
    const line = lineOf(
      product('a', { guide_languages: ['de', 'fr'], needs_pickup: true }),
      { modules: [formModule('medical')] },
    )
    const base = { languages: null, formKeys: [], pickupLocationId: null }
    expect(inlineModulesPending([line], ctx, base)).toBe(true)
    const langs = { 0: 'de', 1: 'de' }
    expect(inlineModulesPending([line], ctx, { ...base, languages: langs })).toBe(true)
    expect(
      inlineModulesPending([line], ctx, {
        languages: langs,
        formKeys: ['medical'],
        pickupLocationId: 'loc-1',
      }),
    ).toBe(false)
    // A pick outside the product's languages does not count.
    expect(
      inlineModulesPending([line], ctx, {
        languages: { 0: 'de', 1: 'en' },
        formKeys: ['medical'],
        pickupLocationId: 'loc-1',
      }),
    ).toBe(true)
  })

  it('is false when no added line needs anything', () => {
    expect(inlineModulesPending([lineOf(product('a'))], ctx, EMPTY_INLINE_MODULES)).toBe(false)
  })
})

describe('effectiveLanguages', () => {
  it('leaves the main flow untouched when no added line restricts the languages', () => {
    expect(effectiveLanguages({ 0: 'de' }, null, null, 2)).toEqual({ 0: 'de' })
  })

  it('applies a single shared language to the whole party', () => {
    expect(effectiveLanguages({ 0: 'de' }, null, ['fr'], 3)).toEqual({ 0: 'fr', 1: 'fr', 2: 'fr' })
  })

  it('prefers the inline picks and drops any outside the shared set', () => {
    expect(effectiveLanguages({ 0: 'de', 1: 'en' }, { 0: 'fr', 1: 'es' }, ['fr', 'es'], 2)).toEqual({
      0: 'fr',
      1: 'es',
    })
    expect(effectiveLanguages({ 0: 'de', 1: 'en' }, null, ['en', 'fr'], 2)).toEqual({ 1: 'en' })
  })
})

describe('quantity cap', () => {
  const stay = (cpu: number | null) => ({
    mode: 'nights' as const,
    product: { capacity_per_unit: cpu },
  })
  const svc = { mode: 'days' as const, product: { capacity_per_unit: null } }

  it('caps a stay at ceil(party / capacity_per_unit), min 1', () => {
    expect(maxQuantityFor(stay(2), 1, null)).toBe(1)
    expect(maxQuantityFor(stay(2), 5, null)).toBe(3)
    expect(maxQuantityFor(stay(null), 3, null)).toBe(3)
    expect(maxQuantityFor(stay(4), 0, null)).toBe(1)
  })
  it('takes the lower of free units and the party cap, never below 1', () => {
    expect(maxQuantityFor(stay(1), 4, 2)).toBe(2)
    expect(maxQuantityFor(stay(1), 2, 9)).toBe(2)
    expect(maxQuantityFor(stay(1), 2, 0)).toBe(1)
  })
  it('has no party cap for services and no cap when capacity is unknown', () => {
    expect(maxQuantityFor(svc, 8, 3)).toBe(3)
    expect(maxQuantityFor(svc, 8, null)).toBe(Number.POSITIVE_INFINITY)
  })
  it('derives free units from the lowest night / day', () => {
    const slots = [slot('2026-01-01', { available_seats: 3 }), slot('2026-01-02', { available_seats: 2 })]
    expect(freeUnitsFor(slots, ['2026-01-01', '2026-01-02'], 1)).toBe(2)
    expect(freeUnitsFor(slots, ['2026-01-01', '2026-01-02'], 2)).toBe(1)
    expect(freeUnitsFor(slots, ['2026-02-01'], 1)).toBeNull()
    expect(freeUnitsOfSeats(7, 3)).toBe(2)
  })
})
