import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Tooltip from '../Tooltip.vue'

describe('Tooltip', () => {
  it('renders tooltip text inside a role=tooltip span', () => {
    const w = mount(Tooltip, {
      props: { text: 'help me' },
      slots: { default: '<button>?</button>' },
    })
    const tip = w.find('[role="tooltip"]')
    expect(tip.exists()).toBe(true)
    expect(tip.text()).toBe('help me')
  })

  it('renders the trigger slot', () => {
    const w = mount(Tooltip, {
      props: { text: 'x' },
      slots: { default: '<button>click</button>' },
    })
    expect(w.find('button').text()).toBe('click')
  })

  it('connects the tooltip to the wrapper via aria-describedby', () => {
    const w = mount(Tooltip, {
      props: { text: 'x' },
      slots: { default: '<button>?</button>' },
    })
    const wrapperId = w.attributes('aria-describedby')
    const tip = w.find('[role="tooltip"]')
    // Wrapper aria-describedby must reference the tooltip's id so
    // screen readers attach the help text to the trigger.
    expect(wrapperId).toBeTruthy()
    expect(tip.attributes('id')).toBe(wrapperId)
  })

  it('honours an explicit placement prop', () => {
    const w = mount(Tooltip, {
      props: { text: 'x', placement: 'right' },
      slots: { default: '<button>?</button>' },
    })
    expect(w.find('[role="tooltip"]').attributes('data-placement')).toBe('right')
  })

  it('defaults to top placement when none supplied', () => {
    const w = mount(Tooltip, {
      props: { text: 'x' },
      slots: { default: '<button>?</button>' },
    })
    expect(w.find('[role="tooltip"]').attributes('data-placement')).toBe('top')
  })
})
