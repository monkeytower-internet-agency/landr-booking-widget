import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { OptionalReveal } from './OptionalReveal'

function Field({ initial = '' }: { initial?: string }) {
  const [v, setV] = useState(initial)
  return (
    <OptionalReveal thing="a note" hasValue={v !== ''}>
      <input aria-label="Note" value={v} onChange={(e) => setV(e.target.value)} />
    </OptionalReveal>
  )
}

describe('OptionalReveal (landr-80ubl.1)', () => {
  it('hides an empty optional field behind "+ Add …" and reveals + focuses it', () => {
    render(<Field />)
    expect(screen.queryByLabelText('Note')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /add a note/i }))
    const input = screen.getByLabelText('Note')
    expect(input).toHaveFocus()
  })

  it('auto-opens when prefilled, and stays open when cleared', () => {
    render(<Field initial="hello" />)
    const input = screen.getByLabelText('Note')
    expect(input).toHaveValue('hello')
    expect(screen.queryByRole('button', { name: /add a note/i })).toBeNull()
    fireEvent.change(input, { target: { value: '' } })
    expect(screen.getByLabelText('Note')).toBeInTheDocument()
  })

  it('opens when a value arrives later (async restore)', () => {
    const { rerender } = render(
      <OptionalReveal thing="a note" hasValue={false}>
        <input aria-label="Note" readOnly />
      </OptionalReveal>,
    )
    expect(screen.queryByLabelText('Note')).toBeNull()
    rerender(
      <OptionalReveal thing="a note" hasValue>
        <input aria-label="Note" readOnly />
      </OptionalReveal>,
    )
    expect(screen.getByLabelText('Note')).toBeInTheDocument()
  })

  it('lower-cases a sentence-case operator label in the link', () => {
    render(
      <OptionalReveal thing="Other languages spoken" hasValue={false}>
        <input />
      </OptionalReveal>,
    )
    expect(screen.getByRole('button')).toHaveTextContent('Add other languages spoken')
  })
})
