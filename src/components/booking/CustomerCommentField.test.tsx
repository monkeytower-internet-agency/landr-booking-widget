import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  CustomerCommentField,
  MAX_COMMENT_LENGTH,
} from './CustomerCommentField'

// landr-n6ii3: shared "Anything we should know?" field, extracted out of
// DetailsStep so every step from details onward can render it. This unit
// test covers the presentation contract (label/hint/counter/maxLength) and
// the onChange wiring; each step's own test file covers it actually being
// rendered in place, and App.test.tsx covers it round-tripping through the
// persistent draft across steps.
describe('CustomerCommentField (landr-n6ii3)', () => {
  it('renders the label, hint, current value and counter', () => {
    render(<CustomerCommentField value="hello" onChange={vi.fn()} />)
    expect(
      screen.getByLabelText(/Anything we should know\?/i),
    ).toHaveValue('hello')
    expect(screen.getByTestId('customer-comment-counter')).toHaveTextContent(
      `5/${MAX_COMMENT_LENGTH}`,
    )
  })

  it('is empty and shows a 0 count when value is an empty string', () => {
    render(<CustomerCommentField value="" onChange={vi.fn()} />)
    expect(screen.getByTestId('customer-comment')).toHaveValue('')
    expect(screen.getByTestId('customer-comment-counter')).toHaveTextContent(
      `0/${MAX_COMMENT_LENGTH}`,
    )
  })

  it('calls onChange with the new text on every keystroke', () => {
    const onChange = vi.fn()
    render(<CustomerCommentField value="" onChange={onChange} />)
    fireEvent.change(screen.getByTestId('customer-comment'), {
      target: { value: 'a dietary need' },
    })
    expect(onChange).toHaveBeenCalledWith('a dietary need')
  })

  it('caps input at MAX_COMMENT_LENGTH via the textarea maxLength attribute', () => {
    render(<CustomerCommentField value="" onChange={vi.fn()} />)
    expect(screen.getByTestId('customer-comment')).toHaveAttribute(
      'maxLength',
      String(MAX_COMMENT_LENGTH),
    )
  })

  it('never marks the field as required', () => {
    render(<CustomerCommentField value="" onChange={vi.fn()} />)
    expect(screen.getByTestId('customer-comment')).not.toBeRequired()
  })
})

describe('CustomerCommentField collapsible (landr-80ubl.1)', () => {
  it('collapsible + empty: only the "+ Add a note for us" link until clicked', () => {
    render(<CustomerCommentField value="" onChange={vi.fn()} collapsible />)
    expect(screen.queryByTestId('customer-comment')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /add a note for us/i }))
    expect(screen.getByTestId('customer-comment')).toBeInTheDocument()
  })

  it('collapsible + prefilled: open straight away', () => {
    render(<CustomerCommentField value="Vegan" onChange={vi.fn()} collapsible />)
    expect(screen.getByTestId('customer-comment')).toHaveValue('Vegan')
  })
})

