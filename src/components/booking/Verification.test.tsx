import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  PassTiersResponse,
  Product,
  SubmitBookingBody,
  SubmitBookingResponse,
  VerificationState,
} from '@/api/types'
import { PassCheckoutStep } from './PassCheckoutStep'
import { VerificationStatusPanel } from './VerificationStatusPanel'
import {
  EMPTY_VERIFICATION,
  fileProblem,
  isDailyCapReached,
  MAX_VERIFICATION_BYTES,
  toWaiver,
  uploadChosenFiles,
  verificationReady,
  waiverText,
} from './verification'
import { HttpError } from '@/api/client'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getPassTiers: vi.fn<(...a: unknown[]) => Promise<unknown>>(),
    submitBooking: vi.fn<(body: SubmitBookingBody) => Promise<unknown>>(),
    uploadVerificationFile: vi.fn<(...a: unknown[]) => Promise<unknown>>(),
    getVerificationState: vi.fn<(...a: unknown[]) => Promise<unknown>>(),
  },
}))

vi.mock('@/api/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/api/client')>()
  return { ...real, ...mocks }
})

const file = (name: string, type: string, size = 10) =>
  new File([new Uint8Array(size)], name, { type })

describe('verification helpers', () => {
  it('refuses oversized and non-image/PDF files', () => {
    expect(fileProblem(file('a.jpg', 'image/jpeg'))).toBeNull()
    expect(fileProblem(file('a.pdf', 'application/pdf'))).toBeNull()
    expect(fileProblem(file('a.exe', 'application/x-msdownload'))).toBe('type')
    expect(fileProblem(file('big.jpg', 'image/jpeg', MAX_VERIFICATION_BYTES + 1))).toBe('size')
  })

  it('is ready only with both files, a name and the accepted waiver', () => {
    const base = {
      ...EMPTY_VERIFICATION,
      licence: file('l.jpg', 'image/jpeg'),
      insurance: file('i.pdf', 'application/pdf'),
      signature: 'Pia Pilot',
      accepted: true,
    }
    expect(verificationReady(base)).toBe(true)
    expect(verificationReady({ ...base, licence: null })).toBe(false)
    expect(verificationReady({ ...base, insurance: null })).toBe(false)
    expect(verificationReady({ ...base, signature: '  ' })).toBe(false)
    expect(verificationReady({ ...base, accepted: false })).toBe(false)
    expect(verificationReady({ ...base, licence: file('x.jpg', 'image/jpeg', MAX_VERIFICATION_BYTES + 1) })).toBe(false)
  })

  it('picks the waiver in the customer language, falling back to the other', () => {
    const p = { waiver_text_localized: { de: 'Auf eigene Gefahr', en: 'At own risk' } }
    expect(waiverText(p, 'de-AT')).toBe('Auf eigene Gefahr')
    expect(waiverText(p, 'fr')).toBe('At own risk')
    expect(waiverText({ waiver_text_localized: { de: 'Nur DE' } }, 'en')).toBe('Nur DE')
    expect(waiverText({ waiver_text_localized: null }, 'en')).toBeNull()
    expect(toWaiver({ ...EMPTY_VERIFICATION, signature: ' Pia ', accepted: true }, 'de')).toEqual({
      waiver_accepted: true,
      waiver_signature_name: 'Pia',
      waiver_locale: 'de',
    })
  })

  it('recognises the daily-cap 409', () => {
    const body = JSON.stringify({ detail: { error: 'daily_cap_reached', message: 'full' } })
    expect(isDailyCapReached(new HttpError(409, 'Conflict', body))).toBe(true)
    expect(isDailyCapReached(new HttpError(409, 'Conflict', '{}'))).toBe(false)
    expect(isDailyCapReached(new Error('x'))).toBe(false)
  })

  it('uploads both files and keeps going when one fails', async () => {
    mocks.uploadVerificationFile.mockImplementation(async (_t, kind) => {
      if (kind === 'licence') throw new Error('network')
      return { status: 'pending', licence_uploaded: false, insurance_uploaded: true }
    })
    const start: VerificationState = {
      status: 'pending', licence_uploaded: false, insurance_uploaded: false, upload_token: 'tok',
    }
    const out = await uploadChosenFiles(start, {
      ...EMPTY_VERIFICATION,
      licence: file('l.jpg', 'image/jpeg'),
      insurance: file('i.pdf', 'application/pdf'),
    })
    expect(mocks.uploadVerificationFile).toHaveBeenCalledTimes(2)
    expect(out.insurance_uploaded).toBe(true)
    expect(out.licence_uploaded).toBe(false)
    expect(out.upload_token).toBe('tok')
  })
})

describe('VerificationStatusPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('says it will confirm once verified and offers the missing upload', async () => {
    const initial: VerificationState = {
      status: 'pending', licence_uploaded: true, insurance_uploaded: false, upload_token: 'tok',
    }
    mocks.getVerificationState.mockResolvedValue({ ...initial, upload_token: undefined })
    mocks.uploadVerificationFile.mockResolvedValue({
      status: 'pending', licence_uploaded: true, insurance_uploaded: true,
    })
    render(<VerificationStatusPanel initial={initial} locale="en" />)
    expect(screen.getByTestId('verification-pending').textContent).toMatch(/confirm once your documents are verified/i)
    expect(screen.getByTestId('verification-status-licence').textContent).toMatch(/Received/)
    expect(screen.getByTestId('verification-status-insurance').textContent).toMatch(/Still missing/)
    fireEvent.change(screen.getByTestId('verification-retry-insurance'), {
      target: { files: [file('i.pdf', 'application/pdf')] },
    })
    await waitFor(() => expect(mocks.uploadVerificationFile).toHaveBeenCalledWith('tok', 'insurance', expect.any(File)))
    await waitFor(() => expect(screen.queryByTestId('verification-retry')).toBeNull())
  })

  it('shows the organizer reason on a rejection and the German copy', () => {
    render(
      <VerificationStatusPanel
        initial={{ status: 'rejected', licence_uploaded: true, insurance_uploaded: true, note: 'Abgelaufen' }}
        locale="de"
      />,
    )
    expect(screen.getByTestId('verification-rejected').textContent).toMatch(/Abgelaufen/)
    expect(screen.getByTestId('verification-rejected').textContent).toMatch(/nicht bestätigt/)
  })
})

describe('PassCheckoutStep with a verified registration', () => {
  const product = {
    product_id: 'pass-1', slug: 'fest', name: 'Fest', product_kind: 'pass',
    service_time_shape: null, is_contiguous: false, requires_verification: true,
    waiver_text_localized: { en: 'I fly at my own risk.' },
  } as unknown as Product
  const tiers: PassTiersResponse = {
    product_id: 'pass-1', currency: 'EUR', is_member: false,
    tiers: [{
      id: 't-day', label: 'Day', validity_kind: 'day', validity_days: null,
      season_start: null, season_end: null, price_cents: 0,
      has_member_price: false, member_price_cents: null, unit_price_cents: 0,
    }],
  }
  const fill = (label: RegExp, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } })

  it('blocks Book until documents + waiver are in, then sends the waiver and the files', async () => {
    mocks.getPassTiers.mockResolvedValue(tiers)
    const confirmed: SubmitBookingResponse = {
      booking_id: 'b1', semantic_state: 'pending',
      verification: { status: 'pending', licence_uploaded: false, insurance_uploaded: false, upload_token: 'tok' },
    } as SubmitBookingResponse
    mocks.submitBooking.mockResolvedValue(confirmed)
    mocks.uploadVerificationFile.mockResolvedValue({ status: 'pending', licence_uploaded: true, insurance_uploaded: true })
    const onConfirmed = vi.fn()
    render(
      <PassCheckoutStep
        product={product}
        widgetToken="w"
        serviceRoles={[{ id: 'r', code: 'guest', label: 'Guest', label_localized: null, sort_order: 0 }]}
        operatorTimezone="UTC"
        operatorCountry="DE"
        onConfirmed={onConfirmed}
      />,
    )
    await screen.findByTestId('pass-tier-list')
    fill(/first name/i, 'Pia')
    fill(/last name/i, 'Pilot')
    fill(/^e-?mail/i, 'pia@example.com')
    fill(/phone/i, '+4915100000')
    fill(/street/i, 'Hauptstr. 1')
    fill(/postal/i, '10115')
    fill(/city/i, 'Berlin')
    const submit = screen.getByTestId('pass-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    expect(screen.getByTestId('verification-waiver-text').textContent).toBe('I fly at my own risk.')

    fireEvent.change(screen.getByTestId('verification-licence'), { target: { files: [file('l.jpg', 'image/jpeg')] } })
    fireEvent.change(screen.getByTestId('verification-insurance'), { target: { files: [file('i.pdf', 'application/pdf')] } })
    fireEvent.change(screen.getByTestId('verification-signature'), { target: { value: 'Pia Pilot' } })
    expect(submit.disabled).toBe(true)
    fireEvent.click(screen.getByTestId('verification-accept'))
    expect(submit.disabled).toBe(false)

    fireEvent.click(submit)
    await waitFor(() => expect(mocks.submitBooking).toHaveBeenCalledTimes(1))
    expect(mocks.submitBooking.mock.calls[0][0].verification).toEqual({
      waiver_accepted: true, waiver_signature_name: 'Pia Pilot', waiver_locale: 'en',
    })
    await waitFor(() => expect(mocks.uploadVerificationFile).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(onConfirmed).toHaveBeenCalled())
    expect(onConfirmed.mock.calls[0][0].verification.licence_uploaded).toBe(true)
  })
})
