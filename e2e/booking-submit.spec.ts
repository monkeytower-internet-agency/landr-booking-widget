import { expect, test, type Page } from '@playwright/test'

/**
 * landr-t0do — Flow 1: booking-submit happy path against the DEV stack.
 *
 * Deliberately ONE test, ONE product, ONE path: catalog -> date ->
 * participant -> confirm, using the para42 operator's seed data (widget
 * token pinned dev-side by supabase/seed.sql — landr-9412). This is a
 * *durable regression net*, not a feature suite: resist adding more
 * products/branches/assertions here. If the flow reveals an app bug,
 * file it instead of growing this spec to work around it.
 *
 * NOTE: this is a real write against the shared dev DB — every green run
 * creates one real `bookings` row for para42 (status: pending). The
 * booker email is tagged `playwright-smoke@example.com` so it's easy to
 * spot/sweep in the dev DB; no existing rows are touched or deleted.
 *
 * Product: "Guided Paragliding Day" (guided-day) — landr-l0mb: the
 * original target (equipment-rental-day, single_date+needs_pickup+
 * no-accommodation) was soft-deleted by landr-m2h2's para42 catalog
 * reshape and no equivalent-shape product survives. Re-picked 2026-08-05
 * by querying `products` on the live dev DB for every active,
 * non-deleted para42 product: guided-day is the ONLY remaining
 * needs_pickup=true product, so it's the closest surviving equivalent —
 * at the cost of one extra step this spec didn't used to cover
 * (Accommodation, since guided-day.hotel_offering='optional'; we pick
 * the "Guiding only" mode to skip past it, same as the original's
 * no-accommodation shape). It's `days_range` (multi-day picker) rather
 * than `single_date`, but selecting exactly one day still exercises the
 * same catalog -> date -> participant -> pickup-location ->
 * custom-form-declarations -> confirm path the original covered.
 * Re-pick criteria if this breaks again: `select slug, name,
 * product_kind, service_time_shape, active, needs_pickup, hotel_offering
 * from products where deleted_at is null and active;` — want
 * needs_pickup=true and the smallest hotel_offering/date-shape footprint
 * available; update this comment with the new reasoning.
 */

const WIDGET_TOKEN = process.env.WIDGET_TOKEN ?? 'para42StableDevToken42'

async function pickFirstAvailableDate(page: Page) {
  // react-day-picker renders one month per view; the widget shows a 60-day
  // window so most "N days from now" targets land in the visible month,
  // but we don't hardcode a day-of-month — just take the first enabled,
  // non-"Today" day cell so the test survives any day of the year.
  //
  // Every day cell mounts immediately but starts disabled until the
  // getAvailability() fetch resolves (a real network round-trip — slower
  // and more variable from a CI runner hitting the dev API over the public
  // internet than from a warm local connection). Poll instead of a single
  // synchronous count(): checking too early reads "0 enabled" as "hop to
  // next month", which walks straight past the 60-day fetch window into
  // months with no data at all and fails for the wrong reason.
  for (let hop = 0; hop < 3; hop++) {
    const candidate = page.locator('table button:not([disabled])')
    await expect
      .poll(() => candidate.count(), {
        timeout: 15_000,
        message: 'waiting for the availability fetch to enable at least one day cell',
      })
      .toBeGreaterThan(0)
    const count = await candidate.count()
    for (let i = 0; i < count; i++) {
      const el = candidate.nth(i)
      const label = (await el.getAttribute('aria-label')) ?? ''
      if (label && !label.startsWith('Today')) {
        await el.click()
        return
      }
    }
    // Every enabled cell so far was "Today" — page forward and retry.
    await page.getByRole('button', { name: /next/i }).click()
  }
  throw new Error('No available booking date found within 3 months')
}

test('booking-submit happy path: catalog -> date -> participant -> accommodation -> confirm', async ({
  page,
}) => {
  await page.goto(`/?w=${WIDGET_TOKEN}`)

  // ---- Catalog -----------------------------------------------------------
  // landr-xi91: para42's dev seed (landr-4a5j, supabase/seed.sql) pins this
  // operator's widget_catalog_layout to 'expanded' so the first step lists
  // every product directly under its category header — no category tile to
  // drill through. ProductCard (and its product-card-<slug> testid) is
  // reused as-is by ExpandedCatalog, so only the entry step changes here.
  const expandedCatalog = page.getByTestId('expanded-catalog')
  await expect(expandedCatalog).toBeVisible()

  const productCard = page.getByTestId('product-card-guided-day')
  await expect(productCard).toBeVisible()
  await productCard.click()

  await page.getByTestId('product-detail-book-cta').click()

  // ---- Date (MultiDayStep — guided-day is service_time_shape=days_range) ---
  // Header differs from the single_date step's "Pick a date". We only ever
  // select ONE day: the picker's default "Date range" mode still commits a
  // single-day selection on the first click (no anchor yet), same as
  // "Individual days" mode would, so pickFirstAvailableDate's single click
  // is enough — no need to touch the mode toggle.
  await expect(page.getByText('Pick your dates')).toBeVisible()
  await pickFirstAvailableDate(page)
  await page.getByRole('button', { name: 'Continue' }).click()

  // ---- Participant (booker contact details) --------------------------------
  await expect(page.getByLabel('First name')).toBeVisible()
  await page.getByLabel('First name').fill('Playwright')
  await page.getByLabel('Last name').fill('Smoketest')
  await page.getByLabel('Email').fill('playwright-smoke@example.com')
  await page.getByLabel('Phone').fill('+491701234567')
  await page.getByRole('button', { name: 'Continue' }).click()

  // ---- Accommodation (guided-day.hotel_offering='optional') ----------------
  // landr-l0mb: the original target product had no accommodation module at
  // all; guided-day has one because it's the closest surviving needs_pickup
  // product. Pick "Guiding only" to opt out of a hotel stay — this keeps the
  // rest of the flow (pickup-location, then custom-form) identical to what
  // the original spec covered. The mode fieldset only renders once the
  // operator's hotel list has loaded, so wait for it before clicking.
  await expect(page.getByTestId('accommodation-mode-guiding-only')).toBeVisible()
  await page.getByTestId('accommodation-mode-guiding-only').click()
  await page.getByRole('button', { name: 'Continue' }).click()

  // ---- Pickup location (para42's seed data requires one for this product) -
  // Two "Pickup location" nodes render here (CardTitle + sr-only <legend>);
  // .first() avoids a strict-mode multi-match, we just want "did we land
  // on this step".
  await expect(page.getByText('Pickup location').first()).toBeVisible()
  // Any seeded location works — take the first radio option.
  await page.locator('input[type="radio"]').first().check()
  await page.getByRole('button', { name: 'Continue' }).click()

  // ---- Custom-form declarations (para42's operator-configured module) ------
  await expect(page.getByTestId('cf-submit')).toBeVisible()
  await page.getByTestId('cf-checkbox-license_valid-yes').click()
  await page.getByTestId('cf-checkbox-insurance_valid-yes').click()
  await page.getByTestId('cf-checkbox-autonomous_pilot-yes').click()
  await page.getByTestId('cf-checkbox-emergency_contact-yes').click()
  await page.getByTestId('cf-lang-check-en').click()
  await page.getByTestId('cf-submit').click()

  // ---- Review + confirm -----------------------------------------------------
  await expect(page.getByText('Review your booking', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm booking' }).click()

  // ---- Confirmation ----------------------------------------------------------
  await expect(page.getByText('Booking received', { exact: true })).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByText(/Reference/)).toBeVisible()
})
