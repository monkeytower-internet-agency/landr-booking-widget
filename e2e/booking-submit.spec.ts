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
 * Product: "E2E Smoke Test Fixture" (e2e-widget-fixture) — landr-ebba.
 * Targeting a real para42 catalog product broke this spec once already:
 * landr-m2h2's catalog reshape soft-deleted the original target
 * (equipment-rental-day), and every widget PR went red until landr-l0mb
 * re-picked guided-day as a stand-in (2026-08-05, at the cost of an extra
 * Accommodation step guided-day has and the original didn't). This
 * fixture product is seeded by landr-api
 * (supabase/migrations/20260809162539_para42_widget_e2e_fixture_product.sql
 * + a dev-only activation block in supabase/seed.sql) specifically so this
 * spec never again depends on which real products happen to survive a
 * catalog reshape. Shape mirrors the original target exactly: service /
 * single_date / needs_pickup=true / hotel_offering='none' (no
 * accommodation step) / one flat per-day pricing rule, reusing para42's
 * 'customer_declarations' form for the custom-form step. If this product
 * is ever missing, the fix is re-running that migration + seed against dev
 * — do NOT re-point this spec at another real catalog product again.
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
  // landr-xi91: para42's dev seed (landr-4a5j, supabase/seed.sql) pins this
  // operator's widget_catalog_layout to 'expanded' so the first step lists
  // every product directly under its category header — no category tile to
  // drill through. ProductCard (and its product-card-<slug> testid) is
  // reused as-is by ExpandedCatalog, so only the entry step changes here.
  const expandedCatalog = page.getByTestId('expanded-catalog')
  await expect(expandedCatalog).toBeVisible()

  const productCard = page.getByTestId('product-card-e2e-widget-fixture')
  await expect(productCard).toBeVisible()
  await productCard.click()

  await page.getByTestId('product-detail-book-cta').click()

  // ---- Date (single_date step) ----------------------------------------------
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

  // ---- Pickup location (fixture has needs_pickup=true, no accommodation) --
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
  // landr-5oox.30: intercept the submit response so the confirmation-title
  // assertion below can match whichever copy the approval engine actually
  // produced, instead of hardcoding one outcome. Small bookings inside Bus 1
  // auto-approve (landr-5oox.10/D2) and render "Booking confirmed"; every
  // other approval_outcome (or an absent one, e.g. an older API deploy)
  // renders "Booking received" (landr-5oox.6/OD-7). Registering
  // waitForResponse() and the click together avoids a race where the POST
  // resolves before the listener is attached.
  const [submitResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('/api/public/bookings'),
    ),
    page.getByRole('button', { name: 'Confirm booking' }).click(),
  ])
  const submitBody = (await submitResponse.json().catch(() => null)) as {
    approval_outcome?: string
  } | null
  const expectedTitle = submitBody?.approval_outcome === 'auto_approved' ? 'Booking confirmed' : 'Booking received'

  // ---- Confirmation ----------------------------------------------------------
  // Matched by text (not the confirmation-title testid added in
  // Confirmation.tsx alongside this fix) so this assertion passes against
  // the currently-deployed bw-dev build too, not only after this PR's own
  // change reaches the live site — Cloudflare Pages redeploys bw-dev from
  // `dev` post-merge, so a testid this PR just added wouldn't exist yet on
  // the very run that checks this PR.
  await expect(page.getByText(expectedTitle, { exact: true })).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByText(/Reference/)).toBeVisible()
})
