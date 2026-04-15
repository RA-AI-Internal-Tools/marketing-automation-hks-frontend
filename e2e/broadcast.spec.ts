/**
 * Broadcasts — create draft, verify in list, cleanup via API.
 */
import { test, expect } from '@playwright/test'
import { hasE2ECreds, login } from './helpers/login'

test.describe('Broadcasts', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECreds(), 'E2E_EMAIL / E2E_PASSWORD not set')
    await login(page)
  })

  test('create broadcast draft', async ({ page, request }) => {
    const name = `e2e-broadcast-${Date.now()}`

    await page.goto('/broadcasts')
    await expect(page).toHaveURL(/\/broadcasts/)

    // "New broadcast" opens a modal.
    await page.getByRole('button', { name: /new broadcast/i }).first().click()

    // Modal has dialog role (ModalWrapper). Name textbox is inside.
    const dialog = page.getByRole('dialog')
    await dialog.waitFor({ state: 'visible', timeout: 10_000 })

    // The Name field uses `<label><span>Name</span><input/></label>` — the
    // implicit label wrap gives the input an accessible name of "Name".
    await dialog.getByPlaceholder(/newsletter|name/i).first().fill(name).catch(async () => {
      await dialog.getByRole('textbox').first().fill(name)
    })

    // Template select — pick the first non-placeholder option, if any.
    const templateSelect = dialog.locator('select').nth(1)
    if (await templateSelect.isVisible().catch(() => false)) {
      const opts = await templateSelect.locator('option').all()
      for (const o of opts) {
        const val = await o.getAttribute('value')
        if (val && val !== '') {
          await templateSelect.selectOption(val)
          break
        }
      }
    }

    // Scheduled-at — future datetime-local.
    const future = new Date(Date.now() + 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16)
    const scheduled = dialog.locator('input[type="datetime-local"]').first()
    if (await scheduled.isVisible().catch(() => false)) {
      await scheduled.fill(future)
    }

    // Save. Button label is "Create draft" for a new broadcast.
    await dialog
      .getByRole('button', { name: /create draft|save|schedule/i })
      .first()
      .click()

    // Dialog closes and the name appears in the list.
    await dialog.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => undefined)
    await expect(page.getByText(name, { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    })

    // Cleanup — GET the list, find our row, DELETE.
    const list = await request
      .get('/api/broadcasts')
      .then((r) => (r.ok() ? r.json() : null))
      .catch(() => null)
    const rows = Array.isArray(list) ? list : list?.items || list?.data
    if (Array.isArray(rows)) {
      const mine = rows.find((b: { name?: string; id?: string | number }) => b.name === name)
      if (mine?.id != null) {
        await request.delete(`/api/broadcasts/${mine.id}`).catch(() => undefined)
      }
    }
  })
})
