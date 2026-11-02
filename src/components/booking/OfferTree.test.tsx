import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { EvaluatedLine, EvaluatedOffer } from '@/api/types'
import { tr } from '@/lib/strings'
import { evalOffer, PARTY, STAY_DAYS } from './offerFixtures'
import { newPick, type OfferPick, type OfferTreeInput, type PartyMember } from './offerCart'
import { OfferTree } from './OfferTree'

vi.mock('./companionStock', () => ({ useCompanionDayStock: () => null }))

const TREE: OfferTreeInput = {
  main: { lineId: 'main', productId: 'stay', parentLineId: null, days: STAY_DAYS },
}

const line = (id: string, offers: EvaluatedOffer[]): EvaluatedLine => ({
  line_id: id,
  eligible: true,
  offers,
  draft: false,
})

function Tree({
  verdicts,
  initial = [],
  locale = 'en',
  onAddOwn,
  showParentless,
  isPending,
  members = PARTY,
}: {
  verdicts: Record<string, EvaluatedLine>
  initial?: OfferPick[]
  locale?: string
  onAddOwn?: (o: EvaluatedOffer, parent: string) => void
  showParentless?: boolean
  isPending?: boolean
  members?: PartyMember[]
}) {
  const [picks, setPicks] = useState<OfferPick[]>(initial)
  return (
    <>
      <OfferTree
        parentLineId="main"
        verdicts={verdicts}
        picks={picks}
        onPicksChange={setPicks}
        tree={TREE}
        members={members}
        idPrefix="o"
        locale={locale}
        currency="EUR"
        onAddOwn={onAddOwn}
        showParentless={showParentless}
        isPending={isPending}
      />
      <output data-testid="picks">{JSON.stringify(picks.map((p) => [p.lineId, p.parentLineId]))}</output>
    </>
  )
}

const tour = evalOffer('tour', { product_id: 'tour-p', name: 'Boat tour', sort_order: 1 })
const shoes = evalOffer('shoes', { parent_product_id: 'tour-p', product_id: 'shoes-p', name: 'Water shoes' })
const poncho = evalOffer('poncho', { parent_product_id: 'shoes-p', product_id: 'poncho-p', name: 'Poncho' })
const lamp = evalOffer('lamp', { parent_product_id: 'poncho-p', product_id: 'lamp-p', name: 'Lamp' })

describe('OfferTree', () => {
  it('lists what is included without controls', () => {
    const info = evalOffer('wifi', { mode: 'info', name: 'Wi-Fi', short_description: 'Fast' })
    render(<Tree verdicts={{ main: line('main', [info]) }} />)
    const included = screen.getByTestId('offer-included-wifi')
    expect(included).toHaveTextContent('Wi-Fi')
    expect(included).toHaveTextContent('Fast')
    expect(screen.queryByTestId('offer-row-wifi')).toBeNull()
    expect(within(included).queryByRole('checkbox')).toBeNull()
  })

  it('renders nothing when the line has no offers', () => {
    render(<Tree verdicts={{ main: line('main', []) }} />)
    expect(screen.queryByTestId('offer-tree-main')).toBeNull()
  })

  it('orders rows by sort_order', () => {
    const first = evalOffer('first', { sort_order: 0 })
    render(<Tree verdicts={{ main: line('main', [tour, first]) }} />)
    const ids = screen.getAllByTestId(/^offer-row-/).map((e) => e.getAttribute('data-testid'))
    expect(ids).toEqual(['offer-row-first', 'offer-row-tour'])
  })

  it('shows the picked offer\'s own offers one level indented (stay, tour, shoes)', () => {
    const verdicts = { main: line('main', [tour]), o1: line('o1', [shoes]) }
    render(<Tree verdicts={verdicts} />)
    expect(screen.queryByTestId('offer-tree-o1')).toBeNull()
    fireEvent.click(screen.getByTestId('offer-toggle-tour'))
    const nested = screen.getByTestId('offer-tree-o1')
    expect(nested.className).toMatch(/ml-4/)
    expect(screen.getByTestId('offer-tree-main').className).not.toMatch(/ml-4/)
    expect(within(nested).getByTestId('offer-row-shoes')).toBeInTheDocument()
    fireEvent.click(within(nested).getByTestId('offer-toggle-shoes'))
    expect(JSON.parse(screen.getByTestId('picks').textContent!)).toEqual([
      ['o1', 'main'],
      ['o2', 'o1'],
    ])
    // Un-picking the tour takes its shoes with it.
    fireEvent.click(screen.getByTestId('offer-toggle-tour'))
    expect(JSON.parse(screen.getByTestId('picks').textContent!)).toEqual([])
  })

  it('stops nesting at depth 3', () => {
    const p1 = { ...newPick(tour, 'main', 'o1', STAY_DAYS) }
    const p2 = { ...newPick(shoes, 'o1', 'o2', STAY_DAYS) }
    const p3 = { ...newPick(poncho, 'o2', 'o3', STAY_DAYS) }
    const verdicts = {
      main: line('main', [tour]),
      o1: line('o1', [shoes]),
      o2: line('o2', [poncho]),
      o3: line('o3', [lamp]),
    }
    render(<Tree verdicts={verdicts} initial={[p1, p2, p3]} />)
    expect(screen.getByTestId('offer-row-tour')).toBeInTheDocument()
    expect(screen.getByTestId('offer-row-shoes')).toBeInTheDocument()
    expect(screen.getByTestId('offer-row-poncho')).toBeInTheDocument()
    expect(screen.queryByTestId('offer-tree-o3')).toBeNull()
    expect(screen.queryByTestId('offer-row-lamp')).toBeNull()
  })

  it('offers own-dated products as add buttons, not rows', () => {
    const camping = evalOffer('camp', { schedule: 'own', parent_product_id: null, product_id: 'camping', name: 'Camping' })
    const onAddOwn = vi.fn()
    render(<Tree verdicts={{ main: line('main', [camping]) }} onAddOwn={onAddOwn} />)
    expect(screen.queryByTestId('offer-row-camp')).toBeNull()
    fireEvent.click(screen.getByTestId('add-more-candidate-camping'))
    expect(onAddOwn).toHaveBeenCalledWith(expect.objectContaining({ id: 'camp' }), 'main')
  })

  it('hides parent-less offers when asked to', () => {
    const generic = evalOffer('generic', { parent_product_id: null })
    render(<Tree verdicts={{ main: line('main', [generic, tour]) }} showParentless={false} />)
    expect(screen.queryByTestId('offer-row-generic')).toBeNull()
    expect(screen.getByTestId('offer-row-tour')).toBeInTheDocument()
  })

  it('hides an offer the party plainly fails while the answer is in flight', () => {
    const adults = evalOffer('adults', {
      rules: { mode: 'all', items: [{ cond: 'guest_attr_all', key: 'age', op: 'gte', value: 18 }] },
    })
    const young = [{ ...PARTY[0]!, attributes: { age: 5 } }]
    const verdicts = { main: line('main', [adults, tour]) }
    const { unmount } = render(<Tree verdicts={verdicts} members={young} isPending />)
    expect(screen.queryByTestId('offer-row-adults')).toBeNull()
    expect(screen.getByTestId('offer-row-tour')).toBeInTheDocument()
    expect(screen.getByTestId('offer-tree-main')).toHaveAttribute('aria-busy', 'true')
    unmount()
    // Once the answer is in, the server's verdict rules (no local hiding).
    render(<Tree verdicts={verdicts} members={young} />)
    expect(screen.getByTestId('offer-row-adults')).toBeInTheDocument()
  })

  it.each(['de', 'es', 'tr'])('shows the badge and pay-on-arrival copy in %s', (locale) => {
    const fee = evalOffer('fee', {
      mode: 'mandatory',
      collection: 'on_site',
      price_preview: { quantity: 1, total_cents: 800, price_unit: 'per_booking' } as never,
    })
    render(<Tree verdicts={{ main: line('main', [fee]) }} locale={locale} />)
    expect(tr('offerMandatoryBadge', locale)).not.toBe(tr('offerMandatoryBadge', 'en'))
    expect(screen.getByTestId('offer-mandatory-badge')).toHaveTextContent(tr('offerMandatoryBadge', locale))
    expect(screen.getByTestId('offer-price').textContent).toContain(tr('offerPayOnArrival', locale))
  })
})
