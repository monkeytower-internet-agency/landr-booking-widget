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

  it('a later flag tap opens an empty column, closes it again while empty, and keeps it once occupied', () => {
    // landr-jr30v: the FIRST flag tap ever now assigns the whole party (see
    // the dedicated tests below), so this exercises "open an empty column"
    // primed past that state with an unrelated first tap.
    renderStep()
    fireEvent.click(screen.getByTestId('lang-add-en'))
    fireEvent.click(screen.getByTestId('lang-add-de'))
    expect(screen.getByTestId('lang-column-de')).toBeTruthy()
    expect(screen.getByTestId('lang-column-de').textContent).toContain('Drop names here')
    expect(screen.queryByTestId('lang-add-de')).toBeNull()

    fireEvent.click(screen.getByTestId('lang-remove-de'))
    expect(screen.queryByTestId('lang-column-de')).toBeNull()

    // With someone standing in it the remove control is gone — closing it
    // would silently unassign them.
    assignVia(0, 'de')
    expect(screen.getByTestId('lang-column-de').textContent).toContain('Ada')
    expect(screen.queryByTestId('lang-remove-de')).toBeNull()
  })

  it('the first flag tap ever, with nothing open, assigns the WHOLE party', async () => {
    // landr-jr30v: the standard case is a group that shares one language —
    // the approver's Trello comment asks for this to be a single tap.
    const onConfirm = renderStep()
    fireEvent.click(screen.getByTestId('lang-add-de'))

    const column = screen.getByTestId('lang-column-de')
    expect(column.textContent).toContain('Ada')
    expect(column.textContent).toContain('Grace')
    expect(column.textContent).toContain('Kay')
    expect(screen.getByTestId('lang-everyone-assigned')).toBeTruthy()
    await waitFor(() =>
      expect(screen.getByTestId('language-step-submit')).toBeEnabled(),
    )
    fireEvent.click(screen.getByTestId('language-step-submit'))
    expect(onConfirm).toHaveBeenCalledWith({ 0: 'de', 1: 'de', 2: 'de' })
  })

  it('a second (or third...) flag tap just opens an empty column, nobody moves', () => {
    renderStep()
    fireEvent.click(screen.getByTestId('lang-add-de')) // first tap: whole party -> de
    fireEvent.click(screen.getByTestId('lang-add-en')) // second tap: opens an empty column

    const enColumn = screen.getByTestId('lang-column-en')
    expect(enColumn.textContent).toContain('Drop names here')
    expect(enColumn.textContent).not.toContain('Ada')
    expect(enColumn.textContent).not.toContain('Grace')
    expect(enColumn.textContent).not.toContain('Kay')
    // Everyone is still where the first tap put them.
    expect(screen.getByTestId('lang-column-de').textContent).toContain('Ada')
    expect(screen.getByTestId('lang-column-de').textContent).toContain('Grace')
    expect(screen.getByTestId('lang-column-de').textContent).toContain('Kay')
  })

  it('tap-to-place on a closed flag beats the whole-group shortcut — only the picked-up chip moves', () => {
    renderStep()
    fireEvent.click(screen.getByTestId('lang-chip-1')) // pick up Grace from the tray
    fireEvent.click(screen.getByTestId('lang-add-es')) // tap a closed flag with nothing open

    const column = screen.getByTestId('lang-column-es')
    expect(column.textContent).toContain('Grace')
    expect(column.textContent).not.toContain('Ada')
    expect(column.textContent).not.toContain('Kay')
    expect(screen.getByTestId('lang-unassigned-tray').textContent).toContain('Ada')
    expect(screen.getByTestId('lang-unassigned-tray').textContent).toContain('Kay')
  })

  // landr-ajlwl — a closed flag button is bimodal (see the tests above); its
  // accessible name must say which mode is live, since its visible text
  // ("🇩🇪 German") never changes across the three.
  it('gives a closed flag button a mode-aware accessible name in each of the three tap modes', () => {
    renderStep()
    // Nothing open, nothing picked up -> a tap would assign the whole party.
    expect(screen.getByTestId('lang-add-de')).toHaveAccessibleName(
      'Everyone speaks German',
    )

    // A chip is picked up from the tray -> a tap would place ONLY it.
    fireEvent.click(screen.getByTestId('lang-chip-1')) // pick up Grace
    expect(screen.getByTestId('lang-add-es')).toHaveAccessibleName(
      'Place Grace in Spanish',
    )
    fireEvent.click(screen.getByTestId('lang-chip-1')) // put Grace back down

    // A column is already open -> a tap on another closed flag just opens it.
    fireEvent.click(screen.getByTestId('lang-add-de')) // first-ever tap: whole party -> de
    expect(screen.getByTestId('lang-add-en')).toHaveAccessibleName('Add English')
  })

  it('announces the result of a flag tap in the visually-hidden status region, but not on first render', () => {
    renderStep()
    const status = screen.getByTestId('lang-tap-announcement')
    expect(status).toHaveAttribute('role', 'status')
    expect(status.textContent).toBe('')

    fireEvent.click(screen.getByTestId('lang-add-de')) // first-ever tap -> whole party
    expect(status.textContent).toBe('Everyone assigned to German.')

    fireEvent.click(screen.getByTestId('lang-add-en')) // column already open -> just opens
    expect(status.textContent).toBe('English added.')

    fireEvent.click(screen.getByTestId('lang-chip-1')) // Grace is in 'de' -> un-assign her
    fireEvent.click(screen.getByTestId('lang-chip-1')) // pick her back up from the tray
    fireEvent.click(screen.getByTestId('lang-add-es')) // tap-to-place her in Spanish
    expect(status.textContent).toBe('Grace assigned to Spanish.')
  })

  it('describes the new tap-to-fill / drag-to-split flow', () => {
    renderStep()
    expect(screen.getByTestId('participant-language-board').textContent).toContain(
      'Tap a language',
    )
  })

  it('labels the add-language row "Languages:" before anything is open, "Add language:" after', () => {
    renderStep()
    expect(screen.getByTestId('lang-add-row').textContent).toContain('Languages:')
    fireEvent.click(screen.getByTestId('lang-add-de'))
    expect(screen.getByTestId('lang-add-row').textContent).toContain('Add language:')
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
    // landr-jr30v: the first flag tap ever assigns the whole party, so prime
    // past that with a first tap, then send Grace back to the tray (tapping
    // an already-placed chip un-assigns) before tap-to-placing her again.
    fireEvent.click(screen.getByTestId('lang-add-de')) // first tap: whole party -> de
    fireEvent.click(screen.getByTestId('lang-add-en')) // second tap: opens an empty column

    fireEvent.click(screen.getByTestId('lang-chip-1')) // Grace is in 'de' -> un-assign
    expect(screen.getByTestId('lang-unassigned-tray').textContent).toContain('Grace')

    fireEvent.click(screen.getByTestId('lang-chip-1')) // now in the tray -> pick up
    fireEvent.click(screen.getByTestId('lang-place-here-en'))
    expect(screen.getByTestId('lang-column-en').textContent).toContain('Grace')

    fireEvent.click(screen.getByTestId('lang-chip-1'))
    expect(screen.getByTestId('lang-unassigned-tray').textContent).toContain(
      'Grace',
    )
  })

  it('places the WHOLE party in one gesture via the explicit "Everyone speaks X" button', async () => {
    // The common shape is a group that shares one language. Six people dragged
    // one at a time is six gestures for an answer given in one breath. Opened
    // via the dropdown (not a flag tap) so the new first-tap shortcut isn't
    // what's under test here — see the dedicated first-tap tests above.
    const onConfirm = renderStep()
    assignVia(0, 'en') // opens 'en' with just Ada
    fireEvent.click(screen.getByTestId('lang-add-de')) // a column is already open -> opens an empty column
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

describe('LanguageStep — other languages spoken (landr-8sk6l)', () => {
  it('renders nothing when the flow declares no such field', () => {
    renderStep()
    expect(screen.queryByTestId('language-step-other-languages')).toBeNull()
  })

  it('renders the operator label and reports every keystroke', () => {
    const onChange = vi.fn()
    render(
      <LanguageStep
        productName="Tandem"
        participantNames={NAMES}
        guestFlags={GUESTS}
        offeredLanguages={['en']}
        otherLanguages={{
          label: 'Other languages spoken',
          maxLength: 200,
          value: '',
          onChange,
        }}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.getByTestId('language-step-other-languages').textContent).toContain(
      'Other languages spoken (optional)',
    )
    const input = screen.getByTestId('language-step-other-languages-input')
    expect(input).toHaveAttribute('maxLength', '200')
    fireEvent.change(input, { target: { value: 'Italian' } })
    expect(onChange).toHaveBeenCalledWith('Italian')
  })
})
