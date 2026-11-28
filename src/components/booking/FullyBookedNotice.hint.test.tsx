import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FullyBookedNotice } from './FullyBookedNotice'

describe('FullyBookedNotice reached from a cross-sell hint (landr-f210e.5)', () => {
  it('names the product and the carried days', () => {
    render(<FullyBookedNotice name="Camping" hintNotice />)
    expect(screen.getByTestId('fully-booked-blurb')).toHaveTextContent(
      'We are sorry, Camping is also fully booked on these days.',
    )
  })

  it('keeps the plain blurb otherwise', () => {
    render(<FullyBookedNotice name="Camping" />)
    expect(screen.getByTestId('fully-booked-blurb')).toHaveTextContent(/new dates are not open yet/i)
  })
})
