import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { EstimateLineItem, EvaluatedOffer } from '@/api/types'
import { tr } from '@/lib/strings'
import { evalOffer, PARTY, STAY_DAYS } from './offerFixtures'
import { newPick, type OfferPick, type OfferTreeInput, type PartyMember } from './offerCart'
import { OfferRow } from './OfferRow'

// The per-day stock lookup is its own concern: every day stays selectable.
vi.mock('./companionStock', () => ({ useCompanionDayStock: () => null }))

const TREE: OfferTreeInput = {
  main: { lineId: 'main', productId: 'stay', parentLineId: null, days: STAY_DAYS },
}

function Row({
  offer,
  initial = [],
  members = PARTY,
  locale = 'en',
  estimate,
}: {
  offer: EvaluatedOffer
  initial?: OfferPick[]
  members?: PartyMember[]
  locale?: string
  estimate?: readonly EstimateLineItem[]
}) {
  const [picks, setPicks] = useState<OfferPick[]>(initial)
  const pick = picks.find((p) => p.offerId === offer.id)
  return (
    <>
      <OfferRow
        offer={offer}
        parentLineId="main"
        parentDays={STAY_DAYS}
        pick={pick}
        members={members}
        tree={TREE}
        idPrefix="o"
        onPicksChange={setPicks}
        locale={locale}
        currency="EUR"
        estimate={estimate}
      />
      <output data-testid="picks">{JSON.stringify(picks)}</output>
    </>
  )
}

const picksOf = (): OfferPick[] => JSON.parse(screen.getByTestId('picks').textContent ?? '[]')
const picked = (offer: EvaluatedOffer, over: Partial<OfferPick> = {}): OfferPick => ({
  ...newPick(offer, 'main', 'o1', STAY_DAYS),
  ...over,
})

const OPTIONS = [
  { key: 'one', label: 'One way', label_localized: { de: 'Einfache Fahrt' }, price_delta_cents: 0 },
  { key: 'both', label: 'Both ways', label_localized: { de: 'Hin und zurück' }, price_delta_cents: 1000 },
]

describe('OfferRow: binding person', () => {
  const offer = evalOffer('shuttle', { binding: 'person', options: OPTIONS })

  it('ticks guests and gives each ticked guest an option select with surcharge labels', () => {
    render(<Row offer={offer} />)
    expect(screen.queryByTestId('offer-option-shuttle-g1')).toBeNull()
    fireEvent.click(screen.getByTestId('offer-who-shuttle-g1'))
    const select = screen.getByTestId('offer-option-shuttle-g1')
    expect(screen.queryByTestId('offer-option-shuttle-g2')).toBeNull()
    expect(within(select).getByRole('option', { name: 'One way' })).toBeInTheDocument()
    expect(within(select).getByRole('option', { name: /^Both ways \(\+.*10[.,]00/ })).toBeInTheDocument()
    fireEvent.change(select, { target: { value: 'both' } })
    expect(picksOf()[0]).toMatchObject({ memberIds: ['m1'], options: { m1: 'both' }, quantity: 1 })
    fireEvent.click(screen.getByTestId('offer-who-shuttle-g1'))
    expect(picksOf()).toEqual([])
  })

  it('labels options in the guest\'s language', () => {
    render(<Row offer={offer} locale="de" initial={[picked(offer, { memberIds: ['m2'] })]} />)
    const select = screen.getByTestId('offer-option-shuttle-g2')
    expect(within(select).getByRole('option', { name: 'Einfache Fahrt' })).toBeInTheDocument()
    expect(within(select).getByRole('option', { name: /^Hin und zurück \(\+/ })).toBeInTheDocument()
  })

  it('flags a ticked guest without an option', () => {
    render(<Row offer={offer} initial={[picked(offer, { memberIds: ['m1'] })]} />)
    expect(screen.getByTestId('offer-option-required-shuttle')).toBeInTheDocument()
  })

  it('does not let a guest the rules refuse be ticked', () => {
    const rules = { mode: 'all', items: [{ cond: 'guest_attr', key: 'age', op: 'gte', value: 10 }] }
    const kids: PartyMember[] = [
      { ...PARTY[0]!, attributes: { age: 30 } },
      { ...PARTY[1]!, attributes: { age: 6 } },
    ]
    render(<Row offer={{ ...offer, rules }} members={kids} />)
    expect(screen.getByTestId('offer-who-shuttle-g2')).toBeDisabled()
    expect(screen.getByTestId('offer-who-shuttle-g1')).toBeEnabled()
  })
})

describe('OfferRow: binding booking', () => {
  it('toggles one line for the whole booking, with an option', () => {
    const offer = evalOffer('towels', { options: OPTIONS })
    render(<Row offer={offer} />)
    expect(screen.queryByTestId('offer-option-towels')).toBeNull()
    fireEvent.click(screen.getByTestId('offer-toggle-towels'))
    expect(picksOf()).toHaveLength(1)
    fireEvent.change(screen.getByTestId('offer-option-towels'), { target: { value: 'one' } })
    expect(picksOf()[0]!.options).toEqual({ '*': 'one' })
    fireEvent.click(screen.getByTestId('offer-toggle-towels'))
    expect(picksOf()).toEqual([])
  })

  it('shows a locked schedule as the parent period, read-only', () => {
    const offer = evalOffer('towels')
    render(<Row offer={offer} initial={[picked(offer)]} />)
    expect(screen.getByTestId('offer-period-towels').textContent).toMatch(/whole stay/i)
    expect(screen.queryByTestId('offer-days-towels')).toBeNull()
  })
})

describe('OfferRow: binding free', () => {
  const offer = evalOffer('bikes', { binding: 'free', max_qty: 5, stock: { available: true, stock_remaining: 3 } })

  it('steps from zero and stops at the lower of max_qty and stock', () => {
    render(<Row offer={offer} />)
    expect(screen.getByTestId('offer-qty-bikes')).toHaveTextContent('0')
    expect(screen.getByTestId('offer-qty-minus-bikes')).toBeDisabled()
    const plus = screen.getByTestId('offer-qty-plus-bikes')
    fireEvent.click(plus)
    fireEvent.click(plus)
    fireEvent.click(plus)
    expect(screen.getByTestId('offer-qty-bikes')).toHaveTextContent('3')
    expect(plus).toBeDisabled()
    expect(picksOf()[0]!.quantity).toBe(3)
    fireEvent.click(screen.getByTestId('offer-qty-minus-bikes'))
    expect(screen.getByTestId('offer-qty-bikes')).toHaveTextContent('2')
  })

  it('stops at max_qty when stock is plentiful', () => {
    const roomy = evalOffer('bikes', { binding: 'free', max_qty: 2 })
    render(<Row offer={roomy} initial={[picked(roomy, { quantity: 2 })]} />)
    expect(screen.getByTestId('offer-qty-plus-bikes')).toBeDisabled()
  })

  it('says how many are left when stock runs low', () => {
    render(<Row offer={offer} />)
    expect(screen.getByText(/3/, { selector: 'p' })).toBeInTheDocument()
  })
})

describe('OfferRow: schedule', () => {
  const subset = evalOffer('tour', { schedule: 'subset' })

  it('limits day chips to the parent days and never lets the last day go', () => {
    render(<Row offer={subset} initial={[picked(subset)]} />)
    const chips = screen.getAllByTestId(/^offer-day-tour-/)
    expect(chips.map((c) => c.getAttribute('data-testid'))).toEqual(
      STAY_DAYS.map((d) => `offer-day-tour-${d}`),
    )
    fireEvent.click(screen.getByTestId('offer-day-tour-2026-11-03'))
    expect(picksOf()[0]!.days).toEqual(['2026-11-02', '2026-11-04'])
    fireEvent.click(screen.getByTestId('offer-day-tour-2026-11-04'))
    // One day left: its chip is locked so the pick is never empty.
    expect(screen.getByTestId('offer-day-tour-2026-11-02')).toBeDisabled()
    expect(picksOf()[0]!.days).toEqual(['2026-11-02'])
  })

  it('shows no day chips before the offer is picked', () => {
    render(<Row offer={subset} />)
    expect(screen.queryByTestId('offer-days-tour')).toBeNull()
  })

  it('treats a locked offer on a day-pickable product as a subset', () => {
    const legacy = evalOffer('legacy', { day_selection: 'parent_subset' })
    render(<Row offer={legacy} initial={[picked(legacy)]} />)
    expect(screen.getByTestId('offer-days-legacy')).toBeInTheDocument()
  })
})

describe('OfferRow: mode', () => {
  it('keeps a mandatory booking row picked and not removable', () => {
    const offer = evalOffer('tax', { mode: 'mandatory' })
    render(<Row offer={offer} initial={[picked(offer)]} />)
    expect(screen.getByTestId('offer-mandatory-badge')).toHaveTextContent(tr('offerMandatoryBadge', 'en'))
    const toggle = screen.getByTestId('offer-toggle-tax')
    expect(toggle).toBeChecked()
    expect(toggle).toBeDisabled()
    fireEvent.click(toggle)
    expect(picksOf()).toHaveLength(1)
  })

  it('keeps a mandatory free row at its minimum', () => {
    const offer = evalOffer('gear', { mode: 'mandatory', binding: 'free', min_qty: 2 })
    render(<Row offer={offer} initial={[picked(offer)]} />)
    expect(screen.getByTestId('offer-qty-gear')).toHaveTextContent('2')
    expect(screen.getByTestId('offer-qty-minus-gear')).toBeDisabled()
  })

  it('shows who a server-attached mandatory person offer is added for', () => {
    const offer = evalOffer('pass', { mode: 'mandatory', binding: 'person' })
    const estimate = [
      { auto_attached: true, product_id: offer.product_id, participant_ids: ['g2'], line_total: '5.00' },
    ] as unknown as EstimateLineItem[]
    render(<Row offer={offer} estimate={estimate} />)
    expect(screen.getByTestId('offer-auto-for')).toHaveTextContent('Added for Bo Berg')
    expect(screen.queryByTestId('offer-who-pass-g1')).toBeNull()
  })

  it('names every admitted guest when the estimate has no attached lines yet', () => {
    const offer = evalOffer('pass', { mode: 'mandatory', binding: 'person' })
    render(<Row offer={offer} />)
    expect(screen.getByTestId('offer-auto-for')).toHaveTextContent('Added for Ada Lovelace, Bo Berg')
  })
})

describe('OfferRow: collection and stock', () => {
  const preview = { quantity: 1, total_cents: 1500, price_unit: 'per_booking' }

  it('shows an on-site price as "pay on arrival"', () => {
    const offer = evalOffer('deposit', { collection: 'on_site', price_preview: preview as never })
    render(<Row offer={offer} />)
    expect(screen.getByTestId('offer-price').textContent).toMatch(/15[.,]00.*·\s*Pay on arrival/)
  })

  it('shows a free offer as Free', () => {
    render(<Row offer={evalOffer('tea', { collection: 'free' })} />)
    expect(screen.getByTestId('offer-price')).toHaveTextContent('Free')
  })

  it('disables a sold-out row and says why', () => {
    const offer = evalOffer('raft', {
      binding: 'person',
      stock: { available: false, unavailable_reason: 'sold_out' },
    })
    render(<Row offer={offer} />)
    expect(screen.getByTestId('offer-who-raft-g1')).toBeDisabled()
    expect(screen.getByText(tr('addonSoldOut', 'en'))).toBeInTheDocument()
  })

  it('disables a sold-out booking toggle and free stepper', () => {
    const stock = { available: false, unavailable_reason: 'sold_out' as const }
    const { unmount } = render(<Row offer={evalOffer('a', { stock })} />)
    expect(screen.getByTestId('offer-toggle-a')).toBeDisabled()
    unmount()
    render(<Row offer={evalOffer('b', { binding: 'free', stock })} />)
    expect(screen.getByTestId('offer-qty-plus-b')).toBeDisabled()
  })
})

describe('OfferRow: languages', () => {
  const cases = [
    ['de', 'Required'],
    ['es', 'Required'],
    ['tr', 'Required'],
  ] as const

  it.each(cases)('translates the badge and pay-on-arrival copy (%s)', (locale) => {
    const offer = evalOffer('fee', {
      mode: 'mandatory',
      collection: 'on_site',
      price_preview: { quantity: 1, total_cents: 800, price_unit: 'per_booking' } as never,
    })
    render(<Row offer={offer} locale={locale} initial={[picked(offer)]} />)
    const badge = tr('offerMandatoryBadge', locale)
    const arrival = tr('offerPayOnArrival', locale)
    expect(badge).not.toBe(tr('offerMandatoryBadge', 'en'))
    expect(arrival).not.toBe(tr('offerPayOnArrival', 'en'))
    expect(screen.getByTestId('offer-mandatory-badge')).toHaveTextContent(badge)
    expect(screen.getByTestId('offer-price').textContent).toContain(arrival)
  })
})
