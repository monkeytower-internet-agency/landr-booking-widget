/**
 * landr-d8rg.7: ProductDetailStep tests.
 *
 * Covers: base render, gallery swap (thumbnail click swaps hero), facts
 * chips conditional rendering, price hidden when price_from is null,
 * onBook / onBack callbacks fire, sold-out (FullyBookedNotice + no Book
 * CTA), markdown description renders, and the variant-aware title
 * treatment (aurora overlay vs summit/alpine heading-below).
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '@/api/types'
import { VariantProvider } from '@/lib/variant.tsx'
import type { Variant } from '@/lib/variant'
import { ProductDetailStep } from './ProductDetailStep'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    product_id: 'p-1',
    slug: 'tandem-classic',
    name: 'Tandem Classic',
    name_localized: null,
    short_description: 'A great flight.',
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'time_slot',
    is_contiguous: false,
    duration_minutes: 25,
    fixed_start_date: null,
    fixed_end_date: null,
    product_group_id: null,
    group_slug: null,
    group_name: null,
    sort_order: 0,
    sport_subcategory_codes: [],
    location_ids: [],
    needs_pickup: false,
    hotel_offering: 'none',
    currency: 'EUR',
    bookable: true,
    images: [],
    price_from: '59.00',
    ...overrides,
  }
}

function renderStep(
  product: Product,
  {
    onBook = vi.fn(),
    onBack = vi.fn(),
    variant = 'summit' as Variant,
    partySize,
  }: {
    onBook?: () => void
    onBack?: () => void
    variant?: Variant
    partySize?: number
  } = {},
) {
  render(
    <VariantProvider value={variant}>
      <ProductDetailStep
        product={product}
        onBook={onBook}
        onBack={onBack}
        partySize={partySize}
      />
    </VariantProvider>,
  )
  return { onBook, onBack }
}

const IMAGES = [
  {
    thumb_url: 'https://img/thumb-1.webp',
    hero_url: 'https://img/hero-1.webp',
    alt: 'First view',
  },
  {
    thumb_url: 'https://img/thumb-2.webp',
    hero_url: 'https://img/hero-2.webp',
    alt: 'Second view',
  },
]

describe('ProductDetailStep', () => {
  it('renders the name, facts and Book CTA for a bookable product', () => {
    renderStep(makeProduct())
    expect(screen.getByTestId('product-detail-step')).toBeInTheDocument()
    expect(screen.getByTestId('product-detail-name')).toHaveTextContent(
      'Tandem Classic',
    )
    expect(screen.getByTestId('product-detail-book-cta')).toBeInTheDocument()
    // duration chip present
    expect(screen.getByTestId('product-facts')).toHaveTextContent('25 min')
  })

  it('falls back to ProductArt when there are no images and shows no thumb strip', () => {
    renderStep(makeProduct({ images: [] }))
    expect(
      screen.queryByTestId('product-gallery-hero-image'),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('product-gallery-thumbs')).not.toBeInTheDocument()
  })

  it('renders a single image hero with no thumbnail strip', () => {
    renderStep(makeProduct({ images: [IMAGES[0]] }))
    expect(screen.getByTestId('product-gallery-hero-image')).toHaveAttribute(
      'src',
      IMAGES[0].hero_url,
    )
    expect(screen.queryByTestId('product-gallery-thumbs')).not.toBeInTheDocument()
  })

  it('swaps the hero when a thumbnail is clicked', () => {
    renderStep(makeProduct({ images: IMAGES }))
    const hero = screen.getByTestId('product-gallery-hero-image')
    expect(hero).toHaveAttribute('src', IMAGES[0].hero_url)

    const thumbs = screen.getAllByTestId('product-gallery-thumb')
    expect(thumbs).toHaveLength(2)
    fireEvent.click(thumbs[1])

    expect(screen.getByTestId('product-gallery-hero-image')).toHaveAttribute(
      'src',
      IMAGES[1].hero_url,
    )
    // selection ring follows the active thumb
    expect(thumbs[1]).toHaveAttribute('data-active', 'true')
    expect(thumbs[0]).toHaveAttribute('data-active', 'false')
  })

  it('conditionally renders facts chips (hotel + pickup)', () => {
    renderStep(
      makeProduct({
        duration_minutes: null,
        hotel_offering: 'optional',
        needs_pickup: true,
      }),
    )
    const facts = screen.getByTestId('product-facts')
    expect(facts).toHaveTextContent('Hotel optional')
    expect(facts).toHaveTextContent('Pickup available')
    expect(facts).not.toHaveTextContent('min')
  })

  it('renders the languages fact with flag + English name and a sentence aria-label (landr-pv2r1)', () => {
    renderStep(makeProduct({ guide_languages: ['en', 'es', 'de', 'fr'] }))
    const facts = screen.getByTestId('product-facts')
    expect(facts).toHaveTextContent('English')
    expect(facts).toHaveTextContent('🇬🇧')
    const langFact = screen.getByLabelText(
      'Offered in English, Spanish, German and French',
    )
    expect(langFact).toHaveTextContent('🇬🇧 English · 🇪🇸 Spanish · 🇩🇪 German · 🇫🇷 French')
    // the languages fact is the last chip in the row
    const all = within(facts).getAllByTestId('product-fact')
    expect(all[all.length - 1]).toBe(langFact)
  })

  it('keeps each flag with its name and avoids a pill radius so the languages fact wraps cleanly at phone width (landr-pv2r1)', () => {
    renderStep(
      makeProduct({ guide_languages: ['en', 'es', 'de', 'fr', 'it', 'nl', 'pt'] }),
    )
    const list = screen.getByTestId('product-fact-languages')
    expect(list.className).toMatch(/\bflex-wrap\b/)
    const units = within(list).getAllByTestId('product-fact-language')
    expect(units).toHaveLength(7)
    for (const unit of units) {
      expect(unit.className).toMatch(/\bwhitespace-nowrap\b/)
      // flag and name live in the same nowrap unit
      expect(unit.textContent).toMatch(/^\S+ \p{L}+$/u)
    }
    const langFact = list.closest('li') as HTMLElement
    expect(langFact.className).not.toMatch(/\brounded-full\b/)
  })

  it('keeps the square alpine radius on the languages fact (landr-pv2r1)', () => {
    renderStep(makeProduct({ guide_languages: ['en', 'es'] }), { variant: 'alpine' })
    const langFact = screen.getByTestId('product-fact-languages').closest('li') as HTMLElement
    expect(langFact.className).toMatch(/\brounded-sm\b/)
  })

  it('shows no languages fact for an any-language product (landr-pv2r1)', () => {
    renderStep(makeProduct({ guide_languages: [] }))
    expect(screen.queryByTestId('product-fact-languages')).not.toBeInTheDocument()
  })

  it('shows the "from" price and hides it when price_from is null', () => {
    const { unmount } = render(
      <VariantProvider value="summit">
        <ProductDetailStep
          product={makeProduct({ price_from: '59.00' })}
          onBook={vi.fn()}
          onBack={vi.fn()}
        />
      </VariantProvider>,
    )
    expect(screen.getByTestId('product-detail-price')).toHaveTextContent(
      'from €59.00',
    )
    unmount()

    renderStep(makeProduct({ price_from: null }))
    expect(screen.queryByTestId('product-detail-price')).not.toBeInTheDocument()
  })

  it('fires onBook when the Book CTA is clicked', () => {
    const { onBook } = renderStep(makeProduct())
    fireEvent.click(screen.getByTestId('product-detail-book-cta'))
    expect(onBook).toHaveBeenCalledTimes(1)
  })

  it('fires onBack when the Back link is clicked', () => {
    const { onBack } = renderStep(makeProduct())
    fireEvent.click(screen.getByTestId('step-back-button'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  // landr-3y1u3: a top-level ?product= deep link (no group/category scope)
  // has nowhere legitimate for Back to lead, so App.tsx omits onBack — the
  // component must render with no Back affordance in that case.
  it('renders no Back link when onBack is omitted (top-level deep link)', () => {
    render(
      <VariantProvider value="summit">
        <ProductDetailStep product={makeProduct()} onBook={vi.fn()} />
      </VariantProvider>,
    )
    expect(screen.queryByTestId('step-back-button')).not.toBeInTheDocument()
  })

  it('renders no Back link on the sold-out state when onBack is omitted', () => {
    render(
      <VariantProvider value="summit">
        <ProductDetailStep
          product={makeProduct({ bookable: false })}
          onBook={vi.fn()}
        />
      </VariantProvider>,
    )
    expect(screen.getByTestId('fully-booked-badge')).toBeInTheDocument()
    expect(screen.queryByTestId('step-back-button')).not.toBeInTheDocument()
  })

  it('renders markdown description via the shared pipeline', () => {
    renderStep(
      makeProduct({ description: '# Heading\n\nSome **bold** body copy.' }),
    )
    const desc = screen.getByTestId('product-detail-description')
    expect(within(desc).getByRole('heading', { name: 'Heading' })).toBeInTheDocument()
    expect(within(desc).getByText('bold')).toBeInTheDocument()
  })

  it('shows the Fully booked state and no Book CTA when sold out', () => {
    renderStep(makeProduct({ bookable: false }))
    expect(screen.getByTestId('fully-booked-badge')).toBeInTheDocument()
    expect(
      screen.queryByTestId('product-detail-book-cta'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('product-detail-book-cta-mobile'),
    ).not.toBeInTheDocument()
  })

  it('overlays the title on the hero for the aurora variant (no separate heading)', () => {
    renderStep(makeProduct({ images: IMAGES }), { variant: 'aurora' })
    expect(
      screen.getByTestId('product-gallery-overlay-title'),
    ).toHaveTextContent('Tandem Classic')
    // aurora hides the standalone heading to avoid a duplicate title
    expect(screen.queryByTestId('product-detail-name')).not.toBeInTheDocument()
  })

  it('renders a heading below the hero for non-aurora variants', () => {
    renderStep(makeProduct({ images: IMAGES }), { variant: 'alpine' })
    expect(screen.getByTestId('product-detail-name')).toHaveTextContent(
      'Tandem Classic',
    )
    expect(
      screen.queryByTestId('product-gallery-overlay-title'),
    ).not.toBeInTheDocument()
  })
})

// User report 2026-06-04: products with ONLY a short_description (no long
// description) showed no copy at all on the detail page — the page rendered
// product.description exclusively. Long wins when present; short is the
// fallback; localized variants are picked like everywhere else.
describe('ProductDetailStep price notes (landr-bwm91.4)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const notes: Partial<Product> = {
    price_from: '140.00',
    price_base: '150.00',
    price_notes: [
      { kind: 'surcharge', label: 'Weekends', amount: '20', amount_type: 'flat', per_participant: true, weekdays: [6, 7] },
      { kind: 'discount', label: '09:00 start', amount: '-10', amount_type: 'flat', per_participant: true, time_from: '09:00', time_to: '09:00' },
    ],
  }

  it('lists base, surcharges and discounts under the price', () => {
    renderStep(makeProduct(notes))
    const el = screen.getByTestId('product-detail-price-notes')
    expect(el.textContent).toBe('Base price €150 · Weekends +€20 · 09:00 start \u2212€10')
    expect(screen.getByTestId('product-detail-price').textContent).toBe('from €140.00')
  })

  it('renders the "from" headline in German for a German browser (landr-bwm91.7)', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('de-DE')
    renderStep(makeProduct(notes))
    expect(screen.getByTestId('product-detail-price').textContent).toBe(
      'ab 140,00\u00a0€',
    )
    expect(screen.getByTestId('product-detail-price-notes').textContent).toMatch(
      /^Grundpreis /,
    )
  })

  it('shows a named note with its description behind a chevron, also as hover text', () => {
    renderStep(
      makeProduct({
        ...notes,
        price_notes: [
          {
            kind: 'surcharge', label: 'Weekends', amount: '20', amount_type: 'flat', per_participant: true,
            weekdays: [6, 7], name: 'Weekend surcharge',
            description: 'Our pilots earn a little bit more during the weekend.',
          },
        ],
      }),
    )
    const el = screen.getByTestId('product-detail-price-notes')
    expect(el.textContent).toBe('Base price €150 · Weekend surcharge +€20')
    const note = screen.getByTestId('product-detail-price-note')
    expect(note).toHaveAttribute('title', 'Our pilots earn a little bit more during the weekend.')
    expect(screen.queryByTestId('product-detail-price-note-description')).toBeNull()
    const toggle = screen.getByRole('button', { name: 'Show details about Weekend surcharge' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(screen.getByTestId('product-detail-price-note-description')).toHaveTextContent(
      'Our pilots earn a little bit more during the weekend.',
    )
    expect(screen.getByRole('button', { name: 'Hide details about Weekend surcharge' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('has no chevron for a note without a description', () => {
    renderStep(makeProduct(notes))
    expect(screen.queryByRole('button', { name: /details about/i })).toBeNull()
  })

  it('renders nothing when there are no notes or the field is absent', () => {
    renderStep(makeProduct({ price_base: '150.00', price_notes: [] }))
    expect(screen.queryByTestId('product-detail-price-notes')).toBeNull()
  })

  it('tolerates an API that predates the field', () => {
    renderStep(makeProduct())
    expect(screen.queryByTestId('product-detail-price-notes')).toBeNull()
  })
})

describe('ProductDetailStep description fallback', () => {
  it('falls back to short_description when description is null', () => {
    renderStep(
      makeProduct({ description: null, short_description: 'A great flight.' }),
    )
    expect(
      screen.getByTestId('product-detail-description'),
    ).toHaveTextContent('A great flight.')
  })

  it('prefers the long description when both exist', () => {
    renderStep(
      makeProduct({
        description: 'Long form **copy**.',
        short_description: 'Short.',
      }),
    )
    const el = screen.getByTestId('product-detail-description')
    expect(el).toHaveTextContent('Long form copy.')
    expect(el).not.toHaveTextContent('Short.')
  })

  it('renders nothing when neither description exists', () => {
    renderStep(
      makeProduct({ description: null, short_description: null }),
    )
    expect(
      screen.queryByTestId('product-detail-description'),
    ).not.toBeInTheDocument()
  })
})

describe('ProductDetailStep localized long description (landr-5wwuq.3)', () => {
  const withLocale = (lang: string) =>
    vi.spyOn(navigator, 'language', 'get').mockReturnValue(lang)
  afterEach(() => vi.restoreAllMocks())

  it('shows description_localized for the browser locale', () => {
    withLocale('de-DE')
    renderStep(
      makeProduct({
        description: 'English long copy.',
        description_localized: { en: 'English long copy.', de: 'Deutscher Langtext.' },
      }),
    )
    expect(screen.getByTestId('product-detail-description')).toHaveTextContent(
      'Deutscher Langtext.',
    )
  })

  it('shows the Italian long description for an it browser', () => {
    withLocale('it-IT')
    renderStep(
      makeProduct({
        description: 'English long copy.',
        description_localized: { it: 'Testo lungo italiano.' },
      }),
    )
    expect(screen.getByTestId('product-detail-description')).toHaveTextContent(
      'Testo lungo italiano.',
    )
  })

  it('falls back to the English description when the locale is missing', () => {
    withLocale('tr-TR')
    renderStep(
      makeProduct({
        description: 'English long copy.',
        description_localized: { de: 'Deutscher Langtext.' },
      }),
    )
    expect(screen.getByTestId('product-detail-description')).toHaveTextContent(
      'English long copy.',
    )
  })

  it('works against an older API without description_localized (falls to localized short)', () => {
    withLocale('de-DE')
    renderStep(
      makeProduct({
        description: null,
        short_description: 'Short.',
        short_description_localized: { de: 'Kurz.' },
      }),
    )
    expect(screen.getByTestId('product-detail-description')).toHaveTextContent('Kurz.')
  })
})

describe('ProductDetailStep — next action + zen (landr-80ubl.2)', () => {
  it('exactly one NextAction is active: the desktop Book CTA (mobile bar is a plain duplicate)', () => {
    renderStep(makeProduct())
    expect(
      document.querySelectorAll('[data-next-action="active"]'),
    ).toHaveLength(1)
    expect(screen.getByTestId('next-action-cue')).toHaveTextContent(
      'Next: book this trip',
    )
  })

  it('shows the too-small hint for a stay that cannot take the party (landr-nd4ar)', () => {
    const stay = makeProduct({ product_kind: 'stay', capacity_per_unit: 2 })
    renderStep(stay, { partySize: 3 })
    expect(screen.getByTestId('product-detail-too-small')).toHaveTextContent(
      'too small for 3',
    )
  })

  it('shows no too-small hint without a party size (landr-nd4ar)', () => {
    const stay = makeProduct({ product_kind: 'stay', capacity_per_unit: 2 })
    renderStep(stay)
    expect(screen.queryByTestId('product-detail-too-small')).not.toBeInTheDocument()
  })
})
