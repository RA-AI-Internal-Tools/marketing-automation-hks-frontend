import { describe, it, expect } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import EmptyState from '../EmptyState.vue'

describe('EmptyState', () => {
  it('renders title only when nothing else supplied', () => {
    const w = mount(EmptyState, { props: { title: 'Nothing to show' } })
    expect(w.text()).toContain('Nothing to show')
    expect(w.find('.empty-state-description').exists()).toBe(false)
    expect(w.find('.empty-state-action').exists()).toBe(false)
  })

  it('renders description when provided', () => {
    const w = mount(EmptyState, {
      props: { title: 'No campaigns', description: 'Build your first.' },
    })
    expect(w.find('.empty-state-description').text()).toBe('Build your first.')
  })

  it('renders the action slot only when content is supplied', () => {
    const w = mount(EmptyState, {
      props: { title: 'Empty' },
      slots: { action: '<button>Create</button>' },
    })
    expect(w.find('.empty-state-action').exists()).toBe(true)
    expect(w.find('button').text()).toBe('Create')
  })

  it('renders the icon component when provided', () => {
    // Tiny stand-in component — proves the dynamic <component :is> path,
    // doesn't depend on the real Heroicons import shape.
    const Icon = { render: () => h('svg', { 'data-test': 'icon' }) }
    const w = mount(EmptyState, { props: { title: 'x', icon: Icon as any } })
    expect(w.find('[data-test="icon"]').exists()).toBe(true)
  })
})
