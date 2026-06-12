/**
 * Tests for GroupInquiryForm (landr-ehye; modal redesign landr-amg6).
 *
 * Coverage:
 * - At the participant max a "Request more" button shows (NOT the inline form);
 *   clicking it opens the overlay modal containing the form (DetailsStep
 *   integration).
 * - Cancel closes the modal and discards the in-progress inquiry.
 * - Send is disabled until Name + a valid Email are present; phone / group size
 *   / message are optional and never gate Send.
 * - Successful submit shows success state + calls the endpoint with the right
 *   body (now including the optional `phone` key).
 * - Failure KEEPS the modal/form open and surfaces the mailto: fallback.
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

/** Click the "Request more" button to open the inquiry overlay modal. */
function openInquiryModal() {
  fireEvent.click(screen.getByTestId('group-inquiry-open'))
}

// ---------------------------------------------------------------------------
// Tests: "Request more" button + overlay modal (DetailsStep integration)
// ---------------------------------------------------------------------------

describe('GroupInquiry — "Request more" opens an overlay modal (landr-amg6)', () => {
  it('shows a "Request more" button (NOT the inline form) at the participant max', () => {
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
    // The "Request more" button is present…
    expect(screen.getByTestId('group-inquiry-open')).toBeInTheDocument()
    // …and the inquiry form is NOT rendered until the modal is opened.
    expect(screen.queryByTestId('group-inquiry-form')).not.toBeInTheDocument()
  })

  it('opens the modal with the inquiry form when "Request more" is clicked', () => {
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
    openInquiryModal()
    expect(screen.getByTestId('group-inquiry-modal')).toBeInTheDocument()
    expect(screen.getByTestId('group-inquiry-form')).toBeInTheDocument()
  })

  it('does NOT show the "Request more" button before the participant max is reached', () => {
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
    expect(screen.queryByTestId('group-inquiry-open')).not.toBeInTheDocument()
    // Adding 4 (not 5) also doesn't show it.
    for (let i = 0; i < 4; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: /add participant/i }))
    }
    expect(screen.queryByTestId('group-inquiry-open')).not.toBeInTheDocument()
  })

  it('pre-fills name, email and phone from the booker fields when the modal opens', () => {
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
    fillBooker({
      first: 'Ada',
      last: 'Lovelace',
      email: 'ada@example.com',
      phone: '+34 600 000 000',
    })
    reachParticipantMax()
    openInquiryModal()
    expect(
      document.querySelector<HTMLInputElement>('[name="inquiry_name"]')?.value,
    ).toBe('Ada Lovelace')
    expect(
      document.querySelector<HTMLInputElement>('[name="inquiry_email"]')?.value,
    ).toBe('ada@example.com')
    expect(
      document.querySelector<HTMLInputElement>('[name="inquiry_phone"]')?.value,
    ).toBe('+34 600 000 000')
  })

  it('Cancel closes the modal without submitting and discards the inquiry', () => {
    const spy = vi.spyOn(client, 'submitGroupInquiry').mockResolvedValue({
      ok: true,
    })
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
    openInquiryModal()
    expect(screen.getByTestId('group-inquiry-form')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('group-inquiry-cancel'))

    // Modal/form gone, no submit fired, and the Details step is unchanged
    // (the "Request more" button is back, ready for another try).
    expect(screen.queryByTestId('group-inquiry-form')).not.toBeInTheDocument()
    expect(screen.getByTestId('group-inquiry-open')).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('keeps a secondary "Or email us" mailto on the notice when contactEmail is set', () => {
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
    const link = screen.getByTestId('participants-contact-mailto')
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('ops@para42.example'),
    )
  })
})

// ---------------------------------------------------------------------------
// Tests: Send gating (name + valid email only)
// ---------------------------------------------------------------------------

describe('GroupInquiryForm — Send gating (landr-amg6)', () => {
  it('disables Send until Name + a valid Email are present', () => {
    render(
      <GroupInquiryForm
        operatorToken="test-token"
        productSlug="tandem-classic"
      />,
    )
    const submit = screen.getByTestId('group-inquiry-submit')
    // Empty → disabled.
    expect(submit).toBeDisabled()

    // Name only → still disabled.
    fireEvent.change(document.querySelector('[name="inquiry_name"]')!, {
      target: { value: 'Ada Lovelace' },
    })
    expect(submit).toBeDisabled()

    // Name + invalid email (no '@') → still disabled.
    fireEvent.change(document.querySelector('[name="inquiry_email"]')!, {
      target: { value: 'not-an-email' },
    })
    expect(submit).toBeDisabled()

    // Name + valid email → enabled (phone / group size / message all blank).
    fireEvent.change(document.querySelector('[name="inquiry_email"]')!, {
      target: { value: 'ada@example.com' },
    })
    expect(submit).not.toBeDisabled()
  })

  it('does NOT gate Send on phone, group size, or message', () => {
    render(
      <GroupInquiryForm
        operatorToken="test-token"
        productSlug="tandem-classic"
        defaultName="Ada Lovelace"
        defaultEmail="ada@example.com"
      />,
    )
    // With only the required fields prefilled and all optionals blank, Send is
    // already enabled.
    expect(screen.getByTestId('group-inquiry-submit')).not.toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Tests: successful submit
// ---------------------------------------------------------------------------

describe('GroupInquiryForm — successful submit (landr-amg6)', () => {
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

    fireEvent.click(screen.getByTestId('group-inquiry-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('group-inquiry-success')).toBeInTheDocument()
    })
    expect(screen.getByTestId('group-inquiry-success')).toHaveTextContent(
      /thanks.*in touch/i,
    )
  })

  it('calls submitGroupInquiry with the correct body (phone + optionals)', async () => {
    const spy = vi
      .spyOn(client, 'submitGroupInquiry')
      .mockResolvedValue({ ok: true })

    render(
      <GroupInquiryForm
        operatorToken="test-token"
        productSlug="tandem-classic"
        defaultName="Ada Lovelace"
        defaultEmail="ada@example.com"
        defaultPhone="+34 600 000 000"
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
        phone: '+34 600 000 000',
        party_size: 12,
        message: 'Flight school booking for 12 students',
        product_slug: 'tandem-classic',
      })
    })
  })

  it('sends null for the optional fields when they are left blank', async () => {
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

    fireEvent.click(screen.getByTestId('group-inquiry-submit'))

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith('test-token', {
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: null,
        party_size: null,
        message: null,
        product_slug: 'tandem-classic',
      })
    })
  })
})

// ---------------------------------------------------------------------------
// Tests: error keeps the form open + falls back to mailto:
// ---------------------------------------------------------------------------

describe('GroupInquiryForm — error keeps the form + mailto fallback (landr-amg6)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the form open and shows the mailto: fallback link on submit error', async () => {
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

    fireEvent.click(screen.getByTestId('group-inquiry-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('group-inquiry-error')).toBeInTheDocument()
    })
    // Form is still mounted (the customer can retry / edit) — not replaced.
    expect(screen.getByTestId('group-inquiry-form')).toBeInTheDocument()
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

    fireEvent.click(screen.getByTestId('group-inquiry-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('group-inquiry-success')).toBeInTheDocument()
    })
  })
})
