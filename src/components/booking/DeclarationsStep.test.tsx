/**
 * DeclarationsStep unit tests (landr-sbhz.3 / landr-87n9.4).
 *
 * Covers:
 *   - Continue button is disabled until all checkboxes + at least one
 *     language (checkbox or free-text) are filled.
 *   - Checking all boxes + selecting at least one language enables Continue.
 *   - onConfirm receives correct declarations record, languages array, and
 *     otherLanguages string.
 *   - Free-text alone (no list checkbox) satisfies the language requirement.
 *   - Both list selection AND free-text can be provided together.
 *   - Back button calls onBack.
 *   - Back-nav restoration from initialDeclarations restores all fields.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  DeclarationsStep,
  type DeclarationItem,
  type LanguageOption,
} from './DeclarationsStep'

const ITEMS: DeclarationItem[] = [
  { key: 'license_valid', label: 'I have a valid paragliding license.' },
  { key: 'insurance_valid', label: 'I have valid health + liability insurance.' },
  { key: 'autonomous_pilot', label: 'I am an autonomous intermediate-advanced pilot.' },
  { key: 'emergency_contact', label: 'I will provide an emergency contact on first day.' },
]

const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
]

function renderStep(props?: Partial<Parameters<typeof DeclarationsStep>[0]>) {
  const defaults = {
    productName: 'Guided Paragliding',
    declarationItems: ITEMS,
    languageOptions: LANGUAGES,
    onBack: vi.fn(),
    onConfirm: vi.fn(),
  }
  return render(<DeclarationsStep {...defaults} {...props} />)
}

/** Check all 4 declaration checkboxes. */
function checkAllDeclarations() {
  for (const item of ITEMS) {
    fireEvent.click(screen.getByTestId(`decl-checkbox-${item.key}`))
  }
}

describe('DeclarationsStep (landr-sbhz.3 / landr-87n9.4)', () => {
  it('renders all declaration checkboxes, language checkboxes, and the other-languages input', () => {
    renderStep()
    for (const item of ITEMS) {
      expect(screen.getByTestId(`decl-checkbox-${item.key}`)).toBeTruthy()
    }
    for (const lang of LANGUAGES) {
      expect(screen.getByTestId(`lang-checkbox-${lang.code}`)).toBeTruthy()
    }
    expect(screen.getByTestId('other-languages-input')).toBeTruthy()
  })

  it('disables Continue when no checkboxes are checked', () => {
    renderStep()
    const btn = screen.getByTestId('declarations-continue')
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('disables Continue when all declaration boxes checked but no language indicated', () => {
    renderStep()
    checkAllDeclarations()
    const btn = screen.getByTestId('declarations-continue')
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('disables Continue when a language is selected but not all declaration boxes checked', () => {
    renderStep()
    // Check only 3 of 4 declarations
    for (const item of ITEMS.slice(0, 3)) {
      fireEvent.click(screen.getByTestId(`decl-checkbox-${item.key}`))
    }
    // Pick one language
    fireEvent.click(screen.getByTestId('lang-checkbox-en'))
    const btn = screen.getByTestId('declarations-continue')
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables Continue when all boxes checked AND at least one language checkbox selected', () => {
    renderStep()
    checkAllDeclarations()
    fireEvent.click(screen.getByTestId('lang-checkbox-de'))
    const btn = screen.getByTestId('declarations-continue')
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })

  it('enables Continue when all boxes checked AND only the free-text other-languages is filled', () => {
    renderStep()
    checkAllDeclarations()
    fireEvent.change(screen.getByTestId('other-languages-input'), {
      target: { value: 'Zulu' },
    })
    const btn = screen.getByTestId('declarations-continue')
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })

  it('disables Continue again when free-text is cleared after being the only language source', () => {
    renderStep()
    checkAllDeclarations()
    fireEvent.change(screen.getByTestId('other-languages-input'), {
      target: { value: 'Zulu' },
    })
    fireEvent.change(screen.getByTestId('other-languages-input'), {
      target: { value: '   ' }, // whitespace-only counts as empty
    })
    const btn = screen.getByTestId('declarations-continue')
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('calls onConfirm with correct declarations record, languages array, and otherLanguages string', () => {
    const onConfirm = vi.fn()
    renderStep({ onConfirm })

    checkAllDeclarations()
    // Select two languages from the list
    fireEvent.click(screen.getByTestId('lang-checkbox-en'))
    fireEvent.click(screen.getByTestId('lang-checkbox-es'))
    // Also add free-text
    fireEvent.change(screen.getByTestId('other-languages-input'), {
      target: { value: '  Zulu  ' },
    })
    fireEvent.click(screen.getByTestId('declarations-continue'))

    expect(onConfirm).toHaveBeenCalledOnce()
    const arg = onConfirm.mock.calls[0][0] as {
      declarations: Record<string, true>
      languages: string[]
      otherLanguages: string
    }
    expect(arg.languages).toContain('en')
    expect(arg.languages).toContain('es')
    expect(arg.languages).toHaveLength(2)
    // otherLanguages is trimmed
    expect(arg.otherLanguages).toBe('Zulu')
    for (const item of ITEMS) {
      expect(arg.declarations[item.key]).toBe(true)
    }
  })

  it('calls onConfirm with languages=[] when only free-text was provided', () => {
    const onConfirm = vi.fn()
    renderStep({ onConfirm })

    checkAllDeclarations()
    fireEvent.change(screen.getByTestId('other-languages-input'), {
      target: { value: 'Russian' },
    })
    fireEvent.click(screen.getByTestId('declarations-continue'))

    expect(onConfirm).toHaveBeenCalledOnce()
    const arg = onConfirm.mock.calls[0][0] as {
      languages: string[]
      otherLanguages: string
    }
    expect(arg.languages).toHaveLength(0)
    expect(arg.otherLanguages).toBe('Russian')
  })

  it('calls onBack when the back button is clicked', () => {
    const onBack = vi.fn()
    renderStep({ onBack })
    // StepBackButton renders a button with accessible text containing "Back"
    const backBtn = screen.getByRole('button', { name: /back/i })
    fireEvent.click(backBtn)
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('restores initial declarations, languages, and otherLanguages on back-nav re-entry', () => {
    const initialDeclarations = {
      declarations: Object.fromEntries(ITEMS.map((i) => [i.key, true as const])),
      languages: ['en', 'fr'],
      otherLanguages: 'Catalan',
    }
    renderStep({ initialDeclarations })

    // All declaration checkboxes should be pre-checked
    for (const item of ITEMS) {
      const checkbox = screen.getByTestId(`decl-checkbox-${item.key}`)
      expect(
        checkbox.getAttribute('aria-checked') === 'true' ||
        checkbox.getAttribute('data-state') === 'checked',
      ).toBe(true)
    }

    // Selected language checkboxes should be checked
    const enCheckbox = screen.getByTestId('lang-checkbox-en')
    expect(
      enCheckbox.getAttribute('aria-checked') === 'true' ||
      enCheckbox.getAttribute('data-state') === 'checked',
    ).toBe(true)
    const frCheckbox = screen.getByTestId('lang-checkbox-fr')
    expect(
      frCheckbox.getAttribute('aria-checked') === 'true' ||
      frCheckbox.getAttribute('data-state') === 'checked',
    ).toBe(true)
    // Unselected ones should NOT be checked
    const deCheckbox = screen.getByTestId('lang-checkbox-de')
    expect(
      deCheckbox.getAttribute('data-state') === 'unchecked' ||
      deCheckbox.getAttribute('aria-checked') !== 'true',
    ).toBe(true)

    // Other-languages input should be pre-filled
    const input = screen.getByTestId('other-languages-input') as HTMLInputElement
    expect(input.value).toBe('Catalan')

    // Continue should be enabled immediately (all declarations + languages restored)
    const btn = screen.getByTestId('declarations-continue')
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })

  it('unchecking a pre-checked declaration disables Continue', () => {
    const initialDeclarations = {
      declarations: Object.fromEntries(ITEMS.map((i) => [i.key, true as const])),
      languages: ['en'],
      otherLanguages: '',
    }
    renderStep({ initialDeclarations })

    // Uncheck the first declaration
    fireEvent.click(screen.getByTestId(`decl-checkbox-${ITEMS[0]!.key}`))
    const btn = screen.getByTestId('declarations-continue')
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('toggling a language checkbox on then off removes it from the selection', () => {
    renderStep()
    checkAllDeclarations()

    // Toggle 'en' on, then off
    fireEvent.click(screen.getByTestId('lang-checkbox-en'))
    fireEvent.click(screen.getByTestId('lang-checkbox-en'))

    // No language selected → Continue disabled
    const btn = screen.getByTestId('declarations-continue')
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })
})
