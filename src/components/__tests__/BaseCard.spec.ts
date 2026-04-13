import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseCard from '../BaseCard.vue'

describe('BaseCard', () => {
  it('renders default surface card class', () => {
    const w = mount(BaseCard, { slots: { default: '<p>hi</p>' } })
    expect(w.classes()).toContain('base-card')
    expect(w.text()).toContain('hi')
  })

  it('applies the flush variant when flush=true', () => {
    const w = mount(BaseCard, { props: { flush: true } })
    expect(w.classes()).toContain('base-card--flush')
  })

  it('applies card-interactive when interactive=true', () => {
    const w = mount(BaseCard, { props: { interactive: true } })
    expect(w.classes()).toContain('card-interactive')
  })

  it('does not apply variant classes by default', () => {
    const w = mount(BaseCard)
    expect(w.classes()).not.toContain('base-card--flush')
    expect(w.classes()).not.toContain('card-interactive')
  })
})
