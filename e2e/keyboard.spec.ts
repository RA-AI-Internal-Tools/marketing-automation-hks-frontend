/**
 * Keyboard shortcuts — `n`, `?`, and editable-target suppression.
 *
 * See src/composables/useKeyboardShortcuts.ts: handlers are ignored when
 * focus is inside INPUT/TEXTAREA/SELECT/contenteditable, and modifier
 * keys (meta/ctrl/alt) bypass shortcuts entirely.
 */
import { test, expect } from '@playwright/test'
import { hasE2ECreds, login } from './helpers/login'

test.describe('Keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECreds(), 'E2E_EMAIL / E2E_PASSWORD not set')
    await login(page)
  })

  test('`n` on /campaigns routes to /campaigns/new', async ({ page }) => {
    await page.goto('/campaigns')
    await expect(page).toHaveURL(/\/campaigns(\?|$|\/)/)

    // Ensure focus is on body (not a filter input from a prior keystroke).
    await page.locator('body').click({ position: { x: 0, y: 0 } }).catch(() => undefined)
    await page.keyboard.press('n')

    await expect(page).toHaveURL(/\/campaigns\/new/, { timeout: 5_000 })
  })

  test('`?` opens the shortcut cheat sheet; Escape dismisses', async ({ page }) => {
    await page.goto('/overview')

    // `?` is a shifted character — keyboard.press handles it.
    await page.keyboard.press('?')

    const dialog = page.getByRole('dialog', { name: /keyboard shortcuts/i })
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden({ timeout: 5_000 })
  })

  test('`n` inside a text field does NOT navigate', async ({ page }) => {
    await page.goto('/logs')
    await expect(page).toHaveURL(/\/logs/)

    // The logs page has a "Campaign slug..." text input. Focus it, type
    // 'n', and assert we remain on /logs and the input accepted the char.
    const campaignInput = page.getByPlaceholder(/campaign slug/i).first()
    await campaignInput.click()
    await campaignInput.fill('') // clear any URL-hydrated value first
    await page.keyboard.type('n')

    await expect(campaignInput).toHaveValue('n')
    await expect(page).toHaveURL(/\/logs/)
  })
})
