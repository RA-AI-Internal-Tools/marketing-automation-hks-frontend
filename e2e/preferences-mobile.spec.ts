/**
 * Preference centre on a phone — 375px, mocked API.
 *
 * This is the one screen in the product whose entire audience is on a phone,
 * inside a mail client, with no way to report a bug — and it is the legal
 * unsubscribe path. A layout defect here is not cosmetic: an unreachable
 * switch or a confirm button pushed off-canvas means the recipient cannot
 * leave the mailing list.
 *
 * Unlike every other spec in this folder these routes are PUBLIC, so no
 * E2E_EMAIL / E2E_PASSWORD is involved. All four API calls are fulfilled by
 * `page.route()` — nothing here talks to a backend, which is also what makes
 * the assertions deterministic. Point E2E_BASE_URL at any target serving the
 * SPA (a local `npm run dev` on :5173 is enough) and run:
 *
 *   E2E_BASE_URL=http://localhost:5173 npx playwright test e2e/preferences-mobile.spec.ts
 *
 * The suite skips when E2E_BASE_URL is unset so a CI job with no target stays
 * green rather than failing against the localhost default.
 */
import { test, expect, type Page } from '@playwright/test'

/** The audience's device, near enough: iPhone SE / mini class viewport. */
const MOBILE = { width: 375, height: 812 }

/** Apple's minimum comfortable touch target, and the floor this page claims. */
const MIN_TAP = 44

const LONG_TOKEN = 'e2e.long.token'
const SHORT_TOKEN = 'e2e-short-1'

test.use({ viewport: MOBILE, hasTouch: true })

test.beforeEach(async ({ page }) => {
  test.skip(!process.env.E2E_BASE_URL, 'E2E_BASE_URL not set — no target to render against')
  await mockPreferenceApi(page)
})

/**
 * Serve the authoritative contract shapes. `optinStatus` lets a test drive the
 * degraded paths (503) without reaching for a real sender.
 */
async function mockPreferenceApi(
  page: Page,
  opts: { optinStatus?: number } = {},
): Promise<void> {
  const optinStatus = opts.optinStatus ?? 202

  await page.route('**/api/public/preferences/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    if (request.method() === 'GET') {
      return json(200, {
        channels: { email: true, sms: false, whatsapp: false, push: true },
      })
    }
    if (pathname.endsWith('/request-optin')) {
      return optinStatus === 202
        ? json(202, { ok: true })
        : json(optinStatus, { error: 'optin_unavailable' })
    }
    if (pathname.includes('/preferences/optin/')) {
      return optinStatus === 202
        ? json(200, { ok: true })
        : json(optinStatus, { error: 'optin_unavailable' })
    }
    return json(200, { ok: true })
  })
}

/**
 * The page must never scroll sideways. Measured on <html> because that is what
 * a phone browser actually pans; a single over-wide child is enough to break it.
 */
async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }
  })
  expect(
    overflow.scrollWidth,
    `page scrolls horizontally: ${overflow.scrollWidth}px of content in ${overflow.clientWidth}px`,
  ).toBeLessThanOrEqual(overflow.clientWidth)
}

/** Fully on-canvas and big enough to hit with a thumb. */
async function expectTappable(page: Page, selector: string, label: string): Promise<void> {
  const box = await page.locator(selector).boundingBox()
  expect(box, `${label}: not rendered`).not.toBeNull()
  expect(box!.height, `${label}: ${box!.height}px tall`).toBeGreaterThanOrEqual(MIN_TAP)
  expect(box!.width, `${label}: ${box!.width}px wide`).toBeGreaterThanOrEqual(MIN_TAP)
  expect(box!.x, `${label}: starts off the left edge`).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width, `${label}: extends past the right edge`).toBeLessThanOrEqual(
    MOBILE.width,
  )
}

/** No element may stick out past the viewport — text included. */
async function expectWithinViewport(page: Page, selector: string, label: string): Promise<void> {
  const box = await page.locator(selector).boundingBox()
  expect(box, `${label}: not rendered`).not.toBeNull()
  expect(box!.x, `${label}: starts off the left edge`).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width, `${label}: overflows the right edge`).toBeLessThanOrEqual(
    MOBILE.width,
  )
}

test.describe('preference centre at 375px', () => {
  test('every channel switch is on-canvas and a real 44px target', async ({ page }) => {
    await page.goto(`/preferences/${LONG_TOKEN}`)

    const switches = page.locator('[data-channel-toggle]')
    await expect(switches).toHaveCount(4)

    for (const channel of ['email', 'sms', 'whatsapp', 'push']) {
      await expectTappable(page, `[data-channel-toggle="${channel}"]`, `${channel} switch`)
    }

    await expectNoHorizontalScroll(page)
  })

  test('the confirm-sent notice and its resend control fit and stay reachable', async ({ page }) => {
    await page.goto(`/preferences/${LONG_TOKEN}`)

    // sms starts off, so tapping it asks for a confirmation email.
    await page.tap('[data-channel-toggle="sms"]')

    const notice = page.locator('.pref-row[data-channel="sms"] .pref-notice')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText('sent a confirmation to your inbox')
    await expectWithinViewport(page, '.pref-row[data-channel="sms"] .pref-notice', 'sms notice')

    await expectTappable(page, '[data-channel-resend="sms"]', 'sms resend')
    await expectNoHorizontalScroll(page)

    // The switch has retired rather than staying live under the notice.
    await expect(page.locator('[data-channel-toggle="sms"]')).toBeDisabled()
  })

  test('the 503 warning wraps instead of overflowing', async ({ page }) => {
    await page.unroute('**/api/public/preferences/**')
    await mockPreferenceApi(page, { optinStatus: 503 })
    await page.goto(`/preferences/${LONG_TOKEN}`)

    await page.tap('[data-channel-toggle="whatsapp"]')

    const notice = page.locator('.pref-row[data-channel="whatsapp"] .pref-notice')
    await expect(notice).toContainText('cannot send confirmation emails')
    await expectWithinViewport(
      page,
      '.pref-row[data-channel="whatsapp"] .pref-notice',
      'whatsapp 503 notice',
    )
    await expectNoHorizontalScroll(page)
  })

  test('the expired-link error state fits the viewport', async ({ page }) => {
    await page.unroute('**/api/public/preferences/**')
    await page.route('**/api/public/preferences/**', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_token' }),
      }),
    )
    await page.goto(`/preferences/${LONG_TOKEN}`)

    await expect(page.getByRole('alert')).toContainText('This link has expired')
    await expectWithinViewport(page, '.error-state', 'expired error state')
    await expectNoHorizontalScroll(page)
  })
})

test.describe('confirmation page at 375px', () => {
  const CONFIRM_URL = `/preferences/confirm/${SHORT_TOKEN}?channel=push`

  test('the confirm button is reachable without horizontal scroll, and nothing fires until it is pressed', async ({
    page,
  }) => {
    const optinCalls: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/preferences/optin/')) optinCalls.push(r.method())
    })

    await page.goto(CONFIRM_URL)

    const cta = page.getByRole('button', { name: /yes, turn push notifications back on/i })
    await expect(cta).toBeVisible()
    // Reachable in the first screenful — no scrolling to find the only control.
    await expectTappable(page, '[data-confirm-optin]', 'confirm button')
    await expectNoHorizontalScroll(page)
    expect(optinCalls, 'the single-use token must not be spent on load').toEqual([])

    await cta.tap()

    await expect(page.getByText('Push notifications is back on')).toBeVisible()
    expect(optinCalls).toEqual(['POST'])
    await expectNoHorizontalScroll(page)
    await expectWithinViewport(page, '.confirm-ok', 'confirmed panel')
  })

  test('a long channel label does not push the button off-canvas', async ({ page }) => {
    // "Push notifications" is the longest label the contract allows; combined
    // with the "Yes, turn … back on" wrapper it is the widest the CTA can get.
    await page.goto(CONFIRM_URL)
    await expectTappable(page, '[data-confirm-optin]', 'confirm button (longest label)')
    await expectNoHorizontalScroll(page)
  })

  test('the 503 state fits and stays retryable', async ({ page }) => {
    await page.unroute('**/api/public/preferences/**')
    await mockPreferenceApi(page, { optinStatus: 503 })
    await page.goto(CONFIRM_URL)

    await page.tap('[data-confirm-optin]')

    await expect(page.getByRole('alert')).toContainText('email service is unavailable')
    await expectWithinViewport(page, '.error-state', '503 error state')
    await expectTappable(page, '.error-state-retry', 'try-again button')
    await expectNoHorizontalScroll(page)
  })
})
