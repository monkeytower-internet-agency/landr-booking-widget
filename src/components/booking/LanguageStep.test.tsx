/**
 * landr-r6e5x.4 — the per-participant guide-language step.
 *
 * Drag-and-drop itself is @dnd-kit's, and jsdom has no layout for a pointer
 * drag to resolve against, so these exercise the two NON-drag modalities the
 * board ships precisely so the interaction never depends on drag working: the
 * per-member <select> and tap-to-place. Both write the same map the drag
 * handler does.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LanguageStep } from './LanguageStep'

const NAMES = ['Ada', 'Grace', 'Kay']
const GUESTS = [false, false, true]

function renderStep(
  onConfirm = vi.fn(),
  {
    offeredLanguages = ['en', 'de', 'es'],
    initialAssignment,
    participantNames = NAMES,
    guestFlags = GUESTS,
  }: {
    offeredLanguages?: string[]
    initialAssignment?: Record<number, string>
    participantNames?: string[]
    guestFlags?: boolean[]
  } = {},
) {
  render(
    <LanguageStep
      productName="Tandem"
      participantNames={participantNames}
      guestFlags={guestFlags}
      offeredLanguages={offeredLanguages}
      initialAssignment={initialAssignment}
      onBack={vi.fn()}
      onConfirm={onConfirm}
    />,
  )
  return onConfirm
}

const assignVia = (memberIndex: number, code: string) =>
  fireEvent.change(screen.getByTestId(`lang-assign-select-${memberIndex}`), {
    target: { value: code },
  })

describe('LanguageStep', () => {
  it('starts with everyone unassigned and no column open', () => {
    renderStep()

    expect(screen.getByTestId('lang-unassigned-tray').textContent).toContain(
      'Unassigned (3)',
    )
    expect(screen.getByTestId('lang-chip-2').dataset.guest).toBe('true')
    expect(screen.queryByTestId('lang-column-en')).toBeNull()
    expect(screen.getByTestId('lang-add-en')).toBeTruthy()
    expect(screen.getByTestId('language-step-submit')).toBeDisabled()
  })

  it('offers every OFFERED language in the tray dropdown, not just the open columns', () => {
    // On arrival no column is open, so a dropdown listing only open columns is
    // empty exactly when the customer most needs it.
    renderStep()
    const options = Array.from(
      screen.getByTestId('lang-tray-select-0').querySelectorAll('option'),
    ).map((o) => (o as HTMLOptionElement).value)
    expect(options).toEqual(['', 'en', 'de', 'es'])
  })

  it('opens a column, closes it again while empty, and keeps it once occupied', () => {
    renderStep()
    fireEvent.click(screen.getByTestId('lang-add-de'))
    expect(screen.getByTestId('lang-column-de')).toBeTruthy()
    expect(screen.queryByTestId('lang-add-de')).toBeNull()

    fireEvent.click(screen.getByTestId('lang-remove-de'))
    expect(screen.queryByTestId('lang-column-de')).toBeNull()

    // With someone standing in it the remove control is gone — closing it
    // would silently unassign them.
    assignVia(0, 'de')
    expect(screen.getByTestId('lang-column-de').textContent).toContain('Ada')
    expect(screen.queryByTestId('lang-remove-de')).toBeNull()
  })

  it('re-assigns between columns and leaves the vacated one in place', () => {
    renderStep()
    assignVia(0, 'de')
    assignVia(0, 'es')
    expect(screen.getByTestId('lang-column-de').textContent).not.toContain('Ada')
    expect(screen.getByTestId('lang-column-es').textContent).toContain('Ada')
    // The German column stays put, now empty and removable, rather than
    // vanishing under the customer's cursor.
    expect(screen.getByTestId('lang-remove-de')).toBeTruthy()
  })

  it('tap-to-place assigns, and tapping a placed chip returns them to the tray', () => {
    renderStep()
    fireEvent.click(screen.getByTestId('lang-add-en'))
    fireEvent.click(screen.getByTestId('lang-chip-1'))
    fireEvent.click(screen.getByTestId('lang-place-here-en'))
    expect(screen.getByTestId('lang-column-en').textContent).toContain('Grace')

    fireEvent.click(screen.getByTestId('lang-chip-1'))
    expect(screen.getByTestId('lang-unassigned-tray').textContent).toContain(
      'Grace',
    )
  })

  it('places the WHOLE party in one gesture via "Everyone speaks X"', async () => {
    // The common shape is a group that shares one language. Six people dragged
    // one at a time is six gestures for an answer given in one breath.
    const onConfirm = renderStep()
    fireEvent.click(screen.getByTestId('lang-add-de'))
    fireEvent.click(screen.getByTestId('lang-everyone-de'))

    expect(screen.getByTestId('lang-everyone-assigned')).toBeTruthy()
    // The shortcut disappears once there is nobody left to place.
    expect(screen.queryByTestId('lang-everyone-de')).toBeNull()
    await waitFor(() =>
      expect(screen.getByTestId('language-step-submit')).toBeEnabled(),
    )
    fireEvent.click(screen.getByTestId('language-step-submit'))
    expect(onConfirm).toHaveBeenCalledWith({ 0: 'de', 1: 'de', 2: 'de' })
  })

  it('seeds everyone into the only offered language, making the step a confirmation', () => {
    const onConfirm = renderStep(vi.fn(), { offeredLanguages: ['en'] })

    // Nothing to decide — a mandatory drag exercise with one possible answer
    // is busywork, so the step arrives already satisfied.
    expect(screen.getByTestId('lang-column-en').textContent).toContain('Ada')
    expect(screen.getByTestId('lang-everyone-assigned')).toBeTruthy()
    expect(screen.getByTestId('language-step-submit')).toBeEnabled()
    fireEvent.click(screen.getByTestId('language-step-submit'))
    expect(onConfirm).toHaveBeenCalledWith({ 0: 'en', 1: 'en', 2: 'en' })
  })

  it('blocks Continue until every member — companions included — has a language', async () => {
    const onConfirm = renderStep()
    assignVia(0, 'en')
    assignVia(1, 'en')
    expect(screen.getByTestId('language-step-submit')).toBeDisabled()
    expect(screen.getByTestId('language-step-gate').textContent).toContain(
      'Assign every participant to a language',
    )
    expect(screen.getByTestId('language-step-gate').textContent).toContain('Kay')

    assignVia(2, 'de')
    await waitFor(() =>
      expect(screen.getByTestId('language-step-submit')).toBeEnabled(),
    )
    fireEvent.click(screen.getByTestId('language-step-submit'))
    expect(onConfirm).toHaveBeenCalledWith({ 0: 'en', 1: 'en', 2: 'de' })
  })

  it('announces the gate and points the disabled Continue at it', () => {
    renderStep()
    const gate = screen.getByTestId('language-step-gate')
    // A disabled button with a silent explanation is invisible to a screen
    // reader: the gate is a live region, and Continue names it.
    expect(gate).toHaveAttribute('role', 'status')
    expect(screen.getByTestId('language-step-submit')).toHaveAttribute(
      'aria-describedby',
      gate.id,
    )
  })

  it('restores a draft assignment, columns and all', () => {
    renderStep(vi.fn(), { initialAssignment: { 0: 'en', 1: 'en', 2: 'es' } })
    expect(screen.getByTestId('lang-column-en').textContent).toContain('Ada')
    expect(screen.getByTestId('lang-column-en').textContent).toContain('Grace')
    expect(screen.getByTestId('lang-column-es').textContent).toContain('Kay')
    expect(screen.getByTestId('language-step-submit')).toBeEnabled()
  })

  it('drops a restored assignment to a language the operator has since withdrawn', () => {
    // The operator edited Settings while the customer had the tab open.
    renderStep(vi.fn(), {
      offeredLanguages: ['en', 'de'],
      initialAssignment: { 0: 'en', 1: 'en', 2: 'es' },
    })
    expect(screen.queryByTestId('lang-column-es')).toBeNull()
    expect(screen.getByTestId('lang-unassigned-tray').textContent).toContain('Kay')
    expect(screen.getByTestId('language-step-submit')).toBeDisabled()
  })

  it('labels an unnamed member positionally rather than rendering a blank chip', () => {
    renderStep(vi.fn(), { participantNames: ['Ada', ''], guestFlags: [false, false] })
    expect(screen.getByTestId('lang-chip-1').textContent).toContain('Guest 2')
  })
})
