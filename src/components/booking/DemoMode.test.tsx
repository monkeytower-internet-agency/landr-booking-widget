import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { fillBillingFields } from '@/test/fillBilling'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App'
import { resetDemoTemplateCache } from '@/api/demo'
import { DemoBanner, DemoCongrats } from './DemoMode'

const TEMPLATE = {
  slug: 'tandem',
  version: 1,
  flow: 'solo',
  product_count: 1,
  pitch: { en: { headline: 'Fly guests on your own' } },
}

const CATALOGUE = {
  template_slug: 'tandem',
  version: 1,
  groups: [],
  products: [
    {
      slug: 'alpine-tandem', name: 'Alpine tandem flight', name_localized: { de: 'Alpiner Tandemflug' },
      short_description: 'Soar over the valley', short_description_localized: null, description: null,
      product_kind: 'service', service_time_shape: 'single_date', is_contiguous: false,
      duration_minutes: null, group_slug: null, group_name: null, sort_order: 1,
      price_per_unit: 140, currency: 'EUR', price_from: '140.00', price_base: '140.00', price_notes: [],
      images: [], thumb_url: null, guide_languages: null,
    },
  ],
}

beforeEach(() => {
  resetDemoTemplateCache()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      new Response(JSON.stringify(String(url).endsWith('/catalogue') ? CATALOGUE : TEMPLATE), { status: 200 }),
    ),
  )
  window.history.replaceState({}, '', '/?demo=tandem')
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

describe('demo components', () => {
  it('labels the widget as a demo', () => {
    render(<DemoBanner />)
    expect(screen.getByTestId('demo-banner')).toHaveTextContent('Demo')
  })

  it('congrats screen links back to signup with the template preselected', () => {
    const onRestart = vi.fn()
    render(<DemoCongrats slug="tandem" onRestart={onRestart} />)
    expect(screen.getByTestId('demo-congrats')).toHaveTextContent('what your customers would see')
    expect(screen.getByTestId('demo-congrats-cta')).toHaveAttribute(
      'href',
      'https://www.landr.de/signup/?template=tandem',
    )
    fireEvent.click(screen.getByTestId('demo-congrats-restart'))
    expect(onRestart).toHaveBeenCalled()
  })
})

describe('App in demo mode', () => {
  it('boots without a widget token: Demo label + the template catalogue, never the landing page', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('demo-banner')).toBeInTheDocument())
    expect(await screen.findByText('Alpine tandem flight')).toBeInTheDocument()
    expect(screen.queryByText('Tandem flight')).not.toBeInTheDocument()
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    for (const [url, init] of calls) {
      expect(String(url)).toMatch(/\/api\/public\/templates\/tandem(\/catalogue)?$/)
      expect((init as RequestInit | undefined)?.method ?? 'GET').toBe('GET')
    }
  })

  it('prefills the sample customer so a viewer just clicks Continue', async () => {
    render(<App />)
    fireEvent.click(await screen.findByText('Alpine tandem flight'))
    fireEvent.click(await screen.findByTestId('product-detail-book-cta'))
    await waitFor(() => {
      expect(screen.getAllByRole('gridcell').some((c) => c.querySelector('button:not([disabled])'))).toBe(true)
    })
    const day = screen
      .getAllByRole('gridcell')
      .map((c) => c.querySelector('button'))
      .filter((b): b is HTMLButtonElement => !!b && !b.disabled)[0]!
    fireEvent.click(day)
    fireEvent.click(await screen.findByRole('button', { name: /continue/i }))
    await screen.findByText(/your contact details/i)
    const val = (name: string) => document.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value
    expect(val('booker_first_name')).toBe('Alex')
    expect(val('booker_email')).toBe('alex.morgan@example.com')
    expect(val('booker_phone')).toBe('+4915112345678')
    expect(val('booker_billing_city')).toBe('Munich')
    expect(val('booker_billing_country')).toBe('DE')
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled()
  })

  it('walks the whole flow to the congrats screen and never POSTs', async () => {
    render(<App />)
    fireEvent.click(await screen.findByText('Alpine tandem flight'))
    fireEvent.click(await screen.findByTestId('product-detail-book-cta'))
    await waitFor(() => {
      const enabled = screen
        .getAllByRole('gridcell')
        .map((c) => c.querySelector('button'))
        .filter((b): b is HTMLButtonElement => !!b && !b.disabled)
      expect(enabled.length).toBeGreaterThan(0)
    })
    const day = screen
      .getAllByRole('gridcell')
      .map((c) => c.querySelector('button'))
      .filter((b): b is HTMLButtonElement => !!b && !b.disabled)[0]!
    fireEvent.click(day)
    fireEvent.click(await screen.findByRole('button', { name: /continue/i }))
    await screen.findByText(/your contact details/i)
    const setInput = (name: string, value: string) =>
      fireEvent.change(document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!, {
        target: { value },
      })
    setInput('booker_first_name', 'Ada')
    setInput('booker_last_name', 'Lovelace')
    setInput('booker_email', 'ada@example.com')
    setInput('booker_phone', '+34 600000000')
    fillBillingFields()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    const submit = await screen.findByTestId('language-step-submit').catch(() => null)
    if (submit) {
      if ((submit as HTMLButtonElement).disabled) fireEvent.click(screen.getByTestId('lang-add-en'))
      await waitFor(() => expect(screen.getByTestId('language-step-submit')).toBeEnabled())
      fireEvent.click(screen.getByTestId('language-step-submit'))
    }
    fireEvent.click(await screen.findByRole('button', { name: /confirm booking/i }))
    expect(await screen.findByTestId('demo-congrats')).toBeInTheDocument()
    // the real confirmation, with the sample booking overview, under the demo-only text
    expect(await screen.findByTestId('demo-overview')).toHaveTextContent(/Alpine tandem flight/)
    expect(screen.getByTestId('demo-overview')).toHaveTextContent('Ada')
    expect(screen.getByTestId('demo-congrats')).toHaveTextContent(/only a demo/i)
    // one restart only: Confirmation's own 'make another booking' is hidden in demo
    expect(screen.getByTestId('demo-congrats-restart')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /make another booking/i })).toBeNull()
    expect(screen.queryByTestId('demo-congrats-cta')).toHaveAttribute('href', expect.stringContaining('template=tandem'))
    for (const [, init] of (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls) {
      expect((init as RequestInit | undefined)?.method ?? 'GET').toBe('GET')
    }
  })
})
