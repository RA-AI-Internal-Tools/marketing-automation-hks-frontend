/**
 * Integrations — credential schema (read-only) + credential override /
 * test-connection / delete (opt-in, mutating).
 *
 * ── WHAT THIS SPEC TALKS TO (verified 2026-08-03) ──────────────────────────
 *
 * `playwright.config.ts` resolves `baseURL` as
 * `process.env.E2E_BASE_URL || 'http://localhost:5173'`, and nothing in this
 * repo loads a dotenv file into the Playwright process (`.env.production` /
 * `.env.staging` are Vite build-time files and only set an empty
 * `VITE_API_URL`). So the target is whatever the caller exports — and
 * `.github/workflows/e2e.yml` exports
 * `E2E_BASE_URL: ${{ inputs.base_url || 'https://ma.internal.hksglobal.group' }}`
 * with `secrets.E2E_EMAIL` / `secrets.E2E_PASSWORD`, on a nightly `cron: 0 3 * * *`.
 * The nightly run therefore points at the LIVE instance.
 *
 * ── WHY THE MUTATING TEST IS OPT-IN ────────────────────────────────────────
 *
 * The write this spec performs is not cosmetic. `IntegrationForm.vue` pins
 * `environment` to `'production'` (`WRITABLE_ENVIRONMENTS = ['production']`,
 * because the deployment collapsed to one api container with
 * `MA_ENVIRONMENT=production` and `enforceEnvScope` 400s anything else), so
 * there is no sandbox to write to. The save calls
 * `POST /api/integrations/credentials`, which persists an encrypted credential
 * that channel senders read; a junk value left behind can break the live
 * provider. And the cleanup control is "Delete all for this environment"
 * (`data-test="delete-all-btn"`), which removes EVERY stored credential for the
 * provider in production — including any real one that predates the run.
 *
 * That is not something a nightly job may do unattended. The mutating test
 * therefore runs only when the operator names the instance they are willing to
 * mutate:
 *
 *     E2E_CREDENTIAL_WRITE_TARGET=$E2E_BASE_URL npx playwright test e2e/credentials.spec.ts
 *
 * PROPOSED PROPER TARGET: a disposable MA instance (docker-compose api +
 * postgres, `MA_ENVIRONMENT=production` since that is all the backend supports)
 * seeded with the integration catalog, pointed at by `E2E_BASE_URL`. No such
 * instance exists today, so this spec is NOT silently repointed at one — it
 * refuses to mutate instead, loudly, and the read-only test below still runs
 * against whatever the caller targeted.
 *
 * ── WHAT THE PREVIOUS VERSION ACTUALLY DID ─────────────────────────────────
 *
 * Every check was `.catch(() => undefined)` or an `if (visible)`, so a failed
 * write, a failed connection test and a failed cleanup were all green. Two of
 * those checks could never have passed in any case: it waited for text matching
 * /override/i and then for /env|unset|not configured/, and the Integrations UI
 * renders neither — the credential chip reads "Configured (production)" /
 * "Partial (production)" (`IntegrationCard.vue`), and "override" appears only
 * on the feature-flags section of SettingsPage. It also opened the modal by
 * clicking the provider name, which is a plain <h3> with no handler; the modal
 * opens from the "Edit integration" icon button.
 */
import { test, expect, type Page, type Locator } from '@playwright/test'
import { hasE2ECreds, login } from './helpers/login'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173'
const WRITE_TARGET = process.env.E2E_CREDENTIAL_WRITE_TARGET
const writesAllowed = !!WRITE_TARGET && WRITE_TARGET === BASE_URL

/**
 * The provider under test is PINNED, never "whichever card is first". The
 * cleanup path deletes every credential the provider has in this environment,
 * so which provider it lands on must be a decision, not an accident of grid
 * ordering or catalog drift.
 *
 * Field labels mirror `src/api/integrationKeys.ts`. Add an entry here when
 * pointing E2E_CREDENTIAL_PROVIDER at a different provider.
 */
const PROVIDER = process.env.E2E_CREDENTIAL_PROVIDER || 'openai'
const PROVIDERS: Record<string, { cardText: RegExp; fieldLabel: string }> = {
  openai: { cardText: /openai/i, fieldLabel: 'API Key' },
  elastic_email: { cardText: /elastic\s*email/i, fieldLabel: 'API Key' },
  plivo: { cardText: /plivo/i, fieldLabel: 'Auth Token' },
}

/** Deliberately unmistakable, so anything left behind is identifiable by a human. */
const FAKE_VALUE = `E2E-DO-NOT-USE-invalid-credential-${Date.now()}`

function providerConfig() {
  const cfg = PROVIDERS[PROVIDER]
  // A missing entry is a spec bug, not an environment condition — fail, don't skip.
  expect(
    cfg,
    `E2E_CREDENTIAL_PROVIDER='${PROVIDER}' has no entry in PROVIDERS. Add its card text and ` +
      'field label (from src/api/integrationKeys.ts) to e2e/credentials.spec.ts.',
  ).toBeTruthy()
  return cfg!
}

/** The provider's catalog card. */
function providerCard(page: Page): Locator {
  return page.locator('[data-test="integration-card"]').filter({ hasText: providerConfig().cardText })
}

/**
 * Open the credential modal for the pinned provider. Every failure here is a
 * hard failure: a missing card means the catalog no longer offers the provider
 * this spec is pinned to, which is a real regression, not a reason to skip.
 */
async function openCredentialModal(page: Page): Promise<Locator> {
  await page.goto('/integrations')
  await expect(page).toHaveURL(/\/integrations/)

  // Wait for the catalog fetch to settle — the grid renders skeletons first.
  const cards = page.locator('[data-test="integration-card"]')
  await expect(
    cards.first(),
    `No integration cards rendered at ${BASE_URL}/integrations. The catalog request ` +
      '(GET /api/integrations) failed or returned an empty list.',
  ).toBeVisible({ timeout: 20_000 })

  const card = providerCard(page)
  await expect(
    card,
    `No integration card matching ${providerConfig().cardText} at ${BASE_URL}/integrations. ` +
      `Set E2E_CREDENTIAL_PROVIDER to a provider this deployment actually offers.`,
  ).toHaveCount(1)

  await card.getByRole('button', { name: 'Edit integration' }).click()

  const modal = page.locator('[data-test="integration-form"]')
  await expect(modal, 'The credential modal did not open.').toBeVisible({ timeout: 10_000 })
  return modal
}

test.describe('Integrations · credentials', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECreds(), 'E2E_EMAIL / E2E_PASSWORD not set')
    await login(page)
  })

  // ── Read-only. Runs on every target, asserts hard, writes nothing. ────────
  test('credential form renders the provider schema (read-only)', async ({ page }) => {
    const modal = await openCredentialModal(page)
    const { fieldLabel } = providerConfig()

    // The environment tab bar must show production selected — the whole
    // credential surface is scoped by it, and a spec that asserted against the
    // wrong env would be asserting about a store nobody writes to.
    await expect(
      modal.locator('[data-test="env-tab-production"]'),
      'The production environment tab is not selected — credential reads/writes would be scoped elsewhere.',
    ).toHaveAttribute('aria-selected', 'true')

    // The schema rendered, and its labels are associated with their controls
    // (getByLabel only matches when for/id or aria-label is wired). This is the
    // check whose absence let the old spec silently find no field at all.
    const field = modal.getByLabel(fieldLabel, { exact: true })
    await expect(
      field,
      `Provider '${PROVIDER}' rendered no control labelled '${fieldLabel}'. Either the ` +
        'credential schema in src/api/integrationKeys.ts changed, or the label is no longer ' +
        'associated with its input.',
    ).toBeVisible()

    // The admin action controls exist. If they do not, the mutating test below
    // could not have done anything either — better to learn that here.
    await expect(modal.locator('[data-test="save-btn"]')).toBeVisible()
    await expect(modal.locator('[data-test="test-connection-btn"]')).toBeVisible()
    await expect(modal.locator('[data-test="delete-all-btn"]')).toBeVisible()
  })

  // ── Mutating. Opt-in only. Every step asserts. ────────────────────────────
  test('override, test connection, delete', async ({ page }) => {
    test.skip(
      !writesAllowed,
      `Refusing to write a credential to ${BASE_URL}. This test upserts a credential into the ` +
        "instance's production credential store and then deletes EVERY credential the provider " +
        'has there. Re-run with E2E_CREDENTIAL_WRITE_TARGET set to exactly the E2E_BASE_URL you ' +
        'are willing to mutate — and do not point it at ma.internal.hksglobal.group.',
    )

    const { fieldLabel } = providerConfig()
    const modal = await openCredentialModal(page)
    const field = modal.getByLabel(fieldLabel, { exact: true })
    await expect(field).toBeVisible()

    // `cred-stored-*` is rendered iff the LAST SERVER READ returned a stored
    // row for this key. It is the honest persistence signal on both sides of
    // the flow: it must appear after the save and disappear after the delete.
    const fieldKey = await field.getAttribute('data-test')
    expect(fieldKey, 'credential field is missing its data-test attribute').toBeTruthy()
    const keyName = fieldKey!.replace(/^cred-field-/, '')
    const storedMarker = modal.locator(`[data-test="cred-stored-${keyName}"]`)

    // Refuse to clobber real configuration. The cleanup deletes everything the
    // provider has stored, so running against an already-configured provider
    // would destroy a credential this test did not create.
    test.skip(
      await storedMarker.count() > 0,
      `Provider '${PROVIDER}' already has a stored '${keyName}' credential on ${BASE_URL}. ` +
        'This test would overwrite it and then delete it. Point E2E_CREDENTIAL_PROVIDER at an ' +
        'unconfigured provider, or run against a disposable instance.',
    )

    let wrote = false
    try {
      // ── 1. Write. A failed write must be red. ────────────────────────────
      await field.fill(FAKE_VALUE)
      await modal.locator('[data-test="save-btn"]').click()
      await expect(
        storedMarker,
        `Save did not persist: after POST /api/integrations/credentials the modal re-read the ` +
          `store and still shows no '${keyName}' row for '${PROVIDER}' in production.`,
      ).toBeVisible({ timeout: 15_000 })
      wrote = true

      // The catalog view must agree with the modal — this is the credential
      // state operators actually look at.
      await expect(
        providerCard(page).locator('[data-test="credential-status-chip"]'),
        'The provider card does not show a "Configured (production)" chip after a successful save.',
      ).toBeVisible({ timeout: 10_000 })

      // ── 2. Test connection. A test that never completes must be red. ─────
      await modal.locator('[data-test="test-connection-btn"]').click()
      const result = modal.locator('[data-test="test-result"]')
      await expect(
        result,
        'Test connection produced no result. POST /api/integrations/credentials/' +
          `${PROVIDER}/test never resolved into a rendered status.`,
      ).toBeVisible({ timeout: 30_000 })

      // The value is fake, so a provider-side rejection ("failed: 401 …") is the
      // EXPECTED outcome and must not fail this test. What must fail it is a
      // round trip that never happened — a transport error dressed up as a
      // result, which is what `handleTest`'s catch branch renders.
      const detail = (await result.innerText()).trim()
      expect(detail.length, 'Test connection rendered an empty result block.').toBeGreaterThan(0)
      expect(
        detail,
        `Test connection did not reach the provider — the UI rendered a transport error: ${detail}`,
      ).not.toMatch(/network error|request failed|timeout of \d+ms exceeded|ERR_/i)

      // ── 3. Cleanup. A failed cleanup must be red, not silent. ────────────
      await modal.locator('[data-test="delete-all-btn"]').click()
      const confirm = page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true })
      await expect(confirm, 'The delete confirmation dialog did not open.').toBeVisible({ timeout: 10_000 })
      await confirm.click()

      await expect(
        storedMarker,
        `CLEANUP FAILED — the credential this test wrote is STILL STORED. Remove it by hand: ` +
          `provider='${PROVIDER}', environment='production', key_name='${keyName}' on ${BASE_URL}.`,
      ).toHaveCount(0, { timeout: 15_000 })
      wrote = false

      await expect(
        providerCard(page).locator('[data-test="credential-status-chip"]'),
        'The provider card still shows a "Configured" chip after the credential was deleted.',
      ).toHaveCount(0, { timeout: 10_000 })
    } finally {
      // Last-ditch removal if an assertion above aborted the flow between the
      // write and the delete. Never swallow the outcome — say what is left.
      if (wrote) {
        await modal.locator('[data-test="delete-all-btn"]').click().catch(() => undefined)
        await page
          .getByRole('dialog')
          .getByRole('button', { name: 'Delete', exact: true })
          .click()
          .catch(() => undefined)
        const stillThere = await storedMarker.count().catch(() => 1)
        if (stillThere > 0) {
          // eslint-disable-next-line no-console
          console.error(
            `credentials.spec.ts LEFT A CREDENTIAL BEHIND on ${BASE_URL}: provider='${PROVIDER}', ` +
              `environment='production', key_name='${keyName}'. Delete it manually.`,
          )
        }
      }
    }
  })
})
