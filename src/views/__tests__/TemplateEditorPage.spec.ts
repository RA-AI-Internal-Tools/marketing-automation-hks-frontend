/**
 * TemplateEditorPage — the non-email (sms / whatsapp / push / inbox) form.
 *
 * The inbox channel's CTA URL, CTA label and type were collected here and
 * discarded by the API. They are persisted now, and InboxSender uses them as
 * the fallback when the triggering event payload omits them — which, since
 * campaign-step condition_params never reach a sender, was always.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// The rest parameters are load-bearing, not decoration: the store methods
// below forward their arguments into these spies, and a `vi.fn(() => ...)`
// declares a ZERO-argument signature, so `create(...a)` is a type error
// (TS2556) — and every `create.mock.calls[0]` assertion in this file is
// reading arguments the spy's own type says it can never receive.
const create = vi.fn((..._args: unknown[]) => Promise.resolve({ id: 4 }))
const update = vi.fn((..._args: unknown[]) => Promise.resolve({ id: 4 }))
const get = vi.fn()
const push = vi.fn()

let routeParams: Record<string, string> = {}

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ params: routeParams, query: {} }),
  onBeforeRouteLeave: vi.fn(),
}))

vi.mock('@/stores/templates', () => ({
  useTemplatesStore: () => ({
    create: (...a: unknown[]) => create(...a),
    update: (...a: unknown[]) => update(...a),
    get: (...a: unknown[]) => get(...a),
  }),
}))

import TemplateEditorPage from '../TemplateEditorPage.vue'

const stubs = {
  PageHeader: { template: '<div><slot /></div>' },
  EmailTemplateEditor: true,
}

function mountPage() {
  return mount(TemplateEditorPage, { global: { stubs, plugins: [createPinia()] } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  routeParams = {}
  create.mockClear()
  update.mockClear()
  get.mockReset()
  push.mockClear()
})

describe('TemplateEditorPage — inbox channel', () => {
  it('sends cta_url, cta_label and inbox_type on create', async () => {
    const wrapper = mountPage()
    await flushPromises()

    const vm = wrapper.vm as any
    vm.channel = 'inbox'
    vm.templateKey = 'order_shipped'
    vm.name = 'Order shipped'
    vm.subject = 'Your order shipped'
    vm.body = 'Track it now'
    vm.ctaUrl = 'https://ar-pay.store/orders/1'
    vm.ctaLabel = 'View order'
    vm.inboxType = 'success'
    await vm.handleSubmit()
    await flushPromises()

    expect(create).toHaveBeenCalledTimes(1)
    const [req] = create.mock.calls[0] as any[]
    expect(req.cta_url).toBe('https://ar-pay.store/orders/1')
    expect(req.cta_label).toBe('View order')
    expect(req.inbox_type).toBe('success')
  })

  it('omits the inbox-only fields for other channels', async () => {
    // The backend rejects unknown fields but still accepts cta_* for any
    // channel; keeping them off non-inbox payloads keeps the row honest.
    const wrapper = mountPage()
    await flushPromises()

    const vm = wrapper.vm as any
    vm.channel = 'sms'
    vm.templateKey = 'reminder'
    vm.name = 'Reminder'
    vm.body = 'Hi'
    vm.ctaUrl = 'https://should-not-be-sent'
    await vm.handleSubmit()
    await flushPromises()

    const [req] = create.mock.calls[0] as any[]
    expect(req).not.toHaveProperty('cta_url')
    expect(req).not.toHaveProperty('cta_label')
    expect(req).not.toHaveProperty('inbox_type')
  })

  it('sends only fields the strict backend binder models', async () => {
    const wrapper = mountPage()
    await flushPromises()

    const vm = wrapper.vm as any
    vm.channel = 'inbox'
    vm.templateKey = 'order_shipped'
    vm.name = 'Order shipped'
    vm.subject = 's'
    vm.body = 'b'
    vm.language = 'ar'
    await vm.handleSubmit()
    await flushPromises()

    const allowed = new Set([
      'template_key', 'channel', 'name', 'subject', 'body', 'mjml_source',
      'variables', 'is_active', 'preheader', 'category', 'sample_payload',
      'cta_url', 'cta_label', 'inbox_type',
    ])
    const [req] = create.mock.calls[0] as any[]
    expect(Object.keys(req).filter((k) => !allowed.has(k))).toEqual([])
    // `language` drives the key suffix; it is never a field on the wire.
    expect(req).not.toHaveProperty('language')
  })
})

describe('TemplateEditorPage — load path', () => {
  it('re-hydrates cta fields and derives language from the key suffix', async () => {
    routeParams = { id: '4' }
    get.mockResolvedValue({
      id: 4,
      template_key: 'order_shipped.ar-iq',
      channel: 'inbox',
      name: 'Order shipped',
      subject: 'Your order shipped',
      body: 'Track it now',
      variables: ['order_id'],
      is_active: true,
      cta_url: 'https://ar-pay.store/orders/1',
      cta_label: 'View order',
      inbox_type: 'success',
    })

    const wrapper = mountPage()
    await flushPromises()

    const vm = wrapper.vm as any
    expect(vm.ctaUrl).toBe('https://ar-pay.store/orders/1')
    expect(vm.ctaLabel).toBe('View order')
    expect(vm.inboxType).toBe('success')
    expect(vm.language).toBe('ar-iq')
  })

  it('renders rich-form variables as names, not [object Object]', async () => {
    routeParams = { id: '4' }
    get.mockResolvedValue({
      id: 4,
      template_key: 'reminder',
      channel: 'sms',
      name: 'Reminder',
      body: 'Hi {{first_name}}',
      variables: [
        { name: 'first_name', required: true },
        { name: 'order_id', required: false },
      ],
      is_active: true,
    })

    const wrapper = mountPage()
    await flushPromises()

    expect((wrapper.vm as any).variablesInput).toBe('first_name, order_id')
  })
})
