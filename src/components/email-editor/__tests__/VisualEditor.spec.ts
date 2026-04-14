/**
 * VisualEditor — GrapesJS wrapper spec.
 *
 * GrapesJS is a ~300 KB canvas editor with DOM coupling that happy-dom
 * can't satisfy, so we mock the module at import level with a shape-
 * compatible stub. We assert on the stub to verify wiring.
 *
 * The Code ↔ Visual mode toggle lives in the parent `EmailTemplateEditor`,
 * not in `VisualEditor` itself — so that assertion is covered against
 * the parent's markup presence instead of a real tab interaction
 * (flagged as a deviation in the sprint report).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

const editorStub = {
  setComponents: vi.fn(),
  getHtml: vi.fn(() => '<mjml></mjml>'),
  BlockManager: { add: vi.fn() },
  on: vi.fn(),
  destroy: vi.fn(),
}

vi.mock('grapesjs', () => ({
  default: { init: vi.fn(() => editorStub) },
}))
vi.mock('grapesjs-mjml', () => ({ default: {} }))
vi.mock('grapesjs/dist/css/grapes.min.css', () => ({}))

import grapesjs from 'grapesjs'
import VisualEditor from '../VisualEditor.vue'

describe('VisualEditor', () => {
  beforeEach(() => {
    ;(grapesjs as any).init.mockClear()
    editorStub.setComponents.mockClear()
    editorStub.BlockManager.add.mockClear()
    editorStub.on.mockClear()
    editorStub.destroy.mockClear()
  })

  it('initialises GrapesJS on mount and renders the container element', () => {
    const w = mount(VisualEditor, { props: { modelValue: '' } })
    expect(w.find('.ma-visual-editor').exists()).toBe(true)
    expect((grapesjs as any).init).toHaveBeenCalledTimes(1)
    // Initial MJML should be seeded (default fallback since modelValue is empty).
    expect(editorStub.setComponents).toHaveBeenCalledTimes(1)
    const seed = editorStub.setComponents.mock.calls[0][0]
    expect(String(seed)).toContain('<mjml>')
  })

  it('registers the MA custom blocks (cart loop, dynamic content, recommended products)', () => {
    mount(VisualEditor, { props: { modelValue: '' } })
    const ids = editorStub.BlockManager.add.mock.calls.map((c: any[]) => c[0])
    expect(ids).toEqual(expect.arrayContaining([
      'ma-product-loop',
      'ma-dynamic-content',
      'ma-recommended-products',
    ]))
  })

  it('wires an update listener that feeds the v-model', () => {
    const w = mount(VisualEditor, { props: { modelValue: '' } })
    const [evt, cb] = editorStub.on.mock.calls[0]
    expect(evt).toBe('update')
    // Trigger the registered callback; the component should emit update:modelValue.
    cb()
    const emitted = w.emitted('update:modelValue')
    expect(emitted?.[0]?.[0]).toBe('<mjml></mjml>')
  })

  it('seeds setComponents with the supplied MJML when modelValue is non-empty', () => {
    mount(VisualEditor, { props: { modelValue: '<mjml data-test="seed"></mjml>' } })
    expect(editorStub.setComponents).toHaveBeenCalledWith('<mjml data-test="seed"></mjml>')
  })

  it('destroys the editor on unmount', () => {
    const w = mount(VisualEditor, { props: { modelValue: '' } })
    w.unmount()
    expect(editorStub.destroy).toHaveBeenCalled()
  })
})
