/**
 * Demo mode, App-level walk through the three template kinds the generic
 * catalogue could not carry (landr-m6tp4.46): a stay (apartment), a pass
 * (site_day_pass) and a verified registration (testival). Only `fetch` is
 * stubbed — with the template catalogue as the API serves it — so the real
 * client, demo router and widget screens run; every call must be a GET.
 */
import { fillBillingFields } from '@/test/fillBilling'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { resetDemoTemplateCache } from '@/api/demo'
import { startOfToday } from './calendarStart'
import { dateFromIso, isoDate } from './dateUtils'

vi.setConfig({ testTimeout: 30_000 })
const SLOW = { timeout: 8000 }

const base = {
  name_localized: null, short_description: null, short_description_localized: null, description: null,
  is_contiguous: false, duration_minutes: null, group_slug: null, group_name: null, sort_order: 1,
  currency: 'EUR', price_notes: [], images: [], thumb_url: null, guide_languages: null,
  requires_verification: false, daily_cap: null, waiver_text_localized: null, pass_tiers: null,
}

const CATALOGUES: Record<string, { head: Record<string, unknown>; products: Record<string, unknown>[] }> = {
  apartment: {
    head: { slug: 'apartment', version: 1, flow: 'company', product_count: 1, pitch: { en: { headline: 'Host guests' } } },
    products: [
      {
        ...base, slug: 'studio', name: 'Harbour studio', product_kind: 'stay', service_time_shape: null,
        short_description: 'Sleeps two', price_per_unit: 85, price_from: '85.00', price_base: '85.00',
        stay: {
          min_nights: 2, max_nights: 28, cleaning_fee_cents: 4000,
          check_in_time: '15:00', check_out_time: '11:00', sleeps: 2,
        },
      },
    ],
  },
  site_day_pass: {
    head: { slug: 'site_day_pass', version: 1, flow: 'company', product_count: 1, pitch: { en: { headline: 'Sell passes' } } },
    products: [
      {
        ...base, slug: 'site-pass', name: 'Flying-site pass', product_kind: 'pass', service_time_shape: null,
        short_description: 'Your ticket to fly', price_per_unit: 8, price_from: '12.00', price_base: '12.00',
        pass_tiers: [
          { label: 'Day', validity_kind: 'day', validity_days: null, season_start: null, season_end: null, price_cents: 1200, member_price_cents: 900 },
          { label: 'Week', validity_kind: 'week', validity_days: null, season_start: null, season_end: null, price_cents: 5500, member_price_cents: 4000 },
          { label: 'Season', validity_kind: 'season', validity_days: null, season_start: '2099-03-01', season_end: '2099-10-31', price_cents: 18000, member_price_cents: 13000 },
        ],
      },
    ],
  },
  testival: {
    head: { slug: 'testival', version: 1, flow: 'company', product_count: 1, pitch: { en: { headline: 'Run a test event' } } },
    products: [
      {
        ...base, slug: 'testival-day', name: 'Testival day registration', product_kind: 'service',
        service_time_shape: 'single_date', short_description: 'Free entry for one day',
        price_per_unit: null, price_from: null, price_base: null, daily_cap: 250,
        requires_verification: true,
        waiver_text_localized: { en: 'I fly at my own risk and my documents are valid.', de: 'Ich fliege auf eigenes Risiko.' },
      },
    ],
  },
}

let fetchMock: ReturnType<typeof vi.fn>

function start(slug: string) {
  const { head, products } = CATALOGUES[slug]!
  const catalogue = { template_slug: slug, version: 1, groups: [], products }
  fetchMock = vi.fn(async (url: string) =>
    new Response(JSON.stringify(String(url).endsWith('/catalogue') ? catalogue : head), { status: 200 }),
  )
  vi.stubGlobal('fetch', fetchMock)
  window.history.replaceState({}, '', `/?demo=${slug}`)
}

beforeEach(() => {
  window.sessionStorage.clear()
  resetDemoTemplateCache()
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

function expectOnlyTemplateReads(slug: string) {
  expect(fetchMock.mock.calls.length).toBeGreaterThan(0)
  for (const [url, init] of fetchMock.mock.calls) {
    // The details step's country guess asks the widget's own origin for /geo.
    if (new URL(String(url), 'http://widget.test').pathname === '/geo') continue
    expect(String(url)).toMatch(new RegExp(`/api/public/templates/${slug}(/catalogue)?$`))
    expect((init as RequestInit | undefined)?.method ?? 'GET').toBe('GET')
  }
}

const setInput = (name: string, value: string) =>
  fireEvent.change(document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!, { target: { value } })

function fillBooker() {
  setInput('booker_first_name', 'Ada')
  setInput('booker_last_name', 'Lovelace')
  setInput('booker_email', 'ada@example.com')
  setInput('booker_phone', '+34 600000000')
  fillBillingFields()
}

async function clickDay(iso: string) {
  for (let i = 0; i < 4; i += 1) {
    const btn = document.querySelector<HTMLButtonElement>(
      `button[data-day="${dateFromIso(iso).toLocaleDateString()}"]`,
    )
    if (btn) {
      fireEvent.click(btn)
      return
    }
    fireEvent.click(screen.getByRole('button', { name: /next month/i }))
  }
  throw new Error(`no day button for ${iso}`)
}

const addDays = (iso: string, n: number) => {
  const d = dateFromIso(iso)
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

describe('demo mode: apartment (stay)', () => {
  it('range picker -> nightly quote with the cleaning fee -> congrats, never a POST', async () => {
    start('apartment')
    render(<App />)
    fireEvent.click(await screen.findByText('Harbour studio'))
    fireEvent.click(await screen.findByTestId('product-detail-book-cta'))
    await screen.findByText(/choose your dates/i, undefined, SLOW)
    expect(await screen.findByTestId('stay-picker-times')).toHaveTextContent('15:00')
    const today = isoDate(startOfToday())
    await waitFor(
      () => expect(document.querySelector(`button[data-day="${dateFromIso(today).toLocaleDateString()}"]`)).not.toBeNull(),
      SLOW,
    )
    await clickDay(addDays(today, 3))
    await clickDay(addDays(today, 6))
    const next = screen.getByTestId('stay-picker-submit')
    await waitFor(() => expect(next).toBeEnabled())
    fireEvent.click(next)

    await screen.findByText(/your contact details/i, undefined, SLOW)
    fillBooker()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByText(/review your booking/i, undefined, SLOW)
    // 3 nights x 85.00 + 40.00 cleaning fee
    const rate = (await screen.findAllByTestId('price-sidebar-stay-rate'))[0]!
    expect(rate).toHaveTextContent(/3.*85/)
    expect((await screen.findAllByTestId('price-sidebar-cleaning-fee'))[0]).toHaveTextContent(/40/)
    expect(screen.queryAllByTestId('price-sidebar-stay-errors')).toHaveLength(0)
    const confirm = screen.getByRole('button', { name: /confirm booking/i })
    await waitFor(() => expect(confirm).toBeEnabled())
    fireEvent.click(confirm)
    expect(await screen.findByTestId('demo-congrats')).toBeInTheDocument()
    expectOnlyTemplateReads('apartment')
  })

  it('refuses a stay shorter than the minimum, as production does', async () => {
    start('apartment')
    render(<App />)
    fireEvent.click(await screen.findByText('Harbour studio'))
    fireEvent.click(await screen.findByTestId('product-detail-book-cta'))
    await screen.findByText(/choose your dates/i, undefined, SLOW)
    const today = isoDate(startOfToday())
    await waitFor(
      () => expect(document.querySelector(`button[data-day="${dateFromIso(today).toLocaleDateString()}"]`)).not.toBeNull(),
      SLOW,
    )
    await clickDay(addDays(today, 3))
    await clickDay(addDays(today, 4))
    expect(await screen.findByTestId('stay-picker-errors')).toBeInTheDocument()
    expect(screen.getByTestId('stay-picker-submit')).toBeDisabled()
  })
})

describe('demo mode: site_day_pass (pass)', () => {
  async function openPass() {
    start('site_day_pass')
    render(<App />)
    fireEvent.click(await screen.findByText('Flying-site pass'))
    fireEvent.click(await screen.findByTestId('product-detail-book-cta'))
    return screen.findByTestId('pass-tier-list', undefined, SLOW)
  }

  it('lists the real tiers, prices the pick and ends on the congrats screen', async () => {
    const list = await openPass()
    const tiers = within(list).getAllByTestId('pass-tier')
    expect(tiers.map((t) => t.textContent)).toEqual([
      expect.stringContaining('Day'), expect.stringContaining('Week'), expect.stringContaining('Season'),
    ])
    expect(within(tiers[0]!).getByTestId('pass-tier-price')).toHaveTextContent(/12/)
    fireEvent.click(within(tiers[1]!).getByRole('radio'))
    expect(screen.getByTestId('pass-total')).toHaveTextContent(/55/)
    expect(screen.getByTestId('pass-valid-range')).toBeInTheDocument()
    fireEvent.click(within(tiers[2]!).getByRole('radio'))
    expect(screen.getByTestId('pass-season-note')).toBeInTheDocument()

    const fill = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fill(/first name/i, 'Bea')
    fill(/last name/i, 'Buyer')
    fill(/^e-?mail/i, 'bea@example.com')
    fill(/phone/i, '+4915100000')
    fill(/street/i, 'Hauptstr. 1')
    fill(/postal/i, '10115')
    fill(/city/i, 'Berlin')
    fireEvent.change(screen.getByLabelText(/country/i), { target: { value: 'DE' } })
    const buy = screen.getByTestId('pass-submit')
    await waitFor(() => expect(buy).toBeEnabled())
    fireEvent.click(buy)
    expect(await screen.findByTestId('demo-congrats')).toBeInTheDocument()
    expectOnlyTemplateReads('site_day_pass')
  })

  it('shows the member prices after any member code, without sending a mail', async () => {
    await openPass()
    fireEvent.change(screen.getByLabelText(/^e-?mail/i), { target: { value: 'bea@example.com' } })
    fireEvent.click(screen.getByTestId('pass-member-toggle'))
    fireEvent.click(await screen.findByTestId('pass-member-send'))
    await screen.findByTestId('pass-member-apply')
    fireEvent.change(document.getElementById('pass-member-code')!, { target: { value: '123456' } })
    fireEvent.click(screen.getByTestId('pass-member-apply'))
    expect(await screen.findByTestId('pass-member-applied')).toBeInTheDocument()
    expect(within(screen.getAllByTestId('pass-tier')[0]!).getByTestId('pass-tier-price')).toHaveTextContent(/9/)
    expect(screen.queryByTestId('pass-member-error')).toBeNull()
    expectOnlyTemplateReads('site_day_pass')
  })
})

describe('demo mode: testival (verified registration)', () => {
  it('asks for documents and the waiver, then ends on the congrats screen without uploading', async () => {
    start('testival')
    render(<App />)
    fireEvent.click(await screen.findByText('Testival day registration'))
    fireEvent.click(await screen.findByTestId('product-detail-book-cta'))
    await waitFor(() => {
      const enabled = screen.getAllByRole('gridcell').map((c) => c.querySelector('button')).filter((b): b is HTMLButtonElement => !!b && !b.disabled)
      expect(enabled.length).toBeGreaterThan(0)
    }, SLOW)
    fireEvent.click(
      screen.getAllByRole('gridcell').map((c) => c.querySelector('button')).filter((b): b is HTMLButtonElement => !!b && !b.disabled)[0]!,
    )
    fireEvent.click(await screen.findByRole('button', { name: /continue/i }))
    await screen.findByText(/your contact details/i, undefined, SLOW)
    fillBooker()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    const submit = await screen.findByTestId('language-step-submit').catch(() => null)
    if (submit) {
      if ((submit as HTMLButtonElement).disabled) fireEvent.click(screen.getByTestId('lang-add-en'))
      await waitFor(() => expect(screen.getByTestId('language-step-submit')).toBeEnabled())
      fireEvent.click(screen.getByTestId('language-step-submit'))
    }
    // The review step carries the documents + waiver, and Confirm waits for them.
    expect(await screen.findByTestId('verification-fields', undefined, SLOW)).toBeInTheDocument()
    expect(screen.getByTestId('verification-waiver-text')).toHaveTextContent('I fly at my own risk')
    const confirm = screen.getByRole('button', { name: /confirm booking/i })
    expect(confirm).toBeDisabled()

    const pdf = (name: string) => new File([new Uint8Array(10)], name, { type: 'application/pdf' })
    fireEvent.change(screen.getByTestId('verification-licence'), { target: { files: [pdf('licence.pdf')] } })
    fireEvent.change(screen.getByTestId('verification-insurance'), { target: { files: [pdf('insurance.pdf')] } })
    fireEvent.change(screen.getByTestId('verification-signature'), { target: { value: 'Ada Lovelace' } })
    fireEvent.click(screen.getByTestId('verification-accept'))
    await waitFor(() => expect(confirm).toBeEnabled())
    fireEvent.click(confirm)
    expect(await screen.findByTestId('demo-congrats')).toBeInTheDocument()
    expectOnlyTemplateReads('testival')
  })
})
