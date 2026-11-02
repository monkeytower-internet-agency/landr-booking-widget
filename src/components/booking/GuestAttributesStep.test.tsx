import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FlowGuestAttribute } from '@/api/flowTypes'
import { GuestAttributesStep } from './GuestAttributesStep'
import type { CompanionDetails, ParticipantDetails } from './detailsTypes'

const ATTRS: FlowGuestAttribute[] = [
  { key: 'age', label: 'Age', value_type: 'integer', unit: 'years' },
  { key: 'clothing_size', label: 'Size', value_type: 'choice', choices: ['S', 'M', 'L'] },
]

const person = (first: string, extra: Partial<ParticipantDetails> = {}): ParticipantDetails => ({
  first_name: first, last_name: '', email: '', phone: '', service_role_code: 'participant', ...extra,
})
const companion = (first: string): CompanionDetails => ({
  first_name: first, last_name: '', email: '', phone: '', companion_kind: 'guest',
})

function renderStep(onConfirm = vi.fn(), onBack = vi.fn()) {
  render(
    <GuestAttributesStep
      productName="Tandem"
      attributes={ATTRS}
      participants={[person('Ada'), person('Kid', { occupant_age_band: 'child', occupant_age: 8 })]}
      companions={[companion('Cleo')]}
      onBack={onBack}
      onConfirm={onConfirm}
    />,
  )
  return { onConfirm, onBack }
}

describe('GuestAttributesStep', () => {
  it('renders one input per guest per attribute, prefilled from the roster age', () => {
    renderStep()
    expect(screen.getAllByTestId(/^guest-attrs-guest-/)).toHaveLength(3)
    expect((screen.getByTestId('guest-attr-1-age') as HTMLInputElement).value).toBe('8')
    expect((screen.getByTestId('guest-attr-0-age') as HTMLInputElement).value).toBe('')
    expect(screen.getByTestId('guest-attr-2-clothing_size').tagName).toBe('SELECT')
    expect(screen.getAllByText('Age (years)')).toHaveLength(3)
  })

  it('blocks Continue until every guest has every answer, then confirms', () => {
    const { onConfirm } = renderStep()
    const submit = screen.getByTestId('guest-attrs-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.change(screen.getByTestId('guest-attr-0-age'), { target: { value: '34' } })
    fireEvent.change(screen.getByTestId('guest-attr-2-age'), { target: { value: '40' } })
    for (const i of [0, 1, 2]) {
      fireEvent.change(screen.getByTestId(`guest-attr-${i}-clothing_size`), { target: { value: 'M' } })
    }
    expect(submit.disabled).toBe(false)
    fireEvent.click(submit)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [participants, companions] = onConfirm.mock.calls[0]!
    expect(participants[0].guest_attributes).toEqual({ age: 34, clothing_size: 'M' })
    expect(participants[0].occupant_age).toBe(34)
    expect(participants[1].guest_attributes).toEqual({ age: 8, clothing_size: 'M' })
    expect(participants[1].occupant_age_band).toBe('child')
    expect(companions[0].guest_attributes).toEqual({ age: 40, clothing_size: 'M' })
  })

  it('refuses an out-of-range value and says so', () => {
    renderStep()
    fireEvent.change(screen.getByTestId('guest-attr-0-age'), { target: { value: '200' } })
    expect(screen.getByRole('alert').textContent).toContain('0-120')
    expect((screen.getByTestId('guest-attrs-submit') as HTMLButtonElement).disabled).toBe(true)
  })
})
