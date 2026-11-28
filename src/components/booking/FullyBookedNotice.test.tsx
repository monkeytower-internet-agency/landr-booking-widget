import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FullyBookedNotice } from '@/components/booking/FullyBookedNotice'
import { SUPPORTED_UI_LANGUAGES, pickBundle } from '@/lib/strings'

// landr-u2byj: a product with no open dates reads as positive "coming soon",
// never "Fully booked", in every locale; the operator email shows when known.
describe('FullyBookedNotice (no open dates)', () => {
  it('shows the positive coming-soon wording, not "Fully booked"', () => {
    render(<FullyBookedNotice name="Tandem" compact />)
    expect(screen.getByTestId('fully-booked-badge')).toHaveTextContent('Next dates coming soon')
    expect(screen.queryByText(/fully booked/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('fully-booked-contact')).not.toBeInTheDocument()
  })

  it('links the operator contact email when configured', () => {
    render(<FullyBookedNotice name="Tandem" contactEmail=" hello@operator.example " />)
    const link = screen.getByRole('link', { name: 'hello@operator.example' })
    expect(link).toHaveAttribute('href', 'mailto:hello@operator.example')
  })

  it('has no "sold out" wording in any locale bundle', () => {
    const bad = /ausgebucht|completo|complet\b|al completo|tamamen dolu|fully booked|sold out/i
    for (const loc of SUPPORTED_UI_LANGUAGES) {
      const bundle = pickBundle(loc) as Record<string, string>
      expect(bundle.fullyBookedLabel, loc).not.toMatch(bad)
      expect(bundle.fullyBookedBlurb, loc).not.toMatch(bad)
    }
  })
})
