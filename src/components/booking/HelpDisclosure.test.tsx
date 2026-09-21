import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HelpDisclosure } from './HelpDisclosure'

describe('HelpDisclosure (landr-80ubl.1)', () => {
  it('is collapsed by default and expands on click', () => {
    render(
      <HelpDisclosure>
        <p>Why we ask</p>
      </HelpDisclosure>,
    )
    const toggle = screen.getByRole('button', { name: /how this works/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Why we ask')).toBeNull()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const panel = screen.getByText('Why we ask').parentElement!
    expect(toggle).toHaveAttribute('aria-controls', panel.id)

    fireEvent.click(toggle)
    expect(screen.queryByText('Why we ask')).toBeNull()
  })

  it('accepts a custom label', () => {
    render(<HelpDisclosure label="Why?">x</HelpDisclosure>)
    expect(screen.getByRole('button', { name: /why\?/i })).toBeInTheDocument()
  })
})
