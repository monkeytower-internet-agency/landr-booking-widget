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
 * Product: "Paragliding Gear Rental" (equipment-rental-day) — chosen
 * because it's the shortest catalog->confirm path para42's seed offers
 * (single date, no accommodation/addons module). It still exercises a
 * pickup-location step and a custom-form declarations module because
 * that's what this operator's real seed data requires — this spec drives
 * whatever the actual seeded happy path is, it does not stub it out.
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

test('booking-submit happy path: catalog -> date -> participant -> confirm', async ({
  page,
}) => {
  await page.goto(`/?w=${WIDGET_TOKEN}`)

  // ---- Catalog -----------------------------------------------------------
  const categoryStep = page.getByTestId('category-step')
  await expect(categoryStep).toBeVisible()
  await page.getByText('Guiding', { exact: true }).click()

  const productCard = page.getByTestId('product-card-equipment-rental-day')
  await expect(productCard).toBeVisible()
  await productCard.click()

  await page.getByTestId('product-detail-book-cta').click()

  // ---- Date ----------------------------------------------------------------
  await expect(page.getByText('Pick a date')).toBeVisible()
  await pickFirstAvailableDate(page)
  await page.getByRole('button', { name: 'Continue' }).click()

  // ---- Participant (booker contact details) --------------------------------
  await expect(page.getByLabel('First name')).toBeVisible()
  await page.getByLabel('First name').fill('Playwright')
  await page.getByLabel('Last name').fill('Smoketest')
  await page.getByLabel('Email').fill('playwright-smoke@example.com')
  await page.getByLabel('Phone').fill('+491701234567')
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
