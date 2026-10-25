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

beforeEach(() => {
  resetDemoTemplateCache()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(TEMPLATE), { status: 200 })))
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
      'https://www.landr.de/en/signup/?template=tandem',
    )
    fireEvent.click(screen.getByTestId('demo-congrats-restart'))
    expect(onRestart).toHaveBeenCalled()
  })
})

describe('App in demo mode', () => {
  it('boots without a widget token: Demo label + the template catalogue, never the landing page', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('demo-banner')).toBeInTheDocument())
    expect(await screen.findByText('Tandem flight')).toBeInTheDocument()
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    for (const [url, init] of calls) {
      expect(String(url)).toMatch(/\/api\/public\/templates\/tandem$/)
      expect((init as RequestInit | undefined)?.method ?? 'GET').toBe('GET')
    }
  })

  it('walks the whole flow to the congrats screen and never POSTs', async () => {
    render(<App />)
    fireEvent.click(await screen.findByText('Tandem flight'))
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
    expect(screen.queryByTestId('demo-congrats-cta')).toHaveAttribute('href', expect.stringContaining('template=tandem'))
    for (const [, init] of (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls) {
      expect((init as RequestInit | undefined)?.method ?? 'GET').toBe('GET')
    }
  })
})
