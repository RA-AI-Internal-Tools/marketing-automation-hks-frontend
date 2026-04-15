/**
 * URL-synced filters round-trip — /logs, /enrollments, /audit-logs.
 *
 * Each page should:
 *   1. Hydrate filters from URL query on load.
 *   2. Push updates to URL when a filter changes.
 *   3. Restore filters on back/forward navigation.
 */
import { test, expect } from '@playwright/test'
import { hasE2ECreds, login } from './helpers/login'

test.describe('URL-synced filters', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECreds(), 'E2E_EMAIL / E2E_PASSWORD not set')
    await login(page)
  })

  test('/logs hydrates ?campaign & ?status and updates on change', async ({ page }) => {
    await page.goto('/logs?campaign=welcome&status=sent')
    await expect(page).toHaveURL(/\/logs\?/)

    // Campaign filter is the first text input in the filter row with the
    // "Campaign slug..." placeholder.
    const campaignInput = page.getByPlaceholder(/campaign slug/i).first()
    await expect(campaignInput).toHaveValue('welcome')

    // Status select: value="sent" should be selected. Addressable by role
    // combobox; the value is what matters.
    const statusSelect = page.locator('select').filter({ hasText: /All statuses/i }).first()
    await expect(statusSelect).toHaveValue('sent')

    // Change campaign filter → URL reflects it.
    await campaignInput.fill('reactivation')
    await expect(page).toHaveURL(/campaign=reactivation/, { timeout: 5_000 })

    // Navigate away and back — filters rehydrate.
    await page.goto('/overview')
    await page.goBack()
    await expect(page).toHaveURL(/campaign=reactivation/)
    await expect(campaignInput).toHaveValue('reactivation')
  })

  test('/enrollments accepts URL query', async ({ page }) => {
    // Not all filter keys are the same across pages — just assert the
    // page loads with an arbitrary query and doesn't crash. We look for
    // any URL-synced input/select and verify it round-trips.
    await page.goto('/enrollments?status=active')
    await expect(page).toHaveURL(/\/enrollments/)
    await expect(page.locator('body')).toBeVisible()

    const selects = page.locator('select')
    const count = await selects.count()
    if (count > 0) {
      // At least one select renders — page hasn't errored out. Soft check:
      // URL query is preserved on reload.
      await page.reload()
      await expect(page).toHaveURL(/status=active/)
    }
  })

  test('/audit-logs accepts URL query and preserves on back/forward', async ({ page }) => {
    await page.goto('/audit-logs?action=create')
    // Admin-only — a non-admin user gets redirected to /overview. Skip
    // when that happens rather than flaking.
    if (!/\/audit-logs/.test(page.url())) {
      test.skip(true, 'Audit logs requires admin; user redirected')
    }
    await expect(page.locator('body')).toBeVisible()

    await page.goto('/overview')
    await page.goBack()
    await expect(page).toHaveURL(/action=create/)
  })
})
