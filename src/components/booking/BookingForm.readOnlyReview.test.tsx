/**
 * Review is a true review (landr-kq0l4): all data entry happens on earlier
 * steps. For a product that asks for verification AND a second guiding
 * language, Review renders no input at all except the note for us; the
 * documents / waiver and the language answers show as summary lines with an
 * Edit way back, and Confirm stays disabled without them (defence in depth).
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '@/api/types'
import { submitBooking, uploadVerificationFile } from '@/api/client'
import { BookingForm, type BookingSelection } from './BookingForm'
import { emptyBilling, type BookerDetails } from './detailsTypes'
import { EMPTY_VERIFICATION, type VerificationInput } from './verification'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    submitBooking: vi.fn(),
    uploadVerificationFile: vi.fn(),
    getAvailability: vi.fn().mockResolvedValue([]),
    listProducts: vi.fn().mockResolvedValue([]),
    getOffers: vi.fn().mockResolvedValue({ lines: [] }),
  }
})

const product: Product = {
  product_id: 'svc-verified',
  slug: 'verified-day',
  name: 'Verified day',
  name_localized: null,
  short_description: null,
  short_description_localized: null,
  description: null,
  product_kind: 'service',
  service_time_shape: 'days_range',
  is_contiguous: true,
  duration_minutes: null,
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
  guide_languages: ['en', 'de', 'es', 'fr'],
  second_language_mode: 'not_preferred',
  preferred_guide_languages: ['en', 'de'],
  second_language_options: 'all',
  requires_verification: true,
  waiver_text_localized: { en: 'I fly at my own risk.' },
}

const SELECTION: BookingSelection = { kind: 'days', selectedDays: ['2026-06-10'] }
const BOOKER: BookerDetails = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone: '+34 600 111 222',
  billing: {
    ...emptyBilling(),
    address_line1: 'Calle Mayor 1',
    postal_code: '28013',
    city: 'Madrid',
    country: 'ES',
  },
  joins: true,
}

const file = (name: string, type: string) => new File([new Uint8Array(10)], name, { type })
const READY: VerificationInput = {
  licence: file('licence.jpg', 'image/jpeg'),
  insurance: file('insurance.pdf', 'application/pdf'),
  signature: 'Ada Lovelace',
  accepted: true,
}

function renderReview(props: Partial<React.ComponentProps<typeof BookingForm>> = {}) {
  return render(
    <BookingForm
      widgetToken="op-x"
      product={product}
      selection={SELECTION}
      booker={BOOKER}
      participants={[
        {
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.com',
          phone: '+34 600 111 222',
          service_role_code: '',
        },
      ]}
      participantLanguages={{ 0: 'fr' }}
      participantAcceptedLanguages={{ 0: ['de'] }}
      verification={READY}
      pickupLocationId={null}
      onBack={vi.fn()}
      onConfirmed={vi.fn()}
      {...props}
    />,
  )
}

const confirmBtn = () => screen.getByTestId('review-confirm-btn')

beforeEach(() => {
  vi.mocked(submitBooking).mockReset()
  vi.mocked(submitBooking).mockResolvedValue({ booking_id: 'b-1', semantic_state: 'pending' })
  vi.mocked(uploadVerificationFile).mockReset()
})

describe('BookingForm review — no inputs except the note (landr-kq0l4)', () => {
  it('renders no field for documents, waiver, signature or language answers', () => {
    renderReview()
    const inputs = [...document.querySelectorAll('input, select, textarea')].filter(
      (el) => !el.closest('[data-testid="customer-comment-section"]'),
    )
    expect(inputs).toHaveLength(0)
    expect(screen.queryByTestId('verification-fields')).toBeNull()
    expect(screen.queryByTestId('second-language-questions')).toBeNull()
  })

  it('shows the documents and the signature as finished data with an Edit link', () => {
    const onEditVerification = vi.fn()
    renderReview({ onEditVerification })
    const card = screen.getByTestId('review-verification')
    expect(card).toHaveTextContent('licence.jpg')
    expect(card).toHaveTextContent('insurance.pdf')
    expect(card).toHaveTextContent('Signed by Ada Lovelace')
    fireEvent.click(screen.getByTestId('review-verification-edit'))
    expect(onEditVerification).toHaveBeenCalledTimes(1)
  })

  it('shows the second-language answer with an Edit link back to the Language step', () => {
    const onEditLanguages = vi.fn()
    renderReview({ onEditLanguages })
    expect(screen.getByTestId('review-second-language-0')).toHaveTextContent(/Ada.*German/)
    fireEvent.click(screen.getByTestId('review-second-language-edit'))
    expect(onEditLanguages).toHaveBeenCalledTimes(1)
  })

  it('with everything provided, Confirm is enabled and submits the waiver and uploads the files', async () => {
    vi.mocked(submitBooking).mockResolvedValue({
      booking_id: 'b-1',
      semantic_state: 'pending',
      verification: {
        status: 'pending',
        licence_uploaded: false,
        insurance_uploaded: false,
        upload_token: 'tok',
      },
    })
    vi.mocked(uploadVerificationFile).mockResolvedValue({
      status: 'pending',
      licence_uploaded: true,
      insurance_uploaded: true,
    })
    renderReview()
    expect(confirmBtn()).toBeEnabled()
    await act(async () => {
      fireEvent.click(confirmBtn())
    })
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1))
    expect(vi.mocked(submitBooking).mock.calls[0]![0]).toMatchObject({
      verification: {
        waiver_accepted: true,
        waiver_signature_name: 'Ada Lovelace',
      },
    })
    await waitFor(() => expect(uploadVerificationFile).toHaveBeenCalledTimes(2))
  })

  it('without the documents Confirm stays disabled and the card says what is still to add', async () => {
    const onEditVerification = vi.fn()
    renderReview({ verification: EMPTY_VERIFICATION, onEditVerification })
    expect(screen.getByTestId('review-verification-missing')).toHaveTextContent(/Still to add/)
    expect(confirmBtn()).toBeDisabled()
    expect(document.getElementById('review-step-gate')).toHaveTextContent(/Details step/)
    fireEvent.click(screen.getByTestId('review-verification-edit'))
    expect(onEditVerification).toHaveBeenCalledTimes(1)
    // A forced click still never submits.
    await act(async () => {
      fireEvent.click(confirmBtn())
    })
    expect(submitBooking).not.toHaveBeenCalled()
  })

  it('a product without verification shows no documents card', () => {
    renderReview({
      product: { ...product, requires_verification: false },
      verification: EMPTY_VERIFICATION,
    })
    expect(screen.queryByTestId('review-verification')).toBeNull()
    expect(confirmBtn()).toBeEnabled()
  })
})
