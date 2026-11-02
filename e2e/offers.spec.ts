import { expect, test, type Page, type Request } from '@playwright/test'
import {
  MOCK_OFFER_IDS,
  MOCK_OFFER_PRODUCTS,
  mockEstimate,
  mockEvaluateOffers,
  mockOfferStay,
  mockOperatorSettings,
  mockSubmit,
} from '../src/api/mocks'
import type { EstimateRequestBody, OfferEvaluateRequest } from '../src/api/types'

/**
 * Offer lines on the review step, end to end: the demo courtyard apartment
 * for 2 adults + a child of 8 over 4 nights shows the tourist tax (mandatory,
 * paid on arrival, attached by the server), air conditioning on picked
 * nights, a free cot for a guest, bed linen and a garage per booking, and
 * Wi-Fi as included. The submit carries offer lines with their ids, the
 * guests' refs, and never a price, collection or mode.
 *
 * Hermetic: every /api/public call is fulfilled in-spec from the mock
 * fixtures, and the funnel is restored straight onto the review step from a
 * stored draft (the same restore a reload uses).
 */

const TOKEN = 'e2e-offers-token'
const DAY_MS = 86_400_000
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const START = Date.parse(iso(Date.now() + 40 * DAY_MS))
const NIGHTS = [0, 1, 2, 3].map((i) => iso(START + i * DAY_MS))

const billing = {
  address_line1: 'Via Roma 1',
  address_line2: '',
  postal_code: '00100',
  city: 'Roma',
  region: '',
  country: 'IT',
  company: '',
  tax_id: '',
  name: '',
}
const guest = (id: string, first: string, extra: Record<string, unknown> = {}) => ({
  id,
  first_name: first,
  last_name: 'Demo',
  email: `${first.toLowerCase()}@example.com`,
  phone: '',
  service_role_code: 'participant',
  ...extra,
})

/** The review step of the demo apartment, as a reload would restore it. */
const progress = {
  step: {
    name: 'fill-form',
    product: mockOfferStay,
    selection: { kind: 'days', selectedDays: NIGHTS },
    booker: { id: 'booker', first_name: 'Ada', last_name: 'Demo', email: 'ada@example.com', phone: '', billing },
    participants: [
      guest('booker', 'Ada'),
      guest('m-bo', 'Bo'),
      guest('m-kid', 'Kid', { occupant_age_band: 'child', occupant_age: 8 }),
    ],
    companions: [],
    pickupLocationId: null,
    accommodationRooms: [],
    addons: [],
  },
  bookingDraft: {},
}

interface Seen {
  evaluate: OfferEvaluateRequest[]
  estimate: EstimateRequestBody[]
  submit: Record<string, unknown>[]
}

async function mockApi(
  page: Page,
  opts: {
    evaluate?: (body: OfferEvaluateRequest, n: number) => Promise<{ status: number; body: unknown }>
  } = {},
): Promise<Seen> {
  const seen: Seen = { evaluate: [], estimate: [], submit: [] }
  await page.addInitScript(
    ([key, value]) => window.sessionStorage.setItem(key, value),
    ['landr-widget-progress.v2', JSON.stringify(progress)] as const,
  )
  await page.route('**/api/public/**', async (route) => {
    const req: Request = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(body),
      })
    if (req.method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': '*',
        },
      })
    }
    if (path.endsWith('/offers/evaluate')) {
      const body = req.postDataJSON() as OfferEvaluateRequest
      seen.evaluate.push(body)
      if (opts.evaluate) {
        const r = await opts.evaluate(body, seen.evaluate.length)
        return json(r.body, r.status)
      }
      return json(mockEvaluateOffers(body))
    }
    if (path.endsWith('/estimate')) {
      const body = req.postDataJSON() as EstimateRequestBody
      seen.estimate.push(body)
      const productId = decodeURIComponent(path.split('/products/')[1]!.split('/')[0]!)
      return json(mockEstimate(productId, body))
    }
    if (path.endsWith('/bookings') && req.method() === 'POST') {
      seen.submit.push(req.postDataJSON() as Record<string, unknown>)
      return json(mockSubmit(), 201)
    }
    if (path.endsWith('/settings')) return json(mockOperatorSettings('e2e'))
    if (path.endsWith('/products')) return json([mockOfferStay])
    if (path.endsWith('/flow')) return json({ modules: null })
    if (path.endsWith('/availability')) {
      return json(
        NIGHTS.map((d, i) => ({
          availability_id: `a-${i}`,
          date: d,
          start_time: null,
          end_time: null,
          capacity: 10,
          capacity_reserved: 0,
          available_seats: 10,
          status: 'open',
        })),
      )
    }
    return json([])
  })
  return seen
}

const row = (page: Page, id: string) => page.getByTestId(`offer-row-${id}`)

test('the demo apartment shows its offers and submits offer lines', async ({ page }) => {
  const seen = await mockApi(page)
  await page.goto(`/?w=${TOKEN}`)

  await expect(row(page, MOCK_OFFER_IDS.touristTax)).toContainText('€20.00 · Pay on arrival')
  await expect(row(page, MOCK_OFFER_IDS.touristTax).getByTestId('offer-mandatory-badge')).toBeVisible()
  await expect(row(page, MOCK_OFFER_IDS.touristTax).getByRole('checkbox')).toHaveCount(0)
  await expect(row(page, MOCK_OFFER_IDS.airCon)).toContainText('€40.00')
  await expect(row(page, MOCK_OFFER_IDS.cot)).toContainText('Free')
  await expect(row(page, MOCK_OFFER_IDS.bedding)).toContainText('€35.00')
  await expect(row(page, MOCK_OFFER_IDS.garage)).toContainText('€40.00')
  await expect(page.getByTestId(`offer-included-${MOCK_OFFER_IDS.wifi}`)).toContainText('Wi-Fi')

  // The party went to the evaluator by ref; the child's age with it.
  const first = seen.evaluate[0]!
  expect(first.guests.map((g) => g.id)).toEqual(['g1', 'g2', 'g3'])
  expect(first.guests[2]!.attributes.age).toBe(8)
  expect(first.guests[0]!.attributes.age).toBeUndefined()
  expect(first.guests[1]!.attributes.age).toBeUndefined()

  // Air conditioning on three of the four nights; a cot for the child.
  await page.getByTestId(`offer-toggle-${MOCK_OFFER_IDS.airCon}`).check()
  await page.getByTestId(`offer-day-${MOCK_OFFER_IDS.airCon}-${NIGHTS[1]}`).click()
  await page.getByTestId(`offer-who-${MOCK_OFFER_IDS.cot}-g3`).check()
  await expect
    .poll(() =>
      seen.estimate.some((b) =>
        b.addon_lines.some((l) => l.offer_id === MOCK_OFFER_IDS.airCon && l.selected_days?.length === 3),
      ),
    )
    .toBe(true)

  // The tourist tax is paid on arrival, outside the amount due now.
  const toggle = page.getByTestId('price-sidebar-mobile-toggle')
  if (await toggle.isVisible()) await toggle.click()
  const onSite = page.getByTestId('price-sidebar-on-site').first()
  await expect(onSite).toContainText('Tourist tax')
  await expect(onSite).toContainText('€20.00')

  await page.getByRole('button', { name: /Confirm booking/i }).click()
  await expect.poll(() => seen.submit.length).toBe(1)
  const body = seen.submit[0]! as {
    participants: { ref?: string }[]
    products: Record<string, unknown>[]
  }
  expect(body.participants.map((p) => p.ref)).toEqual(['g1', 'g2', 'g3'])
  const lines = body.products
  const ac = lines.find((l) => l.offer_id === MOCK_OFFER_IDS.airCon)!
  const cot = lines.find((l) => l.offer_id === MOCK_OFFER_IDS.cot)!
  expect(ac).toMatchObject({ parent_line_id: 'main', selected_days: [NIGHTS[0], NIGHTS[2], NIGHTS[3]] })
  expect(typeof ac.line_id).toBe('string')
  expect(cot).toMatchObject({ parent_line_id: 'main', participant_id: 'g3', quantity: 1 })
  expect(lines.some((l) => l.offer_id === MOCK_OFFER_IDS.touristTax)).toBe(false)
  for (const l of lines) {
    for (const k of ['price', 'collection', 'mode', 'schedule', 'binding']) expect(l).not.toHaveProperty(k)
  }
})

test('an ineligible main product stays visible, says why, and cannot be confirmed', async ({ page }) => {
  await mockApi(page, {
    evaluate: async (body) => {
      const res = mockEvaluateOffers(body)
      res.lines[0] = {
        ...res.lines[0]!,
        eligible: false,
        eligibility_reason_key: 'guest_attr_all.age',
        eligibility_reason_params: { op: 'gte', value: 10 },
      }
      return { status: 200, body: res }
    },
  })
  await page.goto(`/?w=${TOKEN}`)
  await expect(page.getByTestId('main-ineligible')).toContainText('No guests under 10')
  await expect(page.getByRole('button', { name: /Confirm booking/i })).toBeDisabled()
})

test('a slow re-check keeps the rows, and a failed one lets the guest confirm', async ({ page }) => {
  let release: () => void = () => {}
  const held = new Promise<void>((r) => {
    release = r
  })
  await mockApi(page, {
    // Once the garage is in the cart the evaluator is slow, then rate-limited.
    evaluate: async (body) => {
      if (!body.lines.some((l) => l.product_id === MOCK_OFFER_PRODUCTS.garage)) {
        return { status: 200, body: mockEvaluateOffers(body) }
      }
      await held
      return { status: 429, body: { detail: 'rate_limited' } }
    },
  })
  await page.goto(`/?w=${TOKEN}`)
  const bedding = row(page, MOCK_OFFER_IDS.bedding)
  await expect(bedding).toBeVisible()
  const handle = await bedding.elementHandle()

  // A pick that changes the cart tree re-asks the evaluator.
  await page.getByTestId(`offer-toggle-${MOCK_OFFER_IDS.garage}`).check()
  await expect(page.getByTestId('offer-tree-main')).toHaveAttribute('aria-busy', 'true')
  expect(await handle!.evaluate((el) => el.isConnected)).toBe(true)

  release()
  await expect(page.getByTestId('offer-check-failed')).toBeVisible()
  await expect(page.getByRole('button', { name: /Confirm booking/i })).toBeEnabled()
})
