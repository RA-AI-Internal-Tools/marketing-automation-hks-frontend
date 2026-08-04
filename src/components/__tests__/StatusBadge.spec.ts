import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBadge from '../StatusBadge.vue'
import { LOG_STATUSES, LOG_STATUS_LABELS, logStatusLabel } from '@/constants/logStatus'

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

  it('takes a LogStatus label from the shared vocabulary, verbatim', () => {
    // Was `expect(w.text()).toBe('quiet hour deferred')` — the badge derived
    // its own display text with replace(/_/g,' ') and leaned on CSS
    // `capitalize`, so it disagreed with logStatusLabel() in the DOM while
    // looking identical on screen. Asserting against the vocabulary is what
    // makes a label like 'Freq. Capped' impossible to introduce on one
    // surface only.
    const w = mount(StatusBadge, { props: { status: 'quiet_hour_deferred' } })
    expect(w.text()).toBe(logStatusLabel('quiet_hour_deferred'))
    expect(w.text()).toBe('Quiet Hour Deferred')
    // Curated labels render exactly as authored — no CSS transform on top.
    expect(w.classes()).not.toContain('capitalize')
  })

  it('keeps the underscores-to-spaces fallback for non-LogStatus vocabularies', () => {
    // `in_flight` is an outbound-webhook delivery state, not a LogStatus:
    // no curated label exists, so the historical derivation (plus CSS
    // capitalize to title it) must survive.
    expect('in_flight' in LOG_STATUS_LABELS).toBe(false)
    const w = mount(StatusBadge, { props: { status: 'in_flight' } })
    expect(w.text()).toBe('in flight')
    expect(w.classes()).toContain('capitalize')
  })

  it('does not regress the non-LogStatus values it also renders', () => {
    // Enrollment / broadcast / integration / health vocabularies that share
    // this widget. Enumerated from statusConfig; each must still render its
    // own name, not fall through to something else.
    const cases: Record<string, string> = {
      active: 'active',
      completed: 'completed',
      cancelled: 'cancelled',
      expired: 'expired',
      waiting: 'waiting',
      up: 'up',
      down: 'down',
      degraded: 'degraded',
      inactive: 'inactive',
      ok: 'ok',
      disabled: 'disabled',
      pending: 'pending',
      connected: 'connected',
      not_configured: 'not configured',
      configured: 'configured',
      misconfigured: 'misconfigured',
      error: 'error',
      processing: 'processing',
      in_flight: 'in flight',
      retrying: 'retrying',
      paused: 'paused',
      draft: 'draft',
      scheduled: 'scheduled',
      running: 'running',
    }
    for (const [status, expected] of Object.entries(cases)) {
      // Tripwire: if one of these is ever promoted into LOG_STATUSES it
      // acquires a curated label and belongs in the vocabulary test
      // instead, not in this raw-derivation list.
      expect(
        status in LOG_STATUS_LABELS,
        `"${status}" is now a LogStatus — move it out of this fallback list`,
      ).toBe(false)
      const w = mount(StatusBadge, { props: { status } })
      expect(w.text(), `non-LogStatus "${status}" changed its rendered text`).toBe(expected)
      expect(w.classes(), `non-LogStatus "${status}" lost its statusConfig colour`).not.toContain(
        FALLBACK_TEXT_CLASS,
      )
    }
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
