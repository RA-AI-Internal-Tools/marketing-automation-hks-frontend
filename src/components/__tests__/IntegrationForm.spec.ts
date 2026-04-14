import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import IntegrationForm from '../IntegrationForm.vue'
import { useAuthStore } from '@/stores/auth'

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

function mountForm(options: { visible?: boolean; provider?: string } = {}) {
  return mount(IntegrationForm, {
    props: { visible: options.visible ?? true, provider: options.provider ?? 'openai' },
    global: { stubs: globalStubs },
  })
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
})
