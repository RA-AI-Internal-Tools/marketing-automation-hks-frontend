/**
 * Visual regression suite.
 *
 * Captures full-page screenshots of the major app routes in both light and
 * dark themes. Baselines are generated with:
 *
 *   npx playwright test e2e/visual.spec.ts --update-snapshots
 *
 * They must be produced against a seeded, deterministic environment (staging
 * with known fixture data) so that diffs reflect real UI regressions rather
 * than data churn. Commit the generated `visual.spec.ts-snapshots/` folder;
 * the `-diffs/` folder (written on failure) is gitignored.
 *
 * Volatile regions (clocks, counts, chart canvases) are masked so small
 * numeric fluctuations don't cause spurious diffs. `maxDiffPixelRatio`
 * tolerates a small amount of remaining noise (font hinting, anti-aliasing).
 *
 * Theme toggling uses the `ma-theme` localStorage key read by
 * `src/composables/useTheme.ts` plus a direct `data-theme` attribute on
 * <html> — setting both avoids any flash between initTheme() and paint.
 */
import { test, expect } from '@playwright/test'
import { hasE2ECreds, login } from './helpers/login'

const PAGES: ReadonlyArray<{ path: string; name: string }> = [
  { path: '/overview', name: 'overview' },
  { path: '/campaigns', name: 'campaigns' },
  { path: '/templates', name: 'templates' },
  { path: '/broadcasts', name: 'broadcasts' },
  { path: '/segments', name: 'segments' },
  { path: '/consents', name: 'consents' },
  { path: '/enrollments', name: 'enrollments' },
  { path: '/logs', name: 'logs' },
  { path: '/users', name: 'users' },
  { path: '/integrations', name: 'integrations' },
  { path: '/settings', name: 'settings' },
  { path: '/audit-logs', name: 'audit-logs' },
  { path: '/analytics/executive', name: 'analytics-executive' },
  { path: '/analytics/clients', name: 'analytics-clients' },
  { path: '/analytics/attribution', name: 'analytics-attribution' },
  { path: '/analytics/funnel', name: 'analytics-funnel' },
  { path: '/analytics/rfm', name: 'analytics-rfm' },
]

const THEMES = ['light', 'dark'] as const

for (const theme of THEMES) {
  for (const { path, name } of PAGES) {
    test(`visual ${theme} - ${name}`, async ({ page }) => {
      test.skip(!hasE2ECreds(), 'E2E creds missing')

      await login(page)

      // Force the theme before navigation so the page paints in the right
      // mode on first render. useTheme.ts reads `ma-theme` from localStorage
      // via initTheme() and mirrors it onto <html data-theme>; we set both so
      // the pre-Vue init picks it up even on first paint.
      await page.evaluate((t) => {
        localStorage.setItem('ma-theme', t)
        document.documentElement.setAttribute('data-theme', t)
      }, theme)

      await page.goto(path)
      await page.waitForLoadState('networkidle')

      // Mask volatile regions: timestamps, counts, live chart canvases.
      // Components can opt in to stability by adding `data-volatile`.
      await expect(page).toHaveScreenshot(`${theme}-${name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
        mask: [page.locator('time, .num-tabular, canvas, [data-volatile]')],
      })
    })
  }
}
