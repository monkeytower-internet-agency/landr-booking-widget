import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InviteHoldNote } from './InviteHoldNote'

const now = new Date(2026, 9, 16, 10, 0)

describe('InviteHoldNote (landr-f987a.4)', () => {
  it('shows the held-until line while the hold is live', () => {
    render(<InviteHoldNote expiresAt={new Date(2026, 9, 17, 15, 0).toISOString()} now={now} />)
    const el = screen.getByTestId('invite-hold')
    expect(el).toHaveAttribute('data-hold', 'live')
    expect(el).toHaveTextContent(/Your seat is held until .*tomorrow/)
  })
  it('shows the non-blocking ended line once expired', () => {
    render(<InviteHoldNote expiresAt={new Date(2026, 9, 15, 15, 0).toISOString()} now={now} />)
    expect(screen.getByTestId('invite-hold')).toHaveTextContent(
      'The hold on your seat has ended — you can still book while seats last.',
    )
  })
  it('renders nothing without a hold', () => {
    const { container } = render(<InviteHoldNote expiresAt={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
