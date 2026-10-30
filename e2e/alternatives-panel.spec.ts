import { expect, test, type Page } from '@playwright/test'
import { mockOperatorSettings, mockProductGroups, mockProducts } from '../src/api/mocks'

/**
 * "Also available" panel of the date step, end to end: it appears on a picked
 * day where a linked product is open, stays away when none is, and tapping a
 * row switches the product while keeping the date.
 *
 * Hermetic: every /api/public call is fulfilled in-spec (demo data only), so
 * no dev stack is needed. Runs on the local vite server in the mobile projects.
 */

const TOKEN = 'e2e-alt-token'
const DAY_MS = 86_400_000
const iso = (d: Date) => d.toISOString().slice(0, 10)

const ID_A = '00000000-0000-0000-0000-0000000000a1'
const ID_B = '00000000-0000-0000-0000-0000000000b2'

const base = mockProducts()[0]
const productA = {
  ...base,
  product_id: ID_A,
  slug: 'e2e-alt-a',
  name: 'Demo Flight A',
  name_localized: null,
  service_time_shape: 'single_date' as const,
  is_contiguous: false,
  duration_minutes: null,
}
const productB = {
  ...productA,
  product_id: ID_B,
  slug: 'e2e-alt-b',
  name: 'Demo Flight B',
}

/** Open days (from tomorrow) for product `id`; every day is open. */
function openDays(from: number, to: number) {
  const slots = []
  // Whole UTC days only: a time-of-day on `start` would push it past a
  // midnight-aligned `to` and drop the day, which flaked right after 00:00 UTC.
  const tomorrow = Date.parse(iso(new Date(Date.now() + DAY_MS)))
  const start = Math.max(from, tomorrow)
  for (let t = start; t <= to; t += DAY_MS) {
    slots.push({
      availability_id: `a-${t}`,
      date: iso(new Date(t)),
      start_time: '09:00',
      end_time: '17:00',
      capacity: 6,
      capacity_reserved: 0,
      available_seats: 6,
      status: 'open',
    })
  }
  return slots
}

async function mockApi(page: Page, opts: { alternativeOpenOn: (day: string) => boolean }) {
  const settings = { ...mockOperatorSettings('e2e'), widget_catalog_layout: 'expanded' }
  await page.route('**/api/public/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const json = (body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(body),
      })
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': '*',
        },
      })
    }
    if (path.endsWith('/product-groups')) return json(mockProductGroups(TOKEN))
    if (path.endsWith('/products')) return json([productA, productB])
    if (path.endsWith('/settings')) return json(settings)
    if (path.endsWith('/alternatives')) {
      const from = Date.parse(url.searchParams.get('from') ?? '')
      const to = Date.parse(url.searchParams.get('to') ?? '')
      const dates = openDays(from, to)
        .map((s) => s.date)
        .filter(opts.alternativeOpenOn)
      return json([
        {
          product_id: ID_B,
          slug: productB.slug,
          name: productB.name,
          service_time_shape: 'single_date',
          price_from: '89.00',
          currency: 'EUR',
          available_dates: dates,
          windows: null,
        },
      ])
    }
    if (path.endsWith('/availability')) {
      const from = Date.parse(url.searchParams.get('from') ?? '')
      const to = Date.parse(url.searchParams.get('to') ?? '')
      return json(openDays(from, to))
    }
    return json([])
  })
}

/** Pick the first enabled day button of the visible month. */
async function pickFirstDay(page: Page) {
  const day = page.locator('[data-slot="calendar"] td button:not([disabled])').first()
  await expect(day).toBeVisible()
  await day.click()
}

test('panel lists the linked product on a day where it is open', async ({ page }) => {
  await mockApi(page, { alternativeOpenOn: () => true })
  await page.goto(`/?w=${TOKEN}&product=e2e-alt-a&start=dates`)
  await pickFirstDay(page)

  const panel = page.getByTestId('alternatives-panel-mobile')
  await expect(panel).toBeVisible()
  await expect(panel.getByTestId(`alternative-row-${ID_B}`)).toContainText('Demo Flight B')
})

test('panel stays away when no linked product is open on the day', async ({ page }) => {
  await mockApi(page, { alternativeOpenOn: () => false })
  await page.goto(`/?w=${TOKEN}&product=e2e-alt-a&start=dates`)
  await pickFirstDay(page)

  await expect(page.getByTestId('single-date-selected')).toBeVisible()
  await expect(page.getByTestId('alternatives-panel-mobile')).toHaveCount(0)
  await expect(page.getByTestId('alternatives-panel-desktop')).toHaveCount(0)
})

test('tapping a row switches the product and keeps the picked date', async ({ page }) => {
  await mockApi(page, { alternativeOpenOn: () => true })
  await page.goto(`/?w=${TOKEN}&product=e2e-alt-a&start=dates`)
  await pickFirstDay(page)

  const picked = (await page.getByTestId('single-date-selected').innerText()).match(
    /\d{4}-\d{2}-\d{2}/,
  )?.[0]
  expect(picked).toBeTruthy()

  await page.getByTestId('alternatives-panel-mobile').getByTestId(`alternative-row-${ID_B}`).click()

  // Now on product B's date step with the same day preselected.
  await expect(page.getByTestId('single-date-selected')).toContainText(picked as string)
  await expect(page.getByText('Demo Flight B').first()).toBeVisible()
})
