import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DegradedNotice from '../DegradedNotice.vue'

describe('DegradedNotice', () => {
  it('names the affected figures and says they are not zero', () => {
    const w = mount(DegradedNotice, {
      props: { source: 'crm', affects: 'Revenue and order counts' },
    })
    expect(w.text()).toContain('Revenue and order counts could not be loaded')
    // The distinction the component exists to make.
    expect(w.text()).toContain('they are not zero')
  })

  it('names the CRM as the unreachable source', () => {
    const w = mount(DegradedNotice, { props: { source: 'crm', affects: 'X' } })
    expect(w.text()).toContain('the CRM database')
    expect(w.text()).not.toContain('Tracardi')
  })

  it('names Tracardi as the unreachable source', () => {
    const w = mount(DegradedNotice, { props: { source: 'tracardi', affects: 'X' } })
    expect(w.text()).toContain('the Tracardi event store')
    expect(w.text()).not.toContain('CRM')
  })

  it('scopes the claim so untouched widgets keep their credibility', () => {
    // A page-level "everything is broken" banner would overstate a response
    // that degraded by halves; the copy has to say so.
    const w = mount(DegradedNotice, { props: { source: 'crm', affects: 'X' } })
    expect(w.text()).toContain('Everything else on this page is unaffected')
  })

  it('uses role="status", distinguishing it from ErrorState\'s role="alert"', () => {
    // Degradation is a warning over still-rendered content, not a hard
    // failure that replaced it — and tests rely on telling the two apart.
    const w = mount(DegradedNotice, { props: { source: 'crm', affects: 'X' } })
    expect(w.attributes('role')).toBe('status')
  })
})
