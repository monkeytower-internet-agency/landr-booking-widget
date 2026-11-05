import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { AlternativeBackButton } from './AlternativeBackButton'
import { ALTERNATIVE_BACK_SLOT_ID } from './alternativesSlot'

afterEach(() => {
  document.getElementById(ALTERNATIVE_BACK_SLOT_ID)?.remove()
})

describe('AlternativeBackButton (landr-d9qs8)', () => {
  it('without the price rail it renders inline only', () => {
    const onBack = vi.fn()
    render(<AlternativeBackButton productName="Guided Day" keepsDates onBack={onBack} />)
    const buttons = screen.getAllByTestId('alternative-back')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.textContent).toContain('Guided Day')
    fireEvent.click(buttons[0]!)
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('with the rail slot it portals under the total and hides the inline copy on md+', async () => {
    const slot = document.createElement('div')
    slot.id = ALTERNATIVE_BACK_SLOT_ID
    document.body.appendChild(slot)
    render(<AlternativeBackButton productName="Guided Day" keepsDates={false} onBack={() => {}} />)
    await waitFor(() => expect(screen.getAllByTestId('alternative-back')).toHaveLength(2))
    const buttons = screen.getAllByTestId('alternative-back')
    const inSlot = buttons.filter((b) => slot.contains(b))
    const inline = buttons.filter((b) => !slot.contains(b))
    expect(inSlot).toHaveLength(1)
    expect(inSlot[0]!.className).not.toContain('md:hidden')
    expect(inline[0]!.className).toContain('md:hidden')
  })
})
