/**
 * Shared login helper for E2E specs.
 *
 * Reads credentials from E2E_EMAIL / E2E_PASSWORD. Callers should gate on
 * `hasE2ECreds()` (or use `test.skip`) so that CI jobs without secrets
 * auto-skip rather than fail.
 */
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const E2E_EMAIL = process.env.E2E_EMAIL
export const E2E_PASSWORD = process.env.E2E_PASSWORD

export function hasE2ECreds(): boolean {
  return !!E2E_EMAIL && !!E2E_PASSWORD
}

/**
 * Navigate to `/login`, submit credentials, and wait for the post-login
 * route to settle. Throws if creds are missing — call sites should skip
 * with `test.skip(!hasE2ECreds(), ...)` before invoking this.
 *
 * Resolves relative to the Playwright `baseURL` — never hardcode.
 */
export async function login(
  page: Page,
  opts: { email?: string; password?: string } = {},
): Promise<void> {
  const email = opts.email ?? E2E_EMAIL
  const password = opts.password ?? E2E_PASSWORD

  if (!email || !password) {
    throw new Error('login(): E2E_EMAIL / E2E_PASSWORD must be set')
  }

  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|log in/i }).click()

  // Post-login: we should have navigated away from /login. The exact landing
  // route has varied (overview vs dashboard) — accept either, but require
  // that we're no longer on the login page.
  await expect(page).not.toHaveURL(/\/login(\?|$|\/)/, { timeout: 15_000 })
}
