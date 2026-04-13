import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ErrorState from '../ErrorState.vue'

describe('ErrorState', () => {
  it('renders the error message and an alert role', () => {
    const w = mount(ErrorState, { props: { message: 'oops' } })
    expect(w.attributes('role')).toBe('alert')
    expect(w.text()).toContain('oops')
  })

  it('hides the retry button by default', () => {
    const w = mount(ErrorState, { props: { message: 'x' } })
    expect(w.find('.error-state-retry').exists()).toBe(false)
  })

  it('shows the retry button when retryable + emits retry on click', async () => {
    const w = mount(ErrorState, { props: { message: 'x', retryable: true } })
    const btn = w.find('.error-state-retry')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
  })
})
