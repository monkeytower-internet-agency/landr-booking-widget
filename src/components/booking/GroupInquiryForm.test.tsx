/**
 * Tests for GroupInquiryForm (landr-ehye).
 *
 * Coverage:
 * - Form renders at participant max (via DetailsStep integration)
 * - Successful submit shows success state + calls the endpoint with the right body
 * - Failure falls back to the mailto: link
 * - Mock mode works gracefully (submitGroupInquiry resolves immediately in mocks)
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'

import * as client from '@/api/client'
import type { Product } from '@/api/types'
import type { BookingSelection } from './BookingForm'
import { DetailsStep } from './DetailsStep'
import { GroupInquiryForm } from './GroupInquiryForm'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    product_id: 'p-1',
    slug: 'tandem-classic',
    name: 'Tandem Classic',
    name_localized: null,
    short_description: null,
    short_description_localized: null,
    description: null,
    product_kind: 'service',
    service_time_shape: 'single_date',
    is_contiguous: false,
    duration_minutes: 30,
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
    hotel_location_id: null,
    price_per_unit: null,
    currency: 'EUR',
    is_publicly_listed: true,
    bookable: true,
    thumb_url: null,
    images: [],
    price_from: null,
    ...overrides,
  }
}

const DAYS_SELECTION: BookingSelection = {
  kind: 'days',
  selectedDays: ['2026-05-23'],
}

/** Fill booker fields so the DetailsStep doesn't block on validation. */
function fillBooker({
  first = 'Ada',
  last = 'Lovelace',
  email = 'ada@example.com',
  phone = '+34 600 000 000',
} = {}) {
  const byName = <T extends HTMLElement = HTMLInputElement>(name: string) => {
    const el = document.querySelector<T>(`[name="${name}"]`)
    if (!el) throw new Error(`No input named ${name}`)
    return el
  }
  fireEvent.change(byName('booker_first_name'), { target: { value: first } })
  fireEvent.change(byName('booker_last_name'), { target: { value: last } })
  fireEvent.change(byName('booker_email'), { target: { value: email } })
  fireEvent.change(byName('booker_phone'), { target: { value: phone } })
}

/** Click "Add participant" 5 times to reach the max. */
function reachParticipantMax() {
  for (let i = 0; i < 5; i += 1) {
    fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
  }
}

// ---------------------------------------------------------------------------
// Tests: GroupInquiryForm renders at participant max (DetailsStep integration)
// ---------------------------------------------------------------------------

describe('GroupInquiryForm — renders at participant max (landr-ehye)', () => {
  it('shows the inline inquiry form when participants hit the max', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        contactEmail="ops@para42.example"
        operatorToken="test-token"
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    reachParticipantMax()
    expect(screen.getByTestId('group-inquiry-form')).toBeInTheDocument()
  })

  it('does NOT show the inquiry form before the participant max is reached', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        contactEmail="ops@para42.example"
        operatorToken="test-token"
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('group-inquiry-form')).not.toBeInTheDocument()
    // Adding 4 (not 5) also doesn't show it.
    for (let i = 0; i < 4; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    }
    expect(screen.queryByTestId('group-inquiry-form')).not.toBeInTheDocument()
  })

  it('pre-fills the name and email from the booker fields', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        contactEmail="ops@para42.example"
        operatorToken="test-token"
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    fillBooker({ first: 'Ada', last: 'Lovelace', email: 'ada@example.com' })
    reachParticipantMax()
    expect(
      (document.querySelector<HTMLInputElement>('[name="inquiry_name"]'))?.value,
    ).toBe('Ada Lovelace')
    expect(
      (document.querySelector<HTMLInputElement>('[name="inquiry_email"]'))?.value,
    ).toBe('ada@example.com')
  })

  it('shows the mailto: link as a secondary escape hatch when contactEmail is set', () => {
    render(
      <DetailsStep
        product={makeProduct()}
        selection={DAYS_SELECTION}
        contactEmail="ops@para42.example"
        operatorToken="test-token"
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    reachParticipantMax()
    // The "Or email us" link carries the testid from PR #108 so operator
    // tests can still locate it.
    const link = screen.getByTestId('participants-contact-mailto')
    expect(link).toHaveAttribute('href', expect.stringContaining('ops@para42.example'))
  })
})

// ---------------------------------------------------------------------------
// Tests: successful submit
// ---------------------------------------------------------------------------

describe('GroupInquiryForm — successful submit (landr-ehye)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows success state after a successful submit', async () => {
    vi.spyOn(client, 'submitGroupInquiry').mockResolvedValue({ ok: true })

    render(
      <GroupInquiryForm
        operatorToken="test-token"
        productSlug="tandem-classic"
        defaultName="Ada Lovelace"
        defaultEmail="ada@example.com"
        contactMailto="mailto:ops@para42.example"
        contactEmail="ops@para42.example"
      />,
    )

    fireEvent.change(document.querySelector('[name="inquiry_party_size"]')!, {
      target: { value: '10' },
    })
    fireEvent.change(document.querySelector('[name="inquiry_message"]')!, {
      target: { value: 'We need 10 slots for a school group' },
    })
    fireEvent.click(screen.getByTestId('group-inquiry-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('group-inquiry-success')).toBeInTheDocument()
    })
    expect(screen.getByTestId('group-inquiry-success')).toHaveTextContent(
      /thanks.*in touch/i,
    )
  })

  it('calls submitGroupInquiry with the correct body', async () => {
    const spy = vi
      .spyOn(client, 'submitGroupInquiry')
      .mockResolvedValue({ ok: true })

    render(
      <GroupInquiryForm
        operatorToken="test-token"
        productSlug="tandem-classic"
        defaultName="Ada Lovelace"
        defaultEmail="ada@example.com"
      />,
    )

    fireEvent.change(document.querySelector('[name="inquiry_party_size"]')!, {
      target: { value: '12' },
    })
    fireEvent.change(document.querySelector('[name="inquiry_message"]')!, {
      target: { value: 'Flight school booking for 12 students' },
    })
    fireEvent.click(screen.getByTestId('group-inquiry-submit'))

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith('test-token', {
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        party_size: 12,
        message: 'Flight school booking for 12 students',
        product_slug: 'tandem-classic',
      })
    })
  })
})

// ---------------------------------------------------------------------------
// Tests: error fallback to mailto:
// ---------------------------------------------------------------------------

describe('GroupInquiryForm — error falls back to mailto: (landr-ehye)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the mailto: fallback link on submit error', async () => {
    vi.spyOn(client, 'submitGroupInquiry').mockRejectedValue(
      new Error('Network error'),
    )

    render(
      <GroupInquiryForm
        operatorToken="test-token"
        productSlug="tandem-classic"
        defaultName="Ada Lovelace"
        defaultEmail="ada@example.com"
        contactMailto="mailto:ops@para42.example?subject=Larger%20group"
        contactEmail="ops@para42.example"
      />,
    )

    fireEvent.change(document.querySelector('[name="inquiry_party_size"]')!, {
      target: { value: '15' },
    })
    fireEvent.change(document.querySelector('[name="inquiry_message"]')!, {
      target: { value: 'Group of 15' },
    })
    fireEvent.click(screen.getByTestId('group-inquiry-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('group-inquiry-error')).toBeInTheDocument()
    })
    const fallback = screen.getByTestId('group-inquiry-mailto-fallback')
    expect(fallback).toHaveAttribute(
      'href',
      'mailto:ops@para42.example?subject=Larger%20group',
    )
  })

  it('shows the error state without a mailto link when no contactEmail', async () => {
    vi.spyOn(client, 'submitGroupInquiry').mockRejectedValue(
      new Error('Server error'),
    )

    render(
      <GroupInquiryForm
        operatorToken="test-token"
        productSlug={null}
        defaultName="Ada Lovelace"
        defaultEmail="ada@example.com"
      />,
    )

    fireEvent.change(document.querySelector('[name="inquiry_party_size"]')!, {
      target: { value: '8' },
    })
    fireEvent.change(document.querySelector('[name="inquiry_message"]')!, {
      target: { value: 'Group of 8' },
    })
    fireEvent.click(screen.getByTestId('group-inquiry-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('group-inquiry-error')).toBeInTheDocument()
    })
    expect(
      screen.queryByTestId('group-inquiry-mailto-fallback'),
    ).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Tests: mock mode
// ---------------------------------------------------------------------------

describe('GroupInquiryForm — mock mode (landr-ehye)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCKS', '1')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('resolves successfully in mock mode without a real API call', async () => {
    render(
      <GroupInquiryForm
        operatorToken="demo-token"
        productSlug="tandem-classic"
        defaultName="Demo User"
        defaultEmail="demo@example.com"
      />,
    )

    fireEvent.change(document.querySelector('[name="inquiry_party_size"]')!, {
      target: { value: '9' },
    })
    fireEvent.change(document.querySelector('[name="inquiry_message"]')!, {
      target: { value: 'Demo inquiry' },
    })
    fireEvent.click(screen.getByTestId('group-inquiry-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('group-inquiry-success')).toBeInTheDocument()
    })
  })
})
