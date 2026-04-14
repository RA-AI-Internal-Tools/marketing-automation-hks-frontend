/**
 * Auth flow coverage — valid login, invalid credentials, unauth redirect.
 *
 * Auto-skips when E2E_EMAIL / E2E_PASSWORD are absent (same pattern as
 * smoke.spec.ts) so CI jobs without secrets stay green.
 */
import { test, expect } from '@playwright/test'
import { E2E_EMAIL, E2E_PASSWORD, hasE2ECreds, login } from './helpers/login'

test.describe('MA frontend auth', () => {
  test('valid login lands on authenticated shell', async ({ page }) => {
    test.skip(!hasE2ECreds(), 'E2E_EMAIL / E2E_PASSWORD not set')

    await login(page)

    // Expect to land somewhere inside the authenticated app (overview/dashboard/home).
    await expect(page).toHaveURL(/\/(overview|dashboard|home)?/)

    // An element only present when authenticated — sidebar Logout/Sign out
    // control. Fall back to any nav link pattern that the app renders when
    // signed in.
    const authIndicator = page
      .getByRole('button', { name: /logout|sign out/i })
      .or(page.getByRole('link', { name: /logout|sign out/i }))
      .or(page.getByRole('link', { name: /campaigns/i }).first())
    await expect(authIndicator.first()).toBeVisible({ timeout: 15_000 })
  })

  test('invalid credentials surface an error and stay on /login', async ({ page }) => {
    test.skip(!hasE2ECreds(), 'E2E_EMAIL / E2E_PASSWORD not set')

    await page.goto('/login')
    await page.getByLabel(/email/i).fill(E2E_EMAIL!)
    await page.getByLabel(/password/i).fill(`${E2E_PASSWORD}-definitely-wrong`)
    await page.getByRole('button', { name: /sign in|log in/i }).click()

    // Stay on /login.
    await expect(page).toHaveURL(/\/login(\?|$|\/)/, { timeout: 10_000 })

    // An error message becomes visible — prefer role=alert, fall back to
    // text cues commonly used for login failures.
    const errorLocator = page
      .getByRole('alert')
      .or(page.getByText(/invalid|incorrect|failed|wrong|unauthori[sz]ed/i))
    await expect(errorLocator.first()).toBeVisible({ timeout: 10_000 })
  })

  test('unauthenticated visit to /overview redirects to /login', async ({ page }) => {
    // Skip when creds are absent — without E2E_EMAIL/E2E_PASSWORD the caller
    // hasn't configured E2E_BASE_URL for a real deployment either, so this
    // assertion has nothing to hit.
    test.skip(!hasE2ECreds(), 'E2E_EMAIL / E2E_PASSWORD not set')

    // This test simply asserts the router guard — clear any persisted auth.
    await page.context().clearCookies()
    await page.goto('/overview')

    await expect(page).toHaveURL(/\/login(\?|$|\/)/, { timeout: 10_000 })
  })
})
