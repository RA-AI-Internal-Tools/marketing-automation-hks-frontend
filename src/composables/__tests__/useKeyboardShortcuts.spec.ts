import { describe, it, expect, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useKeyboardShortcuts, shortcutRegistry } from '../useKeyboardShortcuts'

function dispatchKey(key: string, target: EventTarget = document) {
  const evt = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  target.dispatchEvent(evt)
  return evt
}

describe('useKeyboardShortcuts', () => {
  afterEach(() => {
    // Paranoia: drain the registry between tests in case a component didn't unmount.
    shortcutRegistry.list.length = 0
  })

  it('invokes the registered handler on matching key', () => {
    let fired = 0
    const Probe = defineComponent({
      setup() {
        useKeyboardShortcuts([
          { key: 'n', handler: () => { fired++ }, description: 'New' },
        ])
        return () => h('div')
      },
    })
    const w = mount(Probe, { attachTo: document.body })
    dispatchKey('n')
    expect(fired).toBe(1)
    w.unmount()
  })

  it('ignores keys typed inside an input', () => {
    let fired = 0
    const Probe = defineComponent({
      setup() {
        useKeyboardShortcuts([
          { key: 'n', handler: () => { fired++ }, description: 'New' },
        ])
        return () => h('input', { id: 'field' })
      },
    })
    const w = mount(Probe, { attachTo: document.body })
    const input = document.getElementById('field')!
    dispatchKey('n', input)
    expect(fired).toBe(0)
    w.unmount()
  })

  it('registers and deregisters in the shared registry on mount/unmount', () => {
    const Probe = defineComponent({
      setup() {
        useKeyboardShortcuts([
          { key: 'x', handler: () => {}, description: 'Thing' },
        ])
        return () => h('div')
      },
    })
    const w = mount(Probe, { attachTo: document.body })
    expect(shortcutRegistry.list.some((s) => s.key === 'x')).toBe(true)
    w.unmount()
    expect(shortcutRegistry.list.some((s) => s.key === 'x')).toBe(false)
  })
})
