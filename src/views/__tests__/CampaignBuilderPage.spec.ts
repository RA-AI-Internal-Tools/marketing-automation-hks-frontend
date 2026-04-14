/**
 * CampaignBuilderPage / CampaignEditorPage spec.
 *
 * Note: the task spec nominally targets `CampaignBuilderPage.vue`, but the
 * behaviours described (add / delete step with branch remap, STO and
 * quiet-hours toggles in the save payload) live in
 * `CampaignEditorPage.vue`. `CampaignBuilderPage.vue` is the graph editor
 * and doesn't expose those controls. We exercise the editor page here
 * and keep the spec file name aligned with the roadmap for traceability.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// ── Mocks ────────────────────────────────────────────────────────────────

const createCampaign = vi.fn()
const updateCampaign = vi.fn()
const push = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: {}, query: {} }),
  useRouter: () => ({ push }),
}))

vi.mock('@/api/dashboard', () => ({
  createCampaign: (...a: any[]) => createCampaign(...a),
  updateCampaign: (...a: any[]) => updateCampaign(...a),
}))

vi.mock('@/api/ai', () => ({
  fetchAIStatus: () => Promise.resolve({ enabled: false }),
}))

vi.mock('@/api/client', () => ({
  default: { get: vi.fn(() => Promise.reject(new Error('offline'))) },
}))

vi.mock('@/stores/templates', () => ({
  useTemplatesStore: () => ({
    templates: [
      { template_key: 'welcome', channel: 'email' },
      { template_key: 'reminder', channel: 'email' },
    ],
    load: vi.fn(),
  }),
}))

import CampaignEditorPage from '../CampaignEditorPage.vue'

const stubs = {
  PageHeader: { template: '<div><slot /><slot name="actions" /></div>' },
  CampaignSimulateModal: true,
  AIJourneyAssistModal: true,
  PlusIcon: true,
  TrashIcon: true,
  ArrowUpIcon: true,
  ArrowDownIcon: true,
  BeakerIcon: true,
  SparklesIcon: true,
}

function factory() {
  setActivePinia(createPinia())
  return mount(CampaignEditorPage, { global: { stubs, plugins: [createPinia()] } })
}

describe('CampaignEditorPage (Campaign Builder)', () => {
  beforeEach(() => {
    createCampaign.mockReset().mockResolvedValue({ id: 1 })
    updateCampaign.mockReset().mockResolvedValue({ id: 1 })
    push.mockReset()
  })

  it('Add-step button appends a new step to the list', async () => {
    const w = factory()
    await flushPromises()
    const vm: any = w.vm
    expect(vm.steps.length).toBe(1)
    vm.addStep()
    expect(vm.steps.length).toBe(2)
    expect(vm.steps[1].channel).toBe('email')
    expect(vm.steps[1].condition).toBe('always_true')
  })

  it('Delete-step removes step and remaps branching references', async () => {
    const w = factory()
    await flushPromises()
    const vm: any = w.vm
    // Build: [s0, s1, s2, s3]; s0 branches to 2 (true) and 3 (false)
    vm.steps.push(
      { delay_minutes: 0, channel: 'email', template_key: 't1', condition: 'always_true' },
      { delay_minutes: 0, channel: 'email', template_key: 't2', condition: 'always_true' },
      { delay_minutes: 0, channel: 'email', template_key: 't3', condition: 'always_true' },
    )
    vm.steps[0].true_next = 2
    vm.steps[0].false_next = 3
    vm.steps[1].true_next = 3

    // Remove index 1 → s0.true_next (2) decrements to 1, s0.false_next (3) → 2
    vm.removeStep(1)
    expect(vm.steps.length).toBe(3)
    expect(vm.steps[0].true_next).toBe(1)
    expect(vm.steps[0].false_next).toBe(2)

    // Remove the step that s0.true_next references (index 1) → should reset to null
    vm.removeStep(1)
    expect(vm.steps[0].true_next).toBeNull()
    // false_next was 2, above the removed index 1 → decrements to 1
    expect(vm.steps[0].false_next).toBe(1)
  })

  it('STO + quiet-hours toggles flow into the save payload', async () => {
    const w = factory()
    await flushPromises()
    const vm: any = w.vm
    vm.name = 'Test'
    vm.triggerEvent = 'user_signup'
    vm.steps[0].template_key = 'welcome'
    vm.useSTO = true
    vm.quietHours = { start: '22:00', end: '07:00', timezone: 'Europe/London' }

    await vm.handleSubmit()
    await flushPromises()

    expect(createCampaign).toHaveBeenCalledTimes(1)
    const req = createCampaign.mock.calls[0][0]
    expect(req.use_sto).toBe(true)
    expect(req.quiet_hours).toEqual({ start: '22:00', end: '07:00', timezone: 'Europe/London' })
    expect(req.name).toBe('Test')
    expect(req.trigger_event).toBe('user_signup')
    expect(Array.isArray(req.steps)).toBe(true)
  })

  it('Save omits quiet_hours when start/end are blank and sends use_sto=false by default', async () => {
    const w = factory()
    await flushPromises()
    const vm: any = w.vm
    vm.name = 'X'
    vm.triggerEvent = 'evt'
    vm.steps[0].template_key = 'welcome'

    await vm.handleSubmit()
    await flushPromises()

    const req = createCampaign.mock.calls[0][0]
    expect(req.use_sto).toBe(false)
    expect(req.quiet_hours).toBeUndefined()
  })
})
