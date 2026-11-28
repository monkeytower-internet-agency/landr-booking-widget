import { expect, test } from '@playwright/test'

/**
 * landr-3tpmm: `?group=a,b` limits the category entrance to those groups.
 * Needs a dev operator with >=3 product groups; token and slugs come from the
 * env (public repo), and the spec skips when they are absent.
 */
const TOKEN = process.env.GROUPLIST_WIDGET_TOKEN
const [A, B] = (process.env.GROUPLIST_SLUGS ?? '').split(',')

test.skip(!TOKEN || !A || !B, 'GROUPLIST_WIDGET_TOKEN / GROUPLIST_SLUGS not set')

test.beforeEach(async ({ page }) => {
  if (!process.env.GROUPLIST_CORS_PROXY) return
  await page.route('https://api.dev.landr.de/**', async (route) => {
    const res = await route.fetch()
    await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } })
  })
})

test('two groups: entrance shows only those, back returns to them', async ({ page }) => {
  await page.goto(`/?w=${TOKEN}&group=${A},${B},no-such-group`)
  const entrance = page.getByTestId('category-step')
  await expect(entrance).toBeVisible()
  await expect(entrance.getByRole('button')).toHaveCount(2)

  await entrance.getByRole('button').first().click()
  await page.getByTestId('back-to-categories').click()
  await expect(page.getByTestId('category-step').getByRole('button')).toHaveCount(2)
})
