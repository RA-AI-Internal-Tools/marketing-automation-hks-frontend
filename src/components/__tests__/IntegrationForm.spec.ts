import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import IntegrationForm from '../IntegrationForm.vue'
import { useAuthStore } from '@/stores/auth'
import type { Integration } from '@/api/types'

// Mock the API module — we don't want real HTTP traffic in unit tests and
// listCredentials() is called on mount. testIntegration is asserted on.
vi.mock('@/api/integrations', () => {
  return {
    listCredentials: vi.fn().mockResolvedValue([]),
    upsertCredential: vi.fn().mockResolvedValue(undefined),
    deleteCredential: vi.fn().mockResolvedValue(undefined),
    testIntegration: vi.fn().mockResolvedValue({ status: 'ok', detail: 'Connected' }),
  }
})

import { listCredentials, testIntegration } from '@/api/integrations'

// ConfirmDialog + Teleport interact awkwardly with test-utils — stub them.
const globalStubs = {
  Teleport: true,
  Transition: false,
  ConfirmDialog: true,
}

// Minimal fixture — only the fields IntegrationForm actually reads.
// `status: 'configured'` deliberately exercises the widened
// IntegrationStatus union (src/api/types.ts): this fixture fails
// `vue-tsc --build` if 'configured' is ever dropped from that union again.
function integrationFixture(overrides: Partial<Integration> = {}): Integration {
  return {
    id: 1,
    name: 'Tracardi Segment Tagger',
    provider_slug: 'tracardi_segment_tagger',
    provider_type: 'analytics',
    environment: 'production',
    status: 'configured',
    config: {},
    api_key_configured: true,
    updated_at: '2026-08-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function mountForm(
  options: { visible?: boolean; provider?: string; integration?: Integration } = {},
) {
  return mount(IntegrationForm, {
    props: {
      visible: options.visible ?? true,
      provider: options.provider ?? 'openai',
      integration: options.integration,
    },
    global: { stubs: globalStubs },
  })
}

// The component loads credentials from a `watch` on `visible` that is NOT
// immediate, so mounting straight into visible:true never triggers it. Real
// usage always flips the prop false → true (the modal is opened), which is what
// this helper reproduces — needed for any assertion about reloadRows().
async function mountFormOpened(
  options: { provider?: string; initialEnvironment?: 'sandbox' | 'production' } = {},
) {
  const w = mount(IntegrationForm, {
    props: {
      visible: false,
      provider: options.provider ?? 'openai',
      initialEnvironment: options.initialEnvironment,
    },
    global: { stubs: globalStubs },
  })
  await w.setProps({ visible: true })
  await flushPromises()
  return w
}

describe('IntegrationForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    ;(listCredentials as any).mockResolvedValue([])
  })

  it('renders the correct fields for openai provider', async () => {
    const auth = useAuthStore()
    auth.$patch({ email: 'a@b.com', role: 'admin' })

    const w = mountForm({ provider: 'openai' })
    await flushPromises()

    // openai has a single "API Key" field — label should appear.
    expect(w.text()).toContain('API Key')
    // It should be a secret input (password by default).
    const input = w.find('input[type="password"]')
    expect(input.exists()).toBe(true)
  })

  it('hides Save button for non-admin users', async () => {
    const auth = useAuthStore()
    auth.$patch({ email: 'v@b.com', role: 'viewer' })

    const w = mountForm({ provider: 'openai' })
    await flushPromises()

    expect(w.find('[data-test="save-btn"]').exists()).toBe(false)
    expect(w.find('[data-test="test-connection-btn"]').exists()).toBe(false)
    expect(w.find('[data-test="delete-all-btn"]').exists()).toBe(false)
  })

  it('calls testIntegration with the selected environment', async () => {
    const auth = useAuthStore()
    auth.$patch({ email: 'a@b.com', role: 'admin' })

    const w = mountForm({ provider: 'openai' })
    await flushPromises()

    // Switch to production tab, then click Test connection.
    await w.find('[data-test="env-tab-production"]').trigger('click')
    await w.find('[data-test="test-connection-btn"]').trigger('click')
    await flushPromises()

    expect(testIntegration).toHaveBeenCalledWith('openai', 'production')
  })

  // --- Single-container topology (2026-07-30) -------------------------------
  // enforceEnvScope (internal/api/routes_integrations.go:440) 400s any
  // credential read/write scoped to an env other than the instance's own, and
  // the live instance is pinned to production. Sandbox must therefore not be
  // reachable from this form.

  it('defaults the environment tab to production and loads production creds', async () => {
    const auth = useAuthStore()
    auth.$patch({ email: 'a@b.com', role: 'admin' })

    const w = await mountFormOpened({ provider: 'openai' })

    expect(listCredentials).toHaveBeenCalledWith('production')
    expect(w.find('[data-test="env-tab-production"]').attributes('aria-selected')).toBe('true')
  })

  it('disables the sandbox tab and clicking it cannot switch environment', async () => {
    const auth = useAuthStore()
    auth.$patch({ email: 'a@b.com', role: 'admin' })

    const w = await mountFormOpened({ provider: 'openai' })

    const sandboxTab = w.find('[data-test="env-tab-sandbox"]')
    expect(sandboxTab.exists()).toBe(true)
    expect(sandboxTab.attributes('disabled')).toBeDefined()

    // Clicking it must not move the form into an unwritable environment —
    // enforceEnvScope would 400 every read and write.
    await sandboxTab.trigger('click')
    await flushPromises()
    expect(listCredentials).not.toHaveBeenCalledWith('sandbox')
    expect(w.find('[data-test="env-tab-production"]').attributes('aria-selected')).toBe('true')
  })

  it('ignores an initialEnvironment of sandbox', async () => {
    const auth = useAuthStore()
    auth.$patch({ email: 'a@b.com', role: 'admin' })

    const w = await mountFormOpened({ provider: 'openai', initialEnvironment: 'sandbox' })

    expect(listCredentials).toHaveBeenCalledWith('production')
    expect(listCredentials).not.toHaveBeenCalledWith('sandbox')
    expect(w.find('[data-test="env-tab-production"]').attributes('aria-selected')).toBe('true')
  })

  // --- Four-state test result (2026-08) --------------------------------
  // POST /credentials/:provider/test now answers exactly one of
  // ok | error | not_configured | not_supported (probeProvider,
  // internal/api/routes_integrations.go). meta_whatsapp/fcm/ses moved out
  // of not_supported, so an unconfigured provider now legitimately answers
  // not_configured — that must render as a neutral/warning state, not the
  // same red used for a real probe failure.

  describe('test result colouring', () => {
    it('renders not_configured as a warning, not an error', async () => {
      const auth = useAuthStore()
      auth.$patch({ email: 'a@b.com', role: 'admin' })
      ;(testIntegration as any).mockResolvedValueOnce({
        status: 'not_configured',
        detail: 'missing access_token or phone_number_id',
      })

      const w = mountForm({ provider: 'meta_whatsapp' })
      await flushPromises()
      await w.find('[data-test="test-connection-btn"]').trigger('click')
      await flushPromises()

      const result = w.find('[data-test="test-result"]')
      expect(result.exists()).toBe(true)
      // Must NOT read as failure red.
      expect(result.classes()).not.toContain('text-[var(--color-error-text)]')
      expect(result.classes()).toContain('text-[var(--color-warning-text)]')
      expect(result.classes()).toContain('bg-[var(--color-warning-bg)]')
    })

    it('still renders a real probe failure ("error") as red', async () => {
      const auth = useAuthStore()
      auth.$patch({ email: 'a@b.com', role: 'admin' })
      ;(testIntegration as any).mockResolvedValueOnce({
        status: 'error',
        detail: 'http 401 Unauthorized',
      })

      const w = mountForm({ provider: 'openai' })
      await flushPromises()
      await w.find('[data-test="test-connection-btn"]').trigger('click')
      await flushPromises()

      const result = w.find('[data-test="test-result"]')
      expect(result.classes()).toContain('text-[var(--color-error-text)]')
    })

    it('still renders not_supported as neutral grey', async () => {
      const auth = useAuthStore()
      auth.$patch({ email: 'a@b.com', role: 'admin' })
      ;(testIntegration as any).mockResolvedValueOnce({
        status: 'not_supported',
        detail: 'no probe implemented for this integration',
      })

      const w = mountForm({ provider: 'tracardi_segment_tagger' })
      await flushPromises()
      await w.find('[data-test="test-connection-btn"]').trigger('click')
      await flushPromises()

      const result = w.find('[data-test="test-result"]')
      expect(result.classes()).not.toContain('text-[var(--color-error-text)]')
      expect(result.classes()).not.toContain('text-[var(--color-warning-text)]')
      expect(result.classes()).toContain('text-[var(--color-text-tertiary)]')
    })
  })

  // --- Fifth state: a throttled probe (2026-08) -----------------------------
  // Both probe routes sit behind one `testLimiter` (5/min per principal +
  // provider) in internal/api/routes_integrations.go. On refusal
  // middleware.RateLimiterByKey answers 429 +
  // {"error":"rate limit exceeded","reason":"rate_limited","retry_after":N}.
  // The integration was never contacted, so this must NOT render as a failed
  // test — the whole point of the change.

  /** Axios-shaped rejection. `headers` keys are lower-cased, as axios does. */
  function httpError(
    status: number,
    data: unknown,
    headers: Record<string, string> = {},
  ): unknown {
    return {
      message: `Request failed with status code ${status}`,
      response: { status, data, headers },
    }
  }

  function rateLimitBody(retryAfter?: number) {
    return {
      error: 'rate limit exceeded',
      reason: 'rate_limited',
      ...(retryAfter === undefined ? {} : { retry_after: retryAfter }),
    }
  }

  async function clickTest(provider = 'openai') {
    const auth = useAuthStore()
    auth.$patch({ email: 'a@b.com', role: 'admin' })
    const w = mountForm({ provider })
    await flushPromises()
    await w.find('[data-test="test-connection-btn"]').trigger('click')
    await flushPromises()
    return w
  }

  describe('rate-limited probe', () => {
    it('renders a 429 as the throttled state, not as a failed test', async () => {
      ;(testIntegration as any).mockRejectedValueOnce(httpError(429, rateLimitBody(12)))

      const w = await clickTest()

      const result = w.find('[data-test="test-result"]')
      expect(result.exists()).toBe(true)
      // The defining assertion: not the failure tone.
      expect(result.classes()).not.toContain('text-[var(--color-error-text)]')
      expect(result.classes()).not.toContain('bg-[var(--color-error-bg)]')
      expect(result.classes()).toContain('text-[var(--color-info-text)]')
      // And the operator is told it is a throttle, not a broken integration.
      expect(result.text().toLowerCase()).toContain('rate limited')
      expect(result.text()).not.toContain('rate limit exceeded')
      w.unmount()
    })

    it('surfaces the retry hint from retry_after in the DOM', async () => {
      ;(testIntegration as any).mockRejectedValueOnce(httpError(429, rateLimitBody(12)))

      const w = await clickTest()

      expect(w.find('[data-test="test-result"]').text()).toContain('Try again in 12s')
      w.unmount()
    })

    it('disables Test connection for the retry window and says how long', async () => {
      ;(testIntegration as any).mockRejectedValueOnce(httpError(429, rateLimitBody(30)))

      const w = await clickTest()

      const btn = w.find('[data-test="test-connection-btn"]')
      expect(btn.attributes('disabled')).toBeDefined()
      expect(btn.text()).toBe('Retry in 30s')
      expect(btn.attributes('title')).toContain('30s')

      // Clicking through the throttle must not burn another request — the
      // middleware re-EXPIREs the bucket on refused requests too.
      ;(testIntegration as any).mockClear()
      await btn.trigger('click')
      await flushPromises()
      expect(testIntegration).not.toHaveBeenCalled()
      w.unmount()
    })

    it('falls back to the Retry-After header when the body carries no retry_after', async () => {
      ;(testIntegration as any).mockRejectedValueOnce(
        httpError(429, rateLimitBody(), { 'retry-after': '45' }),
      )

      const w = await clickTest()

      expect(w.find('[data-test="test-result"]').text()).toContain('Try again in 45s')
      expect(w.find('[data-test="test-connection-btn"]').text()).toBe('Retry in 45s')
      w.unmount()
    })

    it('leaves the button usable when a 429 carries no retry duration at all', async () => {
      // Nothing to count down from. Showing the state without inventing a
      // number beats disabling the button for a guessed interval.
      ;(testIntegration as any).mockRejectedValueOnce(httpError(429, undefined))

      const w = await clickTest()

      const result = w.find('[data-test="test-result"]')
      expect(result.classes()).toContain('text-[var(--color-info-text)]')
      expect(result.text()).toContain('Try again in a moment')
      const btn = w.find('[data-test="test-connection-btn"]')
      expect(btn.attributes('disabled')).toBeUndefined()
      expect(btn.text()).toBe('Test connection')
      w.unmount()
    })

    // Discriminator guard: a suite that only ever feeds the handler a 429
    // cannot tell whether the branch discriminates or just swallows every
    // rejection into the throttled state.
    it('still renders a genuine 500 as a failure', async () => {
      ;(testIntegration as any).mockRejectedValueOnce(
        httpError(500, { error: 'probe panicked' }),
      )

      const w = await clickTest()

      const result = w.find('[data-test="test-result"]')
      expect(result.classes()).toContain('text-[var(--color-error-text)]')
      expect(result.classes()).not.toContain('text-[var(--color-info-text)]')
      expect(result.text()).toContain('probe panicked')
      expect(w.find('[data-test="test-connection-btn"]').attributes('disabled')).toBeUndefined()
      w.unmount()
    })

    it('renders a network failure (no response) as a failure', async () => {
      ;(testIntegration as any).mockRejectedValueOnce({ message: 'Network Error' })

      const w = await clickTest()

      const result = w.find('[data-test="test-result"]')
      expect(result.classes()).toContain('text-[var(--color-error-text)]')
      expect(result.text()).toContain('Network Error')
      w.unmount()
    })

    it('drops the countdown when the form switches to another provider', async () => {
      // The throttle bucket is keyed per (principal, provider) server-side, so
      // provider A's lockout must not disable the button for provider B.
      ;(testIntegration as any).mockRejectedValueOnce(httpError(429, rateLimitBody(30)))
      const auth = useAuthStore()
      auth.$patch({ email: 'a@b.com', role: 'admin' })

      const w = mountForm({ provider: 'openai' })
      await flushPromises()
      await w.find('[data-test="test-connection-btn"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-test="test-connection-btn"]').attributes('disabled')).toBeDefined()

      await w.setProps({ provider: 'ses' })
      await flushPromises()

      const btn = w.find('[data-test="test-connection-btn"]')
      expect(btn.attributes('disabled')).toBeUndefined()
      expect(btn.text()).toBe('Test connection')
      w.unmount()
    })
  })

  // --- Disabled Test button when the provider carries test_supported:false

  describe('test_supported / test_unsupported_reason', () => {
    it('disables Test connection and shows the reason when test_supported is false', async () => {
      const auth = useAuthStore()
      auth.$patch({ email: 'a@b.com', role: 'admin' })

      const integration = integrationFixture({
        test_supported: false,
        test_unsupported_reason:
          'the only call that would exercise this credential is POST /track, which writes real CDP data',
      })
      const w = mountForm({ provider: 'tracardi_segment_tagger', integration })
      await flushPromises()

      const btn = w.find('[data-test="test-connection-btn"]')
      expect(btn.attributes('disabled')).toBeDefined()

      const note = w.find('[data-test="test-unsupported-note"]')
      expect(note.exists()).toBe(true)
      expect(note.text()).toContain(integration.test_unsupported_reason)

      // Clicking a disabled button must not call the API at all.
      await btn.trigger('click')
      await flushPromises()
      expect(testIntegration).not.toHaveBeenCalled()
    })

    it('leaves Test connection enabled when test_supported is true', async () => {
      const auth = useAuthStore()
      auth.$patch({ email: 'a@b.com', role: 'admin' })

      const integration = integrationFixture({ test_supported: true })
      const w = mountForm({ provider: 'openai', integration })
      await flushPromises()

      expect(w.find('[data-test="test-connection-btn"]').attributes('disabled')).toBeUndefined()
      expect(w.find('[data-test="test-unsupported-note"]').exists()).toBe(false)
    })

    it('leaves Test connection enabled when no integration record is available yet (fail open)', async () => {
      const auth = useAuthStore()
      auth.$patch({ email: 'a@b.com', role: 'admin' })

      const w = mountForm({ provider: 'openai' }) // no `integration` prop
      await flushPromises()

      expect(w.find('[data-test="test-connection-btn"]').attributes('disabled')).toBeUndefined()
    })
  })
})
