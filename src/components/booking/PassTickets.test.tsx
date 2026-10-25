import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { PassTicket } from '@/api/types'
import { PassTickets } from './PassTickets'

const ticket = (id: string, name: string): PassTicket => ({
  participant_id: id,
  first_name: name,
  png_url: `https://api.example.test/api/public/tickets/${id}.png`,
  pass_label: 'Week',
  valid_from: '2099-07-04',
  valid_until: '2099-07-10',
})

describe('PassTickets', () => {
  it('renders one QR per guest with the validity window', () => {
    render(<PassTickets tickets={[ticket('a', 'Ann'), ticket('b', 'Bob')]} />)
    const items = screen.getAllByTestId('pass-ticket')
    expect(items).toHaveLength(2)
    expect(screen.getByAltText('Ann').getAttribute('src')).toContain('/tickets/a.png')
    expect(items[0].textContent).toMatch(/Week/)
    expect(items[0].textContent).toMatch(/Jul/)
  })

  it('renders nothing without tickets', () => {
    const { container } = render(<PassTickets tickets={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
