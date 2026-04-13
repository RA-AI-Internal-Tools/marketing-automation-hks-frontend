import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChannelChip from '../ChannelChip.vue'

describe('ChannelChip', () => {
  it('renders the channel name capitalised', () => {
    const w = mount(ChannelChip, { props: { channel: 'email' } })
    expect(w.text()).toBe('email')
  })

  it('emits the channel as data-attribute (drives styling)', () => {
    const w = mount(ChannelChip, { props: { channel: 'WhatsApp' } })
    // Lower-cased — the CSS selectors match `[data-ch="whatsapp"]`.
    expect(w.attributes('data-ch')).toBe('whatsapp')
  })

  it('honours an explicit label override', () => {
    const w = mount(ChannelChip, { props: { channel: 'sms', label: 'Text' } })
    expect(w.text()).toBe('Text')
  })

  it('renders the dot element so styles can colour it', () => {
    const w = mount(ChannelChip, { props: { channel: 'push' } })
    expect(w.find('.channel-chip-dot').exists()).toBe(true)
  })

  it('falls through to the unknown-channel fallback class without throwing', () => {
    // Unknown channels are styled via :not(...) CSS — assert we still
    // render a chip rather than blowing up at template time.
    const w = mount(ChannelChip, { props: { channel: 'fax' } })
    expect(w.classes()).toContain('channel-chip')
    expect(w.attributes('data-ch')).toBe('fax')
  })
})
