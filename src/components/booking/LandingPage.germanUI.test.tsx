/**
 * landr-5aih0.27 — widget German UI.
 *
 * LandingPage — the neutral host-page placeholder shown for a missing/
 * invalid operator token (landr-il9f.2) — renders in German when the
 * browser reports a German locale. No operator resolves here, so there is
 * no customer_languages whitelist; browserLocale() falls straight to the
 * raw navigator locale (see LandingPage.tsx's own doc).
 */
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LandingPage } from './LandingPage'

function setBrowserLanguage(language: string) {
  vi.stubGlobal('navigator', { ...navigator, language })
}

describe('LandingPage — German UI (landr-5aih0.27)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the invalid-token placeholder in German', () => {
    setBrowserLanguage('de-DE')
    render(<LandingPage />)

    expect(
      screen.getByText('Dies ist die Host-Seite für das Landr-Buchungswidget.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('This is the booking-widget host for Landr'),
    ).not.toBeInTheDocument()
    // Brand domain link stays as-is in every locale (not prose).
    expect(screen.getByText('www.landr.de')).toBeInTheDocument()
  })

  it('renders English on a non-German browser (default)', () => {
    setBrowserLanguage('en-US')
    render(<LandingPage />)

    expect(
      screen.getByText('This is the booking-widget host for Landr'),
    ).toBeInTheDocument()
  })
})
