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
import { buildSecondLanguageCart } from './secondLanguage'
import { loadUiCatalog } from '@/lib/strings'

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
    expect(onConfirm).toHaveBeenCalledWith({ 0: 'de', 1: 'de', 2: 'de' }, {})
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

  it('describes the tap-to-fill / drag-to-split flow behind "How this works" (landr-80ubl.1)', () => {
    renderStep()
    expect(screen.queryByText(/Tap a language/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /how this works/i }))
    expect(screen.getByText(/Tap a language to assign everyone to it/)).toBeInTheDocument()
    expect(screen.getByText(/who speaks what/)).toBeInTheDocument()
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
    expect(onConfirm).toHaveBeenCalledWith({ 0: 'de', 1: 'de', 2: 'de' }, {})
  })

  it('seeds everyone into the only offered language, making the step a confirmation', () => {
    const onConfirm = renderStep(vi.fn(), { offeredLanguages: ['en'] })

    // Nothing to decide — a mandatory drag exercise with one possible answer
    // is busywork, so the step arrives already satisfied.
    expect(screen.getByTestId('lang-column-en').textContent).toContain('Ada')
    expect(screen.getByTestId('lang-everyone-assigned')).toBeTruthy()
    expect(screen.getByTestId('language-step-submit')).toBeEnabled()
    fireEvent.click(screen.getByTestId('language-step-submit'))
    expect(onConfirm).toHaveBeenCalledWith({ 0: 'en', 1: 'en', 2: 'en' }, {})
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
    expect(onConfirm).toHaveBeenCalledWith({ 0: 'en', 1: 'en', 2: 'de' }, {})
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

describe('LanguageStep — no "other languages" input (landr-9d82r.1)', () => {
  it('never renders a free-text other-languages field', () => {
    renderStep()
    expect(screen.queryByTestId('language-step-other-languages')).toBeNull()
    expect(screen.queryByTestId('language-step-other-languages-input')).toBeNull()
  })
})

describe('LanguageStep — next action + zen (landr-80ubl.1)', () => {
  const activeBoxes = () =>
    document.querySelectorAll('[data-next-action="active"]')

  it('exactly one NextAction is active: the board while anyone is unassigned', () => {
    renderStep()
    expect(activeBoxes()).toHaveLength(1)
    expect(screen.getByTestId('lang-next-action')).toHaveAttribute(
      'data-next-action',
      'active',
    )
    expect(screen.getByTestId('next-action-cue')).toHaveTextContent(
      'Next: tap the language your group speaks',
    )
    assignVia(0, 'en')
    assignVia(1, 'en')
    expect(activeBoxes()).toHaveLength(1)
    expect(screen.getByTestId('next-action-cue')).toHaveTextContent(
      'Next: pick a language for Kay',
    )
  })

  it('moves the one active NextAction to Continue once everyone is placed', () => {
    renderStep()
    assignVia(0, 'en')
    assignVia(1, 'en')
    assignVia(2, 'de')
    expect(activeBoxes()).toHaveLength(1)
    expect(screen.getByTestId('lang-next-action')).toHaveAttribute(
      'data-next-action',
      'inactive',
    )
    expect(screen.getByTestId('next-action-cue')).toHaveTextContent('Next: continue')
    expect(screen.getByTestId('language-step-submit')).toHaveAttribute('data-variant', 'default')
  })

  it('keeps the comment behind "+ Add a note for us", open when prefilled', () => {
    renderStep()
    expect(screen.queryByTestId('customer-comment')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /add a note for us/i }))
    expect(screen.getByTestId('customer-comment')).toHaveFocus()
  })

  it('shows a prefilled comment without a click', () => {
    render(
      <LanguageStep
        productName="Tandem"
        participantNames={NAMES}
        guestFlags={GUESTS}
        offeredLanguages={['en']}
        customerComment="Vegan"
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.getByTestId('customer-comment')).toHaveValue('Vegan')
  })
})

// ── landr-hdk4y.2: the second-guiding-language question ─────────────────────

const askingCart = (
  mode: 'off' | 'not_preferred' | 'always' = 'not_preferred',
  options: 'all' | 'preferred' = 'all',
) =>
  buildSecondLanguageCart(
    [
      {
        second_language_mode: mode,
        preferred_guide_languages: ['en', 'de'],
        second_language_options: options,
      },
    ],
    [['en', 'de', 'es', 'fr']],
  )

function renderAsking(
  secondLanguage = askingCart(),
  onConfirm: (a: Record<number, string>, accepted: Record<number, string[]>) => void = vi.fn(),
  props: Partial<React.ComponentProps<typeof LanguageStep>> = {},
) {
  render(
    <LanguageStep
      productName="Tandem"
      participantNames={['Anna', 'Marc', 'Lena']}
      offeredLanguages={['en', 'de', 'es', 'fr']}
      secondLanguage={secondLanguage}
      onBack={vi.fn()}
      onConfirm={onConfirm}
      {...props}
    />,
  )
  return onConfirm
}

describe('LanguageStep — second guiding language (landr-hdk4y.2)', () => {
  it('asks a French participant but not a German one (not_preferred, preferred EN/DE)', () => {
    renderAsking()
    assignVia(0, 'fr')
    assignVia(2, 'de')
    expect(screen.getByTestId('second-language-asked-0')).toBeTruthy()
    expect(screen.queryByTestId('second-language-asked-2')).toBeNull()
    // Marc has no main language yet: nothing to ask.
    expect(screen.queryByTestId('second-language-asked-1')).toBeNull()
    expect(screen.getByText(/If no French guide is available/)).toBeTruthy()
    expect(screen.getByTestId('second-language-helper').textContent).toMatch(/French stays your first choice/)
  })

  it('offers every other guiding language plus the exclusive "only" option', () => {
    renderAsking()
    assignVia(0, 'fr')
    expect(screen.getByTestId('second-language-0-en')).toBeTruthy()
    expect(screen.getByTestId('second-language-0-de')).toBeTruthy()
    expect(screen.getByTestId('second-language-0-es')).toBeTruthy()
    expect(screen.queryByTestId('second-language-0-fr')).toBeNull()
    expect(screen.getByText('I only speak French')).toBeTruthy()
  })

  it('options follow the all / preferred switch', () => {
    renderAsking(askingCart('always', 'preferred'))
    assignVia(0, 'fr')
    expect(screen.getByTestId('second-language-0-en')).toBeTruthy()
    expect(screen.getByTestId('second-language-0-de')).toBeTruthy()
    expect(screen.queryByTestId('second-language-0-es')).toBeNull()
  })

  it('mode always asks everyone, including a German participant', () => {
    renderAsking(askingCart('always'))
    assignVia(0, 'fr')
    assignVia(2, 'de')
    expect(screen.getByTestId('second-language-asked-0')).toBeTruthy()
    expect(screen.getByTestId('second-language-asked-2')).toBeTruthy()
  })

  it('names no single first-choice language when the asked participants differ', () => {
    renderAsking(askingCart('always'))
    assignVia(0, 'fr')
    assignVia(2, 'de')
    const helper = screen.getByTestId('second-language-helper').textContent ?? ''
    expect(helper).toMatch(/Each person's own language stays their first choice/)
    expect(helper).not.toMatch(/French stays/)
  })

  it('mode off changes nothing: no question, Continue as before', () => {
    const onConfirm = renderAsking(askingCart('off'))
    assignVia(0, 'fr')
    assignVia(1, 'de')
    assignVia(2, 'en')
    expect(screen.queryByTestId('second-language-questions')).toBeNull()
    expect(screen.getByTestId('language-step-submit')).not.toBeDisabled()
    fireEvent.click(screen.getByTestId('language-step-submit'))
    expect(onConfirm).toHaveBeenCalledWith({ 0: 'fr', 1: 'de', 2: 'en' }, {})
  })

  it('Continue stays disabled with a clear message until every asked participant answered', () => {
    const onConfirm = renderAsking()
    assignVia(0, 'fr')
    assignVia(1, 'es')
    assignVia(2, 'de')
    expect(screen.getByTestId('language-step-submit')).toBeDisabled()
    expect(screen.getByTestId('language-step-gate').textContent).toMatch(/Tick at least one option.*Anna, Marc/)
    fireEvent.click(screen.getByTestId('second-language-0-en'))
    expect(screen.getByTestId('language-step-submit')).toBeDisabled()
    expect(screen.getByTestId('language-step-gate').textContent).toMatch(/Marc/)
    expect(screen.getByTestId('language-step-gate').textContent).not.toMatch(/Anna/)
    fireEvent.click(screen.getByTestId('second-language-1-only'))
    expect(screen.getByTestId('language-step-submit')).not.toBeDisabled()
    fireEvent.click(screen.getByTestId('language-step-submit'))
    expect(onConfirm).toHaveBeenCalledWith({ 0: 'fr', 1: 'es', 2: 'de' }, { 0: ['en'], 1: [] })
  })

  it('the exclusive option clears the others and ticking another clears it', () => {
    renderAsking()
    assignVia(0, 'fr')
    fireEvent.click(screen.getByTestId('second-language-0-en'))
    fireEvent.click(screen.getByTestId('second-language-0-de'))
    expect(screen.getByTestId('second-language-0-en')).toBeChecked()
    fireEvent.click(screen.getByTestId('second-language-0-only'))
    expect(screen.getByTestId('second-language-0-only')).toBeChecked()
    expect(screen.getByTestId('second-language-0-en')).not.toBeChecked()
    expect(screen.getByTestId('second-language-0-de')).not.toBeChecked()
    fireEvent.click(screen.getByTestId('second-language-0-es'))
    expect(screen.getByTestId('second-language-0-only')).not.toBeChecked()
    expect(screen.getByTestId('second-language-0-es')).toBeChecked()
  })

  it('"Apply to everyone" copies the first answer to the other asked participants, valid values only', () => {
    renderAsking()
    assignVia(0, 'fr')
    assignVia(1, 'es')
    assignVia(2, 'de')
    // Anna (fr) ticks es + en; Marc (es) cannot take es, so only en is copied.
    fireEvent.click(screen.getByTestId('second-language-0-es'))
    fireEvent.click(screen.getByTestId('second-language-0-en'))
    fireEvent.click(screen.getByTestId('second-language-apply-all'))
    expect(screen.getByTestId('second-language-1-en')).toBeChecked()
    expect(screen.queryByTestId('second-language-1-es')).toBeNull()
    expect(screen.getByTestId('second-language-1-de')).not.toBeChecked()
  })

  it('"Apply to everyone" is only on the first asked participant and needs an answer first', () => {
    renderAsking()
    assignVia(0, 'fr')
    assignVia(1, 'es')
    expect(screen.getAllByTestId('second-language-apply-all')).toHaveLength(1)
    expect(screen.getByTestId('second-language-apply-all')).toBeDisabled()
  })

  it('changing a participant main language resets their answer', () => {
    renderAsking()
    assignVia(0, 'fr')
    assignVia(1, 'de')
    assignVia(2, 'de')
    fireEvent.click(screen.getByTestId('second-language-0-en'))
    expect(screen.getByTestId('language-step-submit')).not.toBeDisabled()
    assignVia(0, 'es')
    expect(screen.getByTestId('second-language-0-en')).not.toBeChecked()
    expect(screen.getByTestId('language-step-gate').textContent).toMatch(/Tick at least one option/)
  })

  it('restores earlier answers on back-nav', () => {
    renderAsking(askingCart(), vi.fn(), {
      initialAssignment: { 0: 'fr', 1: 'de', 2: 'de' },
      initialAccepted: { 0: ['en'] },
    })
    expect(screen.getByTestId('second-language-0-en')).toBeChecked()
    expect(screen.getByTestId('language-step-submit')).not.toBeDisabled()
  })

  it('nobody is asked when the step is auto-filled with a single language', () => {
    renderAsking(
      buildSecondLanguageCart(
        [
          {
            second_language_mode: 'always',
            preferred_guide_languages: [],
            second_language_options: 'all',
          },
        ],
        [['fr']],
      ),
      vi.fn(),
      { offeredLanguages: ['fr'] },
    )
    expect(screen.queryByTestId('second-language-questions')).toBeNull()
  })

  it('asks in the widget locale, naming the language in that locale (German)', async () => {
    vi.stubGlobal('navigator', { ...navigator, language: 'de-DE' })
    try {
      await loadUiCatalog('de')
      renderAsking()
      assignVia(0, 'fr')
      expect(
        screen.getByText(
          'Falls kein französischsprachiger Guide verfügbar ist: Welche Sprache wäre auch in Ordnung?',
        ),
      ).toBeTruthy()
      expect(screen.getByTestId('second-language-helper').textContent).toBe(
        'Französisch bleibt Ihre erste Wahl. Je mehr Sprachen Sie ankreuzen, desto eher können wir Ihre Buchung bestätigen.',
      )
      expect(screen.getByText('Ich spreche nur Französisch')).toBeTruthy()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
