/**
 * EmailTemplateEditor save/load contract.
 *
 * The editor used to send 22 fields; the API bound 8 and silently dropped the
 * rest, so preheader / category / sample data came back empty on reload. The
 * load path was cast `as any`, which is precisely why the round-trip looked
 * plausible until you reloaded — TypeScript could not see the fields were never
 * arriving.
 *
 * These tests pin both halves: what goes out on save, and what is read back in.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { MessageTemplate } from '@/api/types'

// The rest parameters are load-bearing, not decoration: the store methods
// below forward their arguments into these spies, and a `vi.fn(() => ...)`
// declares a ZERO-argument signature, so `create(...a)` is a type error
// (TS2556) — and every `create.mock.calls[0]` assertion in this file is
// reading arguments the spy's own type says it can never receive.
const create = vi.fn((..._args: unknown[]) => Promise.resolve({ id: 9 }))
const update = vi.fn((..._args: unknown[]) => Promise.resolve({ id: 9 }))
const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ params: {}, query: {} }),
  // useUnsavedChanges registers a leave guard.
  onBeforeRouteLeave: vi.fn(),
}))

vi.mock('@/stores/templates', () => ({
  useTemplatesStore: () => ({
    create: (...a: unknown[]) => create(...a),
    update: (...a: unknown[]) => update(...a),
    get: vi.fn(),
  }),
}))

vi.mock('@/api/ai', () => ({
  fetchAIStatus: () => Promise.resolve({ enabled: false }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

// CodeEditor and VisualEditor are defineAsyncComponent(() => import(...)).
// A `stubs` entry replaces the rendered node but does not stop the dynamic
// import from executing, and codemirror / grapesjs blow up under happy-dom.
// Mock the modules so the import resolves to something inert.
vi.mock('../CodeEditor.vue', () => ({
  default: { name: 'CodeEditor', template: '<div />' },
}))
vi.mock('../VisualEditor.vue', () => ({
  default: { name: 'VisualEditor', template: '<div />' },
}))

import EmailTemplateEditor from '../EmailTemplateEditor.vue'

const stubs = {
  CodeEditor: true,
  VisualEditor: true,
  EmailPreview: true,
  VariablePanel: true,
  SampleDataEditor: true,
  ValidationPanel: true,
  TestSendPanel: true,
  EditorTabs: true,
  ActionBar: true,
  AISubjectLineModal: true,
  Bars3Icon: true,
  XMarkIcon: true,
  SparklesIcon: true,
}

const storedTemplate: MessageTemplate = {
  id: 9,
  template_key: 'welcome.ar-iq',
  channel: 'email',
  name: 'Welcome',
  subject: 'Hi {{first_name}}',
  body: '<html><body><p>hello {{order_id}}</p></body></html>',
  mjml_source: '',
  variables: ['first_name', 'order_id'],
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  preheader: 'Your account is ready and here is what happens next',
  category: 'marketing',
  sample_payload: { first_name: 'Zoe', order_id: 'AP-1' },
}

function mountEditor(initialTemplate: MessageTemplate | null = null) {
  return mount(EmailTemplateEditor, {
    props: {
      templateId: initialTemplate ? initialTemplate.id : undefined,
      initialTemplate,
    },
    global: { stubs, plugins: [createPinia()] },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  create.mockClear()
  update.mockClear()
  push.mockClear()
})

describe('EmailTemplateEditor — load path', () => {
  it('re-hydrates preheader, category and sample data from the server row', async () => {
    const wrapper = mountEditor(storedTemplate)
    await flushPromises()

    // Save without editing anything: the payload is a faithful mirror of what
    // was loaded, which is only true if the load actually read those fields.
    await (wrapper.vm as any).handleSave()
    await flushPromises()

    expect(update).toHaveBeenCalledTimes(1)
    const [, req] = update.mock.calls[0] as any[]
    expect(req.preheader).toBe('Your account is ready and here is what happens next')
    expect(req.category).toBe('marketing')
    expect(req.sample_payload).toEqual({ first_name: 'Zoe', order_id: 'AP-1' })
  })

  it('derives the language select from the template key suffix, not a column', async () => {
    const wrapper = mountEditor(storedTemplate)
    await flushPromises()
    expect((wrapper.vm as any).language).toBe('ar-iq')
  })

  it('leaves the language select empty for an unsuffixed key', async () => {
    const wrapper = mountEditor({ ...storedTemplate, template_key: 'welcome' })
    await flushPromises()
    expect((wrapper.vm as any).language).toBe('')
  })
})

describe('EmailTemplateEditor — save payload', () => {
  it('sends the fields the API persists', async () => {
    const wrapper = mountEditor(storedTemplate)
    await flushPromises()
    await (wrapper.vm as any).handleSave()
    await flushPromises()

    const [, req] = update.mock.calls[0] as any[]
    for (const key of [
      'template_key',
      'channel',
      'name',
      'subject',
      'body',
      'is_active',
      'preheader',
      'category',
      'sample_payload',
    ]) {
      expect(req).toHaveProperty(key)
    }
    expect(req.channel).toBe('email')
  })

  it('sends no field the backend would reject', async () => {
    // The API binds with DisallowUnknownFields now, so anything here that the
    // Go templateRequest does not model turns every save into a 400.
    const wrapper = mountEditor(storedTemplate)
    await flushPromises()
    await (wrapper.vm as any).handleSave()
    await flushPromises()

    const allowed = new Set([
      'template_key',
      'channel',
      'name',
      'subject',
      'body',
      'mjml_source',
      'variables',
      'is_active',
      'preheader',
      'category',
      'sample_payload',
      'cta_url',
      'cta_label',
      'inbox_type',
    ])
    const [, req] = update.mock.calls[0] as any[]
    const unknown = Object.keys(req).filter((k) => !allowed.has(k))
    expect(unknown).toEqual([])
  })

  it('no longer sends the removed sender-identity / tagging fields', async () => {
    const wrapper = mountEditor(storedTemplate)
    await flushPromises()
    await (wrapper.vm as any).handleSave()
    await flushPromises()

    const [, req] = update.mock.calls[0] as any[]
    for (const gone of [
      'from_name',
      'from_email',
      'reply_to',
      'html_body',
      'text_body',
      'tags',
      'editor_mode',
      'language',
    ]) {
      expect(req).not.toHaveProperty(gone)
    }
  })

  it('sends variables as a flat name array', async () => {
    const wrapper = mountEditor(storedTemplate)
    await flushPromises()
    await (wrapper.vm as any).handleSave()
    await flushPromises()

    const [, req] = update.mock.calls[0] as any[]
    expect(Array.isArray(req.variables)).toBe(true)
    for (const v of req.variables) {
      expect(typeof v).toBe('string')
    }
    expect(req.variables).toContain('first_name')
  })

  it('duplicate reuses the same payload builder, keeping mjml_source', async () => {
    // handleDuplicate used to build its own payload and had already drifted —
    // it omitted mjml_source, so duplicating a Visual template lost the MJML.
    const wrapper = mountEditor({ ...storedTemplate, mjml_source: '<mjml></mjml>' })
    await flushPromises()
    await (wrapper.vm as any).handleDuplicate()
    await flushPromises()

    expect(create).toHaveBeenCalledTimes(1)
    const [req] = create.mock.calls[0] as any[]
    expect(req.mjml_source).toBe('<mjml></mjml>')
    expect(req.template_key).toBe('welcome.ar-iq_copy')
    expect(req.is_active).toBe(false)
    expect(req.preheader).toBe('Your account is ready and here is what happens next')
  })
})
