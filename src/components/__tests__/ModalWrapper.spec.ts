import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ModalWrapper from '../ModalWrapper.vue'

// ModalWrapper Teleports to document.body — keep a clean body between tests
// so stale DOM doesn't leak into the next assertion.
function cleanBody() {
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild)
  document.body.style.overflow = ''
}

describe('ModalWrapper', () => {
  beforeEach(cleanBody)
  afterEach(cleanBody)

  it('renders title and body slot when open', async () => {
    mount(ModalWrapper, {
      props: { modelValue: true, title: 'Edit widget' },
      slots: { body: '<div data-test="inner">body content</div>' },
      attachTo: document.body,
    })
    await flushPromises()
    expect(document.body.textContent).toContain('Edit widget')
    expect(document.body.querySelector('[data-test="inner"]')).toBeTruthy()
  })

  it('emits update:modelValue(false) + close on Escape', async () => {
    const wrapper = mount(ModalWrapper, {
      props: { modelValue: true, title: 'X' },
      slots: { body: '<div>body</div>' },
      attachTo: document.body,
    })
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('closes on backdrop click by default', async () => {
    const wrapper = mount(ModalWrapper, {
      props: { modelValue: true, title: 'X' },
      slots: { body: '<div>body</div>' },
      attachTo: document.body,
    })
    await flushPromises()
    const scrim = document.body.querySelector('.mw-scrim') as HTMLElement
    scrim.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('does not close on backdrop click when closeOnBackdrop is false', async () => {
    const wrapper = mount(ModalWrapper, {
      props: { modelValue: true, title: 'X', closeOnBackdrop: false },
      slots: { body: '<div>body</div>' },
      attachTo: document.body,
    })
    await flushPromises()
    const scrim = document.body.querySelector('.mw-scrim') as HTMLElement
    scrim.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(wrapper.emitted('close')).toBeFalsy()
  })
})
