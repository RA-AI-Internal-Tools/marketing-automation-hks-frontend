import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBadge from '../StatusBadge.vue'
import { LOG_STATUSES } from '@/constants/logStatus'

// The literal fallback triple from StatusBadge.vue — a status hits this
// exactly when it has no entry in `statusConfig`. Asserting against the
// fallback directly (rather than just "is it grey") is what makes the
// mutation test below meaningful: `skipped` and `condition_not_met` are
// also grey/muted by deliberate design, but via their OWN statusConfig
// entry, not by falling through. Only the fallback also uses
// text-secondary for the label, which no real entry uses.
const FALLBACK_TEXT_CLASS = 'text-[var(--color-text-secondary)]'

describe('StatusBadge', () => {
  it('renders a known status with its configured colour classes', () => {
    const w = mount(StatusBadge, { props: { status: 'sent' } })
    expect(w.classes()).toContain('bg-[var(--color-success-bg)]')
    expect(w.classes()).toContain('text-[var(--color-success-text)]')
  })

  it('renders unknown statuses via the neutral fallback without throwing', () => {
    const w = mount(StatusBadge, { props: { status: 'totally_unrecognised_status' } })
    expect(w.classes()).toContain(FALLBACK_TEXT_CLASS)
  })

  it('formats the label by replacing underscores with spaces', () => {
    const w = mount(StatusBadge, { props: { status: 'quiet_hour_deferred' } })
    expect(w.text()).toBe('quiet hour deferred')
  })

  describe('gate_unavailable', () => {
    it('does not fall back to the default (would indicate a missing statusConfig entry)', () => {
      const w = mount(StatusBadge, { props: { status: 'gate_unavailable' } })
      expect(w.classes()).not.toContain(FALLBACK_TEXT_CLASS)
    })

    it('is visually distinct from skipped (must not read as "deliberate no-op")', () => {
      const gateUnavailable = mount(StatusBadge, { props: { status: 'gate_unavailable' } })
      const skipped = mount(StatusBadge, { props: { status: 'skipped' } })
      expect(gateUnavailable.classes()).not.toEqual(skipped.classes())
    })

    it('is visually distinct from failed (nothing is wrong with the campaign)', () => {
      const gateUnavailable = mount(StatusBadge, { props: { status: 'gate_unavailable' } })
      const failed = mount(StatusBadge, { props: { status: 'failed' } })
      expect(gateUnavailable.classes()).not.toEqual(failed.classes())
    })

    it('is visually distinct from the other gate-declined-the-send statuses (frequency_capped, no_consent, quiet_hour_deferred)', () => {
      // These are policy outcomes ("the gate ran and said no"); gate_unavailable
      // means the gate never ran at all. Reusing their warning/amber colour
      // would recreate the original conflation one layer up, in the UI.
      const gateUnavailable = mount(StatusBadge, { props: { status: 'gate_unavailable' } })
      for (const policyStatus of ['frequency_capped', 'no_consent', 'quiet_hour_deferred']) {
        const w = mount(StatusBadge, { props: { status: policyStatus } })
        expect(gateUnavailable.classes()).not.toEqual(w.classes())
      }
    })

    it('renders the expected info/blue token set', () => {
      const w = mount(StatusBadge, { props: { status: 'gate_unavailable' } })
      expect(w.classes()).toContain('bg-[var(--color-info-bg)]')
      expect(w.classes()).toContain('text-[var(--color-info-text)]')
      expect(w.find('span span').classes()).toContain('bg-[var(--color-info)]')
    })
  })

  // Non-vacuity guard: every status the backend can actually write to a
  // CampaignLog (LOG_STATUSES, the same list that drives the LogsPage
  // filter) must resolve to a real statusConfig entry, not the fallback.
  // This is what fails loudly if a future LogStatus is added to the
  // filter/backend but forgotten in StatusBadge — the exact shape of the
  // gate_unavailable gap this test suite closes.
  it('gives every LogStatus in LOG_STATUSES a real (non-fallback) colour', () => {
    for (const { value } of LOG_STATUSES) {
      const w = mount(StatusBadge, { props: { status: value } })
      expect(w.classes(), `status "${value}" fell back to the default styling`).not.toContain(FALLBACK_TEXT_CLASS)
    }
  })
})
