import { expect, test, type Page } from '@playwright/test'
import {
  mockOperatorSettings,
  mockProductGroups,
  mockProducts,
} from '../src/api/mocks'

/**
 * landr-xxh5r — layout guard for the date calendar on WebKit (iOS Safari).
 *
 * Bug: react-day-picker rows are `display:flex` table-rows whose day cells
 * used `aspect-square h-full`; WebKit collapsed the row height while the
 * 44px buttons still painted, so the weeks overflowed their box and the
 * next-month peek strip / notes were painted on top of the grid. Blink
 * lays this out correctly, which is why this must run on a WebKit project.
 *
 * Hermetic: every /api/public call is fulfilled from src/api/mocks (no dev
 * stack needed). Runs in the `webkit-mobile` and `chromium-mobile` projects
 * against a local vite server (see playwright.config.ts).
 */

const TOKEN = 'e2e-layout-token'
const DAY_MS = 86_400_000
const iso = (d: Date) => d.toISOString().slice(0, 10)

async function mockApi(page: Page) {
  const product = {
    ...mockProducts()[0],
    slug: 'e2e-multiday',
    service_time_shape: 'days_range' as const,
    is_contiguous: false,
    duration_minutes: null,
  }
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
    if (path.endsWith('/products')) return json([product])
    if (path.endsWith('/settings')) return json(settings)
    if (path.endsWith('/availability')) {
      // Open days from the 1st of NEXT month for ~70 days, clipped to the
      // requested window: the calendar opens there (as in the bug report)
      // and the "Nothing is available before …" note renders.
      const from = Date.parse(url.searchParams.get('from') ?? '')
      const to = Date.parse(url.searchParams.get('to') ?? '')
      const now = new Date()
      const first = Date.UTC(now.getFullYear(), now.getMonth() + 1, 1)
      const last = first + 70 * DAY_MS
      const slots = []
      for (let t = Math.max(from, first); t <= Math.min(to, last); t += DAY_MS) {
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
      return json(slots)
    }
    return json([])
  })
}

test('date calendar rows do not overlap the peek strip or the notes below', async ({
  page,
}) => {
  await mockApi(page)
  await page.goto(`/?w=${TOKEN}&product=e2e-multiday&start=dates`)

  const grid = page.locator('[data-slot="calendar"] table').first()
  await expect(grid).toBeVisible()
  await expect(page.getByTestId('calendar-peek')).toBeVisible()
  const note = page.getByTestId('calendar-nothing-before')
  await expect(note).toBeVisible()

  const box = async (l: ReturnType<Page['locator']>) => {
    const b = await l.boundingBox()
    if (!b) throw new Error('element has no bounding box')
    return b
  }
  const g = await box(grid)
  const peek = await box(page.getByTestId('calendar-peek'))
  const n = await box(note)

  // The painted day buttons, not just the table box, must stay inside the
  // grid: the WebKit bug let the 44px buttons overflow a collapsed row.
  const buttons = grid.locator('button')
  const count = await buttons.count()
  expect(count).toBeGreaterThan(27)
  let lowestButton = 0
  for (let i = 0; i < count; i++) {
    const b = await box(buttons.nth(i))
    lowestButton = Math.max(lowestButton, b.y + b.height)
  }

  const slack = 1 // sub-pixel rounding
  expect(lowestButton, 'day buttons overflow the calendar grid').toBeLessThanOrEqual(
    g.y + g.height + slack,
  )
  expect(g.y + g.height, 'grid bottom vs peek strip top').toBeLessThanOrEqual(peek.y + slack)
  expect(peek.y + peek.height, 'peek strip bottom vs note top').toBeLessThanOrEqual(n.y + slack)

  // Rows keep the touch-target height (landr-3mo4: 44px mobile).
  if (process.env.E2E_SHOT) await page.screenshot({ path: process.env.E2E_SHOT })
  const first = await box(buttons.first())
  expect(first.height).toBeGreaterThanOrEqual(43)
})
