/** landr-bwm91.4: price notes line builder. */
import { describe, expect, it } from 'vitest'
import { formatPriceNotes, priceNoteItems } from './priceNotes'

type In = Parameters<typeof formatPriceNotes>[0]

const tandem: In = {
  currency: 'EUR',
  price_base: '150.00',
  price_notes: [
    { kind: 'surcharge', label: 'Weekends', amount: '20', amount_type: 'flat', per_participant: true, weekdays: [6, 7] },
    { kind: 'discount', label: '09:00 start', amount: '-10', amount_type: 'flat', per_participant: true, time_from: '09:00', time_to: '09:00' },
  ],
}

describe('formatPriceNotes', () => {
  it('lists base, surcharges, then discounts (EN)', () => {
    expect(formatPriceNotes(tandem, 'en-GB').join(' · ')).toBe(
      'Base price €150 · Weekends +€20 · 09:00 start −€10',
    )
  })

  it('localizes every part for DE', () => {
    const out = formatPriceNotes(tandem, 'de-DE')
    expect(out).toHaveLength(3)
    expect(out[0]).toMatch(/^Grundpreis 150\s€$/)
    expect(out[1]).toMatch(/^Wochenende \+20\s€$/)
    expect(out[2]).toMatch(/^Start 09:00 −10\s€$/)
    expect(out.join(' ')).not.toMatch(/Weekends|Base price| start/)
  })

  it('puts a discount listed first after the surcharges', () => {
    const [d, s] = tandem.price_notes!.slice().reverse()
    const out = formatPriceNotes({ ...tandem, price_notes: [d, s] }, 'en')
    expect(out[1]).toContain('Weekends')
    expect(out[2]).toContain('09:00 start')
  })

  it('omits the base item when price_base is absent', () => {
    const out = formatPriceNotes({ ...tandem, price_base: undefined }, 'en')
    expect(out).toHaveLength(2)
    expect(out[0]).toContain('Weekends')
  })

  it('renders nothing without adjustment notes (even with a base)', () => {
    expect(formatPriceNotes({ currency: 'EUR', price_base: '150.00' }, 'en')).toEqual([])
    expect(formatPriceNotes({ currency: 'EUR', price_base: '150.00', price_notes: [] }, 'en')).toEqual([])
  })

  it('names other weekdays, time ranges and percent amounts', () => {
    const out = formatPriceNotes(
      {
        currency: 'EUR',
        price_notes: [
          { kind: 'surcharge', label: 'Fri', amount: '5.5', amount_type: 'flat', per_participant: false, weekdays: [5] },
          { kind: 'discount', label: '', amount: '-10', amount_type: 'percent', per_participant: false, time_from: '17:00', time_to: '19:30' },
        ],
      },
      'en-GB',
    )
    expect(out).toEqual(['Fri +€5.50', '17:00–19:30 −10%'])
  })

  it('falls back to the API label for a note without structure', () => {
    const out = formatPriceNotes(
      { currency: 'EUR', price_notes: [{ kind: 'surcharge', label: 'Holidays', amount: '8', amount_type: 'flat', per_participant: false }] },
      'en',
    )
    expect(out).toEqual(['Holidays +€8'])
  })
})

describe('named price notes (landr-soewf)', () => {
  const named: In = {
    currency: 'EUR',
    price_base: '150.00',
    price_notes: [
      {
        kind: 'surcharge', label: 'Weekends', amount: '20', amount_type: 'flat', per_participant: true,
        weekdays: [6, 7],
        name: 'Weekend surcharge',
        name_localized: { de: 'Wochenend-Zuschlag', es: 'Recargo de fin de semana' },
        description: 'Our pilots earn a little bit more during the weekend.',
        description_localized: { de: 'Unsere Piloten verdienen am Wochenende etwas mehr.' },
      },
      { kind: 'discount', label: '09:00 start', amount: '-10', amount_type: 'flat', per_participant: true, time_from: '09:00', time_to: '09:00', name: 'Early Bird' },
    ],
  }

  it('shows the name instead of the automatic label, in the customer language', () => {
    expect(formatPriceNotes(named, 'en-GB')).toEqual(['Base price €150', 'Weekend surcharge +€20', 'Early Bird −€10'])
    expect(formatPriceNotes(named, 'de-DE')[1]).toMatch(/^Wochenend-Zuschlag \+20\s€$/)
    expect(formatPriceNotes(named, 'es')[1]).toMatch(/^Recargo de fin de semana \+20/)
  })

  it('falls back to the plain name, then to the automatic label', () => {
    // No TR entry -> plain name; the unnamed note keeps today's wording.
    expect(formatPriceNotes(named, 'tr')[1]).toMatch(/^Weekend surcharge /)
    const unnamed = { ...named, price_notes: [{ ...named.price_notes![0], name: '', name_localized: { de: '' } }] }
    expect(formatPriceNotes(unnamed, 'de-DE')[1]).toMatch(/^Wochenende /)
  })

  it('carries the description in the customer language with the same fallbacks', () => {
    const items = priceNoteItems(named, 'de')
    expect(items[1].description).toBe('Unsere Piloten verdienen am Wochenende etwas mehr.')
    expect(priceNoteItems(named, 'en')[1].description).toBe('Our pilots earn a little bit more during the weekend.')
    expect(items[0].description).toBeUndefined()
    expect(items[2].description).toBeUndefined()
  })

  it('works for a language added later without a code change', () => {
    const fr: In = {
      currency: 'EUR',
      price_notes: [{ ...named.price_notes![0], name_localized: { fr: 'Supplément week-end' } }],
    }
    expect(formatPriceNotes(fr, 'fr-FR')[0]).toMatch(/^Supplément week-end /)
  })
})
