/**
 * Segments — evaluate flow.
 *
 * Uses an existing segment where possible (the app ships built-in
 * segments like "vip" / "dormant"). If no segments exist on the
 * deployment, skips cleanly rather than creating one with unknown
 * rule-type plumbing.
 */
import { test, expect } from '@playwright/test'
import { hasE2ECreds, login } from './helpers/login'

test.describe('Segments', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECreds(), 'E2E_EMAIL / E2E_PASSWORD not set')
    await login(page)
  })

  test('evaluate surfaces a toast / inline result', async ({ page }) => {
    await page.goto('/segments')
    await expect(page).toHaveURL(/\/segments/)

    // Evaluate buttons render with title="Evaluate now".
    const evalBtn = page.getByRole('button', { name: /evaluate now/i }).first()
    const hasAny = await evalBtn.isVisible().catch(() => false)
    test.skip(!hasAny, 'No segments visible on deployment to evaluate')

    await evalBtn.click()

    // A toast (role=status/alert) or inline text should surface the
    // result. We accept any of: evaluation complete, evaluated N, failed.
    const feedback = page
      .getByRole('status')
      .or(page.getByRole('alert'))
      .or(page.getByText(/evaluated|evaluation complete|members|failed/i))
    await expect(feedback.first()).toBeVisible({ timeout: 15_000 })
  })
})
