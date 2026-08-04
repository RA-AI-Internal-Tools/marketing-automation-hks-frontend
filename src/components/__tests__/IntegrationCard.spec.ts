import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import IntegrationCard from '../IntegrationCard.vue'
import type { Integration } from '@/api/types'

// Minimal fixture — only the fields IntegrationCard actually reads.
// `status: 'configured'` deliberately exercises the widened
// IntegrationStatus union (src/api/types.ts): this fixture fails
// `vue-tsc --build` if 'configured' is ever dropped from that union again —
// see the same note on IntegrationForm.spec.ts's fixture.
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

describe('IntegrationCard', () => {
  // --- test_supported / test_unsupported_reason (2026-08) ----------------
  // The DTO carries these so the list view can explain, before an operator
  // ever opens Edit → Test, why the Test button in IntegrationForm.vue
  // will always answer not_supported for this provider.

  it('shows a "Test not supported" badge with the reason as its tooltip when test_supported is false', () => {
    const integration = integrationFixture({
      test_supported: false,
      test_unsupported_reason:
        'the only call that would exercise this credential is POST /track, which writes real CDP data',
    })
    const w = mount(IntegrationCard, { props: { integration } })

    const badge = w.find('[data-test="test-unsupported-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('Test not supported')
    expect(badge.attributes('title')).toBe(integration.test_unsupported_reason)
  })

  it('falls back to a generic title when test_unsupported_reason is empty', () => {
    const integration = integrationFixture({ test_supported: false, test_unsupported_reason: undefined })
    const w = mount(IntegrationCard, { props: { integration } })

    const badge = w.find('[data-test="test-unsupported-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.attributes('title')).toBeTruthy()
  })

  it('does not show the unsupported badge when test_supported is true', () => {
    const integration = integrationFixture({ test_supported: true })
    const w = mount(IntegrationCard, { props: { integration } })

    expect(w.find('[data-test="test-unsupported-badge"]').exists()).toBe(false)
  })

  it('prefers the last-tested Pass/Fail readout over the unsupported badge when both are present', () => {
    // Can't actually happen together on real data (test_supported:false
    // integrations never accumulate a last_tested_at), but the template
    // uses v-if/v-else-if — assert that ordering explicitly so a future
    // edit can't silently make them stack.
    const integration = integrationFixture({
      test_supported: false,
      last_tested_at: '2026-08-01T00:00:00Z',
      last_test_success: true,
    })
    const w = mount(IntegrationCard, { props: { integration } })

    expect(w.text()).toContain('Test passed')
    expect(w.find('[data-test="test-unsupported-badge"]').exists()).toBe(false)
  })

  it('shows neither readout when the integration has never been tested and testing is supported', () => {
    const integration = integrationFixture({ test_supported: true, last_tested_at: undefined })
    const w = mount(IntegrationCard, { props: { integration } })

    expect(w.text()).not.toContain('Test passed')
    expect(w.text()).not.toContain('Test failed')
    expect(w.find('[data-test="test-unsupported-badge"]').exists()).toBe(false)
  })
})
