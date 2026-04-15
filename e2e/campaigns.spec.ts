/**
 * Campaigns — create → persist → cleanup.
 *
 * Auto-skips when E2E_EMAIL / E2E_PASSWORD are absent, matching the
 * pattern in smoke.spec.ts.
 */
import { test, expect } from '@playwright/test'
import { hasE2ECreds, login } from './helpers/login'

test.describe('Campaigns', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECreds(), 'E2E_EMAIL / E2E_PASSWORD not set')
    await login(page)
  })

  test('create campaign, verify persistence, cleanup via API', async ({ page, request }) => {
    const name = `e2e-campaign-${Date.now()}`
    const triggerEvent = 'e2e_test_event'

    await page.goto('/campaigns')
    await expect(page).toHaveURL(/\/campaigns/)

    // New campaign — the header button renders as a link routed to /campaigns/new.
    await page
      .getByRole('link', { name: /new campaign|create campaign/i })
      .first()
      .click()
    await expect(page).toHaveURL(/\/campaigns\/new/)

    // Fill form. Labels on the editor aren't linked with `for=` — rely on the
    // first Name input being the campaign name, and the Trigger Event input
    // being addressable by its placeholder.
    await page.getByRole('textbox').first().fill(name)
    await page.getByPlaceholder(/order_completed|e\.g\./i).first().fill(triggerEvent)

    // Add one step.
    await page.getByRole('button', { name: /add step/i }).click()

    // Save.
    await page
      .getByRole('button', { name: /^save$|create campaign|^save campaign$/i })
      .first()
      .click()

    // Back on list — name visible.
    await expect(page).toHaveURL(/\/campaigns(\?|$|\/)/, { timeout: 15_000 })
    const created = page.getByText(name, { exact: false }).first()
    await created.waitFor({ state: 'visible', timeout: 15_000 })

    // Navigate into detail/edit to verify persistence. Clicking the row's
    // name should route to /campaigns/:id/edit (the editor reads the id).
    await created.click()
    await expect(page).toHaveURL(/\/campaigns\/[^/]+\/(edit|builder)/, { timeout: 10_000 })

    // The name field should still hold our value.
    const nameField = page.getByRole('textbox').first()
    await expect(nameField).toHaveValue(name)

    // Cleanup — best-effort. Try to read the id from the URL and DELETE.
    const m = page.url().match(/\/campaigns\/([^/]+)\/(?:edit|builder)/)
    if (m && m[1]) {
      const id = m[1]
      // Cookie auth — `request` shares the page's storage state by default
      // through context. Fire-and-forget; a 404 or 405 is fine.
      await request.delete(`/api/campaigns/${id}`).catch(() => undefined)
    }
  })
})
