import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AccountLinkPrompt } from './AccountLinkPrompt'

const EMAIL = 'customer@example.com'
const TOKEN = 'widget-token-abc'

const requestMagicLinkMock = vi.fn()

vi.mock('@/api/auth', () => ({
  requestMagicLink: (...args: unknown[]) => requestMagicLinkMock(...args),
}))

describe('AccountLinkPrompt', () => {
  beforeEach(() => {
    requestMagicLinkMock.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('accept flow calls requestMagicLink with the right email and shows success state', async () => {
    requestMagicLinkMock.mockResolvedValueOnce(undefined)

    render(<AccountLinkPrompt operatorToken={TOKEN} email={EMAIL} />)

    fireEvent.click(screen.getByRole('button', { name: /yes, send me a link/i }))

    await waitFor(() => {
      expect(requestMagicLinkMock).toHaveBeenCalledTimes(1)
    })
    expect(requestMagicLinkMock).toHaveBeenCalledWith({
      operatorToken: TOKEN,
      email: EMAIL,
    })

    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument()
    // Booking confirmation siblings are untouched — this component just
    // transitioned to its "sent" sub-state without throwing.
  })

  it('decline flow dismisses the prompt without calling the auth API', async () => {
    render(<AccountLinkPrompt operatorToken={TOKEN} email={EMAIL} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: /no thanks, continue as guest/i }),
    )

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(requestMagicLinkMock).not.toHaveBeenCalled()
  })

  it('failure path shows an inline error and keeps the prompt visible', async () => {
    requestMagicLinkMock.mockRejectedValueOnce(new Error('rate limited'))

    render(<AccountLinkPrompt operatorToken={TOKEN} email={EMAIL} />)

    fireEvent.click(screen.getByRole('button', { name: /yes, send me a link/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/rate limited/i)
    expect(alert).toHaveTextContent(/booking is still confirmed/i)

    // The dialog (and its buttons) remain mounted so the user can retry / dismiss.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /yes, send me a link/i }),
    ).toBeInTheDocument()
  })
})
