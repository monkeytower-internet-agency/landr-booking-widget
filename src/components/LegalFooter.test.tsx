import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LegalFooter } from './LegalFooter'

afterEach(() => vi.restoreAllMocks())

describe('LegalFooter', () => {
  it('links the German imprint and Datenschutzerklärung for de locales', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('de-DE')
    render(<LegalFooter />)
    const imprint = screen.getByTestId('legal-footer-imprint')
    const privacy = screen.getByTestId('legal-footer-privacy')
    expect(imprint).toHaveTextContent('Impressum')
    expect(imprint).toHaveAttribute('href', 'https://compliance.landr.de/impressum/')
    expect(privacy).toHaveTextContent('Datenschutzerklärung')
    expect(privacy).toHaveAttribute('href', 'https://compliance.landr.de/datenschutz/')
  })

  it('links the English imprint and privacy policy otherwise', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-GB')
    render(<LegalFooter />)
    expect(screen.getByTestId('legal-footer-imprint')).toHaveTextContent('Imprint')
    expect(screen.getByTestId('legal-footer-privacy')).toHaveAttribute(
      'href',
      'https://compliance.landr.de/privacy/',
    )
  })

  it('links the Spanish imprint and privacy pages for es locales', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('es-ES')
    render(<LegalFooter />)
    const imprint = screen.getByTestId('legal-footer-imprint')
    const privacy = screen.getByTestId('legal-footer-privacy')
    expect(imprint).toHaveTextContent('Aviso legal')
    expect(imprint).toHaveAttribute('href', 'https://compliance.landr.de/es/impressum/')
    expect(privacy).toHaveTextContent('Política de privacidad')
    expect(privacy).toHaveAttribute('href', 'https://compliance.landr.de/es/privacy/')
  })

  it('links the Turkish imprint and privacy pages for tr locales', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('tr-TR')
    render(<LegalFooter />)
    const imprint = screen.getByTestId('legal-footer-imprint')
    const privacy = screen.getByTestId('legal-footer-privacy')
    expect(imprint).toHaveTextContent('Künye')
    expect(imprint).toHaveAttribute('href', 'https://compliance.landr.de/tr/impressum/')
    expect(privacy).toHaveTextContent('Gizlilik Politikası')
    expect(privacy).toHaveAttribute('href', 'https://compliance.landr.de/tr/privacy/')
  })

  it('falls back to the English privacy policy for unsupported languages', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-FR')
    render(<LegalFooter />)
    expect(screen.getByTestId('legal-footer-imprint')).toHaveAttribute(
      'href',
      'https://compliance.landr.de/impressum/',
    )
    expect(screen.getByTestId('legal-footer-privacy')).toHaveAttribute(
      'href',
      'https://compliance.landr.de/privacy/',
    )
  })
})
