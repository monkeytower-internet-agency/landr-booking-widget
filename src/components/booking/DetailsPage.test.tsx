import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '@/api/client'
import type { CustomerDetails, CustomerDetailsPutBody } from '@/api/customerDetailsTypes'
import {
  PENDING_DETAILS,
  declarationsModule,
  insuranceModule,
} from '@/test/customerDetailsFixtures'
import { DetailsPage } from './DetailsPage'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getBookingDetails: vi.fn<(token: string) => Promise<CustomerDetails>>(),
    putBookingDetails:
      vi.fn<(token: string, body: CustomerDetailsPutBody) => Promise<{ completed: boolean }>>(),
    getBookingByToken: vi.fn<(token: string) => Promise<unknown>>(),
  },
}))

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return {
    ...actual,
    getBookingDetails: mocks.getBookingDetails,
    putBookingDetails: mocks.putBookingDetails,
    getBookingByToken: mocks.getBookingByToken,
  }
})

const TOKEN = 'details-token-abc'

const input = (id: string) => screen.getByTestId(id) as HTMLInputElement

async function ready() {
  render(<DetailsPage token={TOKEN} />)
  await waitFor(() => screen.getByTestId('details-ready'))
}

function fillAll() {
  fireEvent.change(input('cf-participant-0-field-weight_kg'), { target: { value: '80' } })
  fireEvent.change(input('cf-participant-1-field-weight_kg'), { target: { value: '95' } })
  fireEvent.change(input('cf-participant-0-field-diet'), { target: { value: 'vegan' } })
  fireEvent.change(input('cf-companion-0-field-diet'), { target: { value: 'none' } })
  fireEvent.change(input('cf-field-licence'), { target: { value: 'LIC-1' } })
}

describe('DetailsPage', () => {
  beforeEach(() => {
    mocks.getBookingDetails.mockReset()
    mocks.putBookingDetails.mockReset()
    mocks.getBookingByToken.mockReset()
    mocks.getBookingByToken.mockResolvedValue({ operator_name: 'Sky Co' })
  })

  it('reads only on load: no PUT before Submit', async () => {
    mocks.getBookingDetails.mockResolvedValue(PENDING_DETAILS)
    await ready()
    expect(mocks.getBookingDetails).toHaveBeenCalledWith(TOKEN)
    expect(mocks.putBookingDetails).not.toHaveBeenCalled()
  })

  it('renders the real roster names and per-person fields', async () => {
    mocks.getBookingDetails.mockResolvedValue(PENDING_DETAILS)
    await ready()
    expect(screen.getByTestId('cf-participant-0-name')).toHaveTextContent('Ann Pilot')
    expect(screen.getByTestId('cf-participant-1-name')).toHaveTextContent('Ben Pilot')
    expect(screen.getByTestId('cf-companion-0-name')).toHaveTextContent('Cleo Guest')
    expect(screen.getByTestId('cf-participant-0-field-weight_kg')).toBeTruthy()
    expect(screen.queryByTestId('cf-companion-0-field-weight_kg')).toBeNull()
    // the booking-flow comment field does not belong on this page
    expect(screen.queryByText(/anything we should know/i)).toBeNull()
    await waitFor(() => expect(screen.getByText(/booking with Sky Co/)).toBeInTheDocument())
  })

  it('happy path: PUTs answers keyed by booking_participant_id, then shows the done state', async () => {
    mocks.getBookingDetails.mockResolvedValue(PENDING_DETAILS)
    mocks.putBookingDetails.mockResolvedValue({ completed: true })
    await ready()
    await waitFor(() => screen.getByText(/booking with Sky Co/))
    fillAll()
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => screen.getByTestId('details-done'))
    expect(mocks.putBookingDetails).toHaveBeenCalledOnce()
    const [token, body] = mocks.putBookingDetails.mock.calls[0]
    expect(token).toBe(TOKEN)
    expect(body).toEqual({
      form_responses: [
        {
          form_key: 'declarations',
          answers: { licence: 'LIC-1' },
          people: {
            pa: { weight_kg: '80', diet: 'vegan' },
            pb: { weight_kg: '95' },
            gc: { diet: 'none' },
          },
        },
      ],
    })
    expect(screen.getByTestId('details-done')).toHaveTextContent(/Thanks — your details are saved/)
    expect(screen.getByTestId('details-done')).toHaveTextContent(/Sky Co/)
  })

  it('done state still works when the operator name cannot be read', async () => {
    mocks.getBookingByToken.mockRejectedValue(new HttpError(401, 'Unauthorized', ''))
    mocks.getBookingDetails.mockResolvedValue(PENDING_DETAILS)
    mocks.putBookingDetails.mockResolvedValue({ completed: true })
    await ready()
    fillAll()
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => screen.getByTestId('details-done'))
    expect(screen.getByTestId('details-done')).toHaveTextContent(/saved/)
  })

  it('blocks Submit while a required per-person answer is missing', async () => {
    mocks.getBookingDetails.mockResolvedValue(PENDING_DETAILS)
    await ready()
    fireEvent.change(input('cf-participant-0-field-weight_kg'), { target: { value: '80' } })
    // Ben's required weight is still empty
    expect(screen.getByTestId('cf-submit')).toBeDisabled()
    fireEvent.click(screen.getByTestId('cf-submit'))
    expect(mocks.putBookingDetails).not.toHaveBeenCalled()
  })

  it('server 422 lists the problems with the person name and keeps the form', async () => {
    mocks.getBookingDetails.mockResolvedValue(PENDING_DETAILS)
    mocks.putBookingDetails.mockRejectedValueOnce(
      new HttpError(
        422,
        'Unprocessable',
        JSON.stringify({
          detail: {
            error: 'form_responses_invalid',
            errors: [
              {
                form_key: 'declarations',
                field_key: 'weight_kg',
                code: 'out_of_range',
                message: 'Weight must be at most 200.',
                booking_participant_id: 'pb',
              },
            ],
          },
        }),
      ),
    )
    await ready()
    fillAll()
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => screen.getByTestId('details-problems'))
    expect(screen.getByTestId('details-problems')).toHaveTextContent(
      'Ben Pilot: Weight must be at most 200.',
    )
    expect(screen.queryByTestId('details-done')).toBeNull()
    // fix and resubmit
    mocks.putBookingDetails.mockResolvedValueOnce({ completed: true })
    fireEvent.change(input('cf-participant-1-field-weight_kg'), { target: { value: '90' } })
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => screen.getByTestId('details-done'))
    expect(mocks.putBookingDetails).toHaveBeenCalledTimes(2)
  })

  it('walks several forms and sends them in ONE PUT at the end (deduped across products)', async () => {
    mocks.getBookingDetails.mockResolvedValue({
      ...PENDING_DETAILS,
      forms: [
        { product_id: 'p1', product_name: 'Tandem', modules: [declarationsModule(), insuranceModule()] },
        { product_id: 'p2', product_name: 'Dinner', modules: [declarationsModule()] },
      ],
    })
    mocks.putBookingDetails.mockResolvedValue({ completed: true })
    await ready()
    expect(screen.getByTestId('details-step-counter')).toHaveTextContent('Form 1 of 2')
    fillAll()
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => screen.getByTestId('details-step-counter'))
    expect(screen.getByTestId('details-step-counter')).toHaveTextContent('Form 2 of 2')
    expect(mocks.putBookingDetails).not.toHaveBeenCalled()
    fireEvent.change(input('cf-field-insurer'), { target: { value: 'Acme' } })
    expect(screen.getByTestId('cf-submit')).toHaveTextContent('Submit')
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => screen.getByTestId('details-done'))
    expect(mocks.putBookingDetails).toHaveBeenCalledOnce()
    const body = mocks.putBookingDetails.mock.calls[0][1]
    expect(body.form_responses.map((f) => f.form_key)).toEqual(['declarations', 'insurance'])
    expect(body.form_responses[1].answers).toEqual({ insurer: 'Acme' })
  })

  it('prefills staff answers', async () => {
    mocks.getBookingDetails.mockResolvedValue({
      ...PENDING_DETAILS,
      answers: [
        {
          form_key: 'declarations',
          answers: { licence: 'STAFF-1' },
          people: { pa: { weight_kg: 72 } },
        },
      ],
    })
    await ready()
    expect(input('cf-field-licence').value).toBe('STAFF-1')
    expect(input('cf-participant-0-field-weight_kg').value).toBe('72')
    expect(input('cf-participant-1-field-weight_kg').value).toBe('')
  })

  it('409 already complete is treated as saved', async () => {
    mocks.getBookingDetails.mockResolvedValue(PENDING_DETAILS)
    mocks.putBookingDetails.mockRejectedValue(
      new HttpError(409, 'Conflict', JSON.stringify({ detail: { error: 'customer_details_already_complete' } })),
    )
    await ready()
    fillAll()
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => screen.getByTestId('details-done'))
  })

  it('409 booking_closed shows a closed message', async () => {
    mocks.getBookingDetails.mockResolvedValue(PENDING_DETAILS)
    mocks.putBookingDetails.mockRejectedValue(
      new HttpError(409, 'Conflict', JSON.stringify({ detail: { error: 'booking_closed' } })),
    )
    await ready()
    fillAll()
    fireEvent.click(screen.getByTestId('cf-submit'))
    await waitFor(() => screen.getByTestId('details-problems'))
    expect(screen.getByTestId('details-problems')).toHaveTextContent(/booking is closed/i)
  })

  it('not pending shows the friendly "nothing to complete" state', async () => {
    mocks.getBookingDetails.mockResolvedValue({ pending: false, completed_at: '2026-10-19T09:00:00Z' })
    render(<DetailsPage token={TOKEN} />)
    await waitFor(() => screen.getByTestId('details-nothing'))
    expect(screen.getByTestId('details-nothing')).toHaveTextContent(/Nothing to complete/)
    expect(screen.queryByTestId('cf-submit')).toBeNull()
  })

  it.each([401, 404])('%s shows the invalid-link card', async (status) => {
    mocks.getBookingDetails.mockRejectedValue(new HttpError(status, 'x', ''))
    render(<DetailsPage token={TOKEN} />)
    await waitFor(() => screen.getByTestId('details-invalid'))
    expect(screen.getByTestId('details-invalid')).toHaveTextContent(/no longer valid/)
  })

  it('a transient failure is retryable', async () => {
    mocks.getBookingDetails.mockRejectedValueOnce(new HttpError(429, 'Too Many', ''))
    mocks.getBookingDetails.mockResolvedValueOnce(PENDING_DETAILS)
    render(<DetailsPage token={TOKEN} />)
    await waitFor(() => screen.getByTestId('details-error'))
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await waitFor(() => screen.getByTestId('details-ready'))
  })
})
