/**
 * DeclarationsStep unit tests (landr-sbhz.3).
 *
 * Covers:
 *   - Continue button is disabled until all checkboxes + language are filled.
 *   - Checking all boxes + selecting language enables Continue.
 *   - onConfirm receives correct declarations record and language.
 *   - Back button calls onBack.
 *   - Back-nav restoration from initialDeclarations.
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

describe('DeclarationsStep (landr-sbhz.3)', () => {
  it('renders all declaration checkboxes and the language selector', () => {
    renderStep()
    for (const item of ITEMS) {
      expect(screen.getByTestId(`decl-checkbox-${item.key}`)).toBeTruthy()
    }
    expect(screen.getByTestId('language-select')).toBeTruthy()
  })

  it('disables Continue when no checkboxes are checked', () => {
    renderStep()
    const btn = screen.getByTestId('declarations-continue')
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('disables Continue when all checkboxes checked but no language selected', () => {
    renderStep()
    for (const item of ITEMS) {
      fireEvent.click(screen.getByTestId(`decl-checkbox-${item.key}`))
    }
    const btn = screen.getByTestId('declarations-continue')
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('disables Continue when language selected but not all boxes checked', () => {
    renderStep()
    // Check only 3 of 4
    for (const item of ITEMS.slice(0, 3)) {
      fireEvent.click(screen.getByTestId(`decl-checkbox-${item.key}`))
    }
    fireEvent.change(screen.getByTestId('language-select'), {
      target: { value: 'en' },
    })
    const btn = screen.getByTestId('declarations-continue')
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables Continue when all boxes checked AND language selected', () => {
    renderStep()
    for (const item of ITEMS) {
      fireEvent.click(screen.getByTestId(`decl-checkbox-${item.key}`))
    }
    fireEvent.change(screen.getByTestId('language-select'), {
      target: { value: 'de' },
    })
    const btn = screen.getByTestId('declarations-continue')
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })

  it('calls onConfirm with correct declarations record and language', () => {
    const onConfirm = vi.fn()
    renderStep({ onConfirm })

    for (const item of ITEMS) {
      fireEvent.click(screen.getByTestId(`decl-checkbox-${item.key}`))
    }
    fireEvent.change(screen.getByTestId('language-select'), {
      target: { value: 'es' },
    })
    fireEvent.click(screen.getByTestId('declarations-continue'))

    expect(onConfirm).toHaveBeenCalledOnce()
    const arg = onConfirm.mock.calls[0][0] as {
      declarations: Record<string, true>
      language: string
    }
    expect(arg.language).toBe('es')
    for (const item of ITEMS) {
      expect(arg.declarations[item.key]).toBe(true)
    }
  })

  it('calls onBack when the back button is clicked', () => {
    const onBack = vi.fn()
    renderStep({ onBack })
    // StepBackButton renders a button with accessible text containing "Back"
    const backBtn = screen.getByRole('button', { name: /back/i })
    fireEvent.click(backBtn)
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('restores initial declarations and language on back-nav re-entry', () => {
    const initialDeclarations = {
      declarations: Object.fromEntries(ITEMS.map((i) => [i.key, true as const])),
      language: 'fr',
    }
    renderStep({ initialDeclarations })

    // All checkboxes should be pre-checked
    for (const item of ITEMS) {
      const checkbox = screen.getByTestId(`decl-checkbox-${item.key}`)
      // The Checkbox component from shadcn renders a button/div — check
      // the aria-checked attribute or the data-state attribute.
      expect(
        checkbox.getAttribute('aria-checked') === 'true' ||
        checkbox.getAttribute('data-state') === 'checked',
      ).toBe(true)
    }

    // Language should be pre-selected
    const select = screen.getByTestId('language-select') as HTMLSelectElement
    expect(select.value).toBe('fr')

    // Continue should be enabled immediately
    const btn = screen.getByTestId('declarations-continue')
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })

  it('unchecking a pre-checked checkbox disables Continue', () => {
    const initialDeclarations = {
      declarations: Object.fromEntries(ITEMS.map((i) => [i.key, true as const])),
      language: 'en',
    }
    renderStep({ initialDeclarations })

    // Uncheck the first declaration
    fireEvent.click(screen.getByTestId(`decl-checkbox-${ITEMS[0]!.key}`))
    const btn = screen.getByTestId('declarations-continue')
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })
})
