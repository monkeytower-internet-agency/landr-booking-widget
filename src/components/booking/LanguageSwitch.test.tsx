import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LanguageSwitch } from './LanguageSwitch'
import { configureCustomerLocale, configureLanguageSwitcher, getVisitorLang, setVisitorLang } from '@/lib/locale'

describe('LanguageSwitch', () => {
  afterEach(() => {
    setVisitorLang(null)
    configureLanguageSwitcher(false)
    configureCustomerLocale(null, null)
  })

  it('lists native names and stores the pick', async () => {
    configureLanguageSwitcher(true)
    configureCustomerLocale(['en', 'de'], 'en')
    render(<LanguageSwitch />)
    const btn = screen.getByTestId('language-switch')
    expect(btn).toHaveAccessibleName('Choose language')
    btn.focus()
    fireEvent.keyDown(btn, { key: 'ArrowDown' })
    const opt = await screen.findByTestId('language-option-de')
    expect(opt).toHaveTextContent('Deutsch')
    expect(screen.queryByTestId('language-option-fr')).toBeNull()
    fireEvent.click(opt)
    await waitFor(() => expect(getVisitorLang()).toBe('de'))
  })

  it('renders nothing with fewer than two options', () => {
    configureCustomerLocale(['de'], 'de')
    const { container } = render(<LanguageSwitch />)
    expect(container).toBeEmptyDOMElement()
  })
})
