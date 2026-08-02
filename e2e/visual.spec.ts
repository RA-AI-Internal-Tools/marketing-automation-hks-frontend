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
import fs from 'node:fs'
import { test, expect, type TestInfo } from '@playwright/test'
import { hasE2ECreds, login } from './helpers/login'

/**
 * Fail loudly when a baseline is missing instead of quietly minting one.
 *
 * Playwright's default is `updateSnapshots: 'missing'`
 * (node_modules/playwright/lib/common/index.js:584 — `takeFirst(cli, user,
 * 'missing')`, and this repo's playwright.config.ts sets no override). Under
 * that mode `handleMissing()` WRITES the baseline to disk and returns
 * `pass: true` with a soft error. The practical consequence is that the very
 * first run bootstraps a baseline out of whatever the app happened to render
 * — including a broken layout, an error state, or an empty page — and every
 * later run then compares against that unreviewed artefact and goes green.
 * A regression captured on run #1 becomes the definition of "correct".
 *
 * The guard runs in a `beforeEach` that declares NO fixtures, so it fires
 * before the `page` fixture is built and before the creds check. Both of those
 * placements are deliberate: a missing baseline is a repository-state problem,
 * not an environment problem, so it must fail on a machine with no E2E
 * credentials and no browser binary. Otherwise the suite reports success while
 * asserting nothing at all — which is the whole defect.
 *
 * To (re)generate baselines, run against a seeded, deterministic environment:
 *   E2E_EMAIL=… E2E_PASSWORD=… npx playwright test e2e/visual.spec.ts --update-snapshots
 * and commit the resulting `e2e/visual.spec.ts-snapshots/` directory.
 */
function requireBaseline(snapshotName: string, info: TestInfo): void {
  // Stand down only for the two explicit baseline-authoring modes.
  // `--update-snapshots` presets to 'changed' and `--update-snapshots=all` to
  // 'all' (program.js:202); both write missing baselines on purpose. Crucially
  // neither is reachable without passing the flag — the no-flag default is
  // 'missing' (common/index.js:584) — so allowing them does not reopen the
  // silent self-heal hole this guard exists to close.
  const mode = info.config.updateSnapshots
  if (mode === 'all' || mode === 'changed') return

  const expectedPath = info.snapshotPath(snapshotName, { kind: 'screenshot' })
  if (fs.existsSync(expectedPath)) return

  throw new Error(
    `Visual baseline missing: ${expectedPath}\n` +
      `The visual regression suite cannot assert anything without committed baselines.\n` +
      `Generate them against a seeded environment, review the images, then commit them:\n` +
      `  E2E_EMAIL=… E2E_PASSWORD=… npx playwright test e2e/visual.spec.ts --update-snapshots`,
  )
}

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

const testTitle = (theme: string, name: string) => `visual ${theme} - ${name}`
const snapshotFor = (theme: string, name: string) => `${theme}-${name}.png`

/** Test title → expected baseline filename, for the fixture-free guard below. */
const BASELINE_BY_TITLE = new Map<string, string>(
  THEMES.flatMap((theme) =>
    PAGES.map(({ name }) => [testTitle(theme, name), snapshotFor(theme, name)] as const),
  ),
)

// Declares no fixtures — `{}` keeps Playwright from constructing `page`, so a
// missing baseline fails without launching a browser at all.
test.beforeEach(async ({}, testInfo) => {
  const snapshotName = BASELINE_BY_TITLE.get(testInfo.title)
  if (snapshotName) requireBaseline(snapshotName, testInfo)
})

for (const theme of THEMES) {
  for (const { path, name } of PAGES) {
    test(testTitle(theme, name), async ({ page }) => {
      const snapshotName = snapshotFor(theme, name)

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
      await expect(page).toHaveScreenshot(snapshotName, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
        mask: [page.locator('time, .num-tabular, canvas, [data-volatile]')],
      })
    })
  }
}
