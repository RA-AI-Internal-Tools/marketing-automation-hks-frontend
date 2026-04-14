/**
 * Smoke flow — login → dashboard → create campaign → analytics.
 *
 * This suite runs against a *deployed* MA instance. Point E2E_BASE_URL
 * at the target and provide E2E_EMAIL / E2E_PASSWORD. When credentials
 * are missing the suite skips itself rather than failing, because CI
 * wires secrets in only on the dedicated e2e job.
 */
import { test, expect } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD

test.describe('MA frontend smoke', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'E2E_EMAIL / E2E_PASSWORD not set — running in smoke-opt-out mode')
    await page.goto('/login')
  })

  test('login → dashboard → new campaign → analytics executive', async ({ page }) => {
    // Login
    await page.getByLabel(/email/i).fill(EMAIL!)
    await page.getByLabel(/password/i).fill(PASSWORD!)
    await page.getByRole('button', { name: /sign in|log in/i }).click()

    // Dashboard loaded (Overview page)
    await expect(page).toHaveURL(/\/(overview|dashboard)?/)
    await expect(page.locator('body')).toBeVisible()

    // Navigate to Campaigns
    await page.getByRole('link', { name: /campaigns/i }).first().click()
    await expect(page).toHaveURL(/\/campaigns/)

    // New campaign
    await page.getByRole('link', { name: /new campaign|create campaign/i }).first().click()

    const name = `smoke-${Date.now()}`
    await page.getByLabel(/name/i).first().fill(name)

    // Pick any template if the field is present; otherwise continue.
    const templateField = page.getByLabel(/template key/i).first()
    if (await templateField.isVisible().catch(() => false)) {
      await templateField.fill('welcome')
    }

    await page.getByRole('button', { name: /save|create/i }).first().click()

    // Back to campaigns list
    await expect(page).toHaveURL(/\/campaigns/)
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 })

    // Analytics → Executive
    await page.goto('/analytics/executive')
    await expect(page.locator('body')).toBeVisible()
    // No thrown runtime errors should leave a blank page — look for any
    // indicative KPI copy that the page renders unconditionally.
    await expect(page.getByText(/executive|overview|revenue|kpi/i).first()).toBeVisible({ timeout: 10_000 })
  })
})
