<script setup lang="ts">
import { computed } from 'vue'
import { LOG_STATUS_LABELS, logStatusLabel } from '@/constants/logStatus'

const props = defineProps<{ status: string }>()

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-[var(--color-success-bg)]', text: 'text-[var(--color-success-text)]', dot: 'bg-[var(--color-success)]' },
  completed: { bg: 'bg-[var(--color-info-bg)]', text: 'text-[var(--color-info-text)]', dot: 'bg-[var(--color-info)]' },
  cancelled: { bg: 'bg-[var(--color-bg-subtle)]', text: 'text-[var(--color-text-tertiary)]', dot: 'bg-[var(--color-text-muted)]' },
  expired: { bg: 'bg-[var(--color-warning-bg)]', text: 'text-[var(--color-warning-text)]', dot: 'bg-[var(--color-warning)]' },
  // ─── LogStatus* — must stay in sync with internal/model/campaign.go ───
  // Lifecycle progression: sent → delivered → opened → clicked. Each step
  // gets its own colour so a glance at the table immediately shows where
  // value lands. Bounced/complaint/failed are negative terminal states and
  // get error red so they can't be confused with the muted-grey "skipped"
  // class.
  sent: { bg: 'bg-[var(--color-success-bg)]', text: 'text-[var(--color-success-text)]', dot: 'bg-[var(--color-success)]' },
  delivered: { bg: 'bg-[var(--color-success-bg)]', text: 'text-[var(--color-success-text)]', dot: 'bg-[var(--color-success)]' },
  opened: { bg: 'bg-[var(--color-info-bg)]', text: 'text-[var(--color-info-text)]', dot: 'bg-[var(--color-info)]' },
  clicked: { bg: 'bg-[var(--color-info-bg)]', text: 'text-[var(--color-info-text)]', dot: 'bg-[var(--color-info)]' },
  bounced: { bg: 'bg-[var(--color-error-bg)]', text: 'text-[var(--color-error-text)]', dot: 'bg-[var(--color-error)]' },
  complaint: { bg: 'bg-[var(--color-error-bg)]', text: 'text-[var(--color-error-text)]', dot: 'bg-[var(--color-error)]' },
  // `unsubscribed` is a provider-reported opt-out signal. Amber rather than
  // error red — it's the user's explicit choice, not a delivery failure.
  unsubscribed: { bg: 'bg-[var(--color-warning-bg)]', text: 'text-[var(--color-warning-text)]', dot: 'bg-[var(--color-warning)]' },
  failed: { bg: 'bg-[var(--color-error-bg)]', text: 'text-[var(--color-error-text)]', dot: 'bg-[var(--color-error)]' },
  // ─── Skip / deferred variants ─────────────────────────────────────────
  // Distinct from terminal failures: nothing was sent and nothing went
  // wrong; either policy or environment held the message back.
  skipped: { bg: 'bg-[var(--color-bg-subtle)]', text: 'text-[var(--color-text-tertiary)]', dot: 'bg-[var(--color-text-muted)]' },
  frequency_capped: { bg: 'bg-[var(--color-warning-bg)]', text: 'text-[var(--color-warning-text)]', dot: 'bg-[var(--color-warning)]' },
  no_consent: { bg: 'bg-[var(--color-warning-bg)]', text: 'text-[var(--color-warning-text)]', dot: 'bg-[var(--color-warning)]' },
  condition_not_met: { bg: 'bg-[var(--color-bg-subtle)]', text: 'text-[var(--color-text-tertiary)]', dot: 'bg-[var(--color-text-muted)]' },
  quiet_hour_deferred: { bg: 'bg-[var(--color-warning-bg)]', text: 'text-[var(--color-warning-text)]', dot: 'bg-[var(--color-warning)]' },
  // `gate_unavailable`: the frequency-cap/consent/condition gate could not
  // be *evaluated* (Redis blip, store error) — as opposed to the gate
  // running and declining the send. Deliberately NOT grey: grey means
  // "nothing wrong, policy or environment held it back on purpose" and
  // this is an infra blind spot that may warrant investigation. Also
  // deliberately NOT the warning/amber used by frequency_capped/
  // no_consent/quiet_hour_deferred just above — reusing that colour
  // would recreate, one layer up, exactly the conflation this status
  // was created to eliminate (an infra failure reading as a policy
  // outcome). NOT error/red either: the campaign itself isn't broken,
  // only the gate check is. Info/blue is otherwise unused by any
  // skip/deferred LogStatus, so it reads as its own category.
  gate_unavailable: { bg: 'bg-[var(--color-info-bg)]', text: 'text-[var(--color-info-text)]', dot: 'bg-[var(--color-info)]' },
  // ─── EnrollmentStatus — `waiting` covers G6 wait-for-event holds ─────
  waiting: { bg: 'bg-[var(--color-info-bg)]', text: 'text-[var(--color-info-text)]', dot: 'bg-[var(--color-info)]' },
  up: { bg: 'bg-[var(--color-success-bg)]', text: 'text-[var(--color-success-text)]', dot: 'bg-[var(--color-success)]' },
  down: { bg: 'bg-[var(--color-error-bg)]', text: 'text-[var(--color-error-text)]', dot: 'bg-[var(--color-error)]' },
  degraded: { bg: 'bg-[var(--color-warning-bg)]', text: 'text-[var(--color-warning-text)]', dot: 'bg-[var(--color-warning)]' },
  inactive: { bg: 'bg-[var(--color-bg-subtle)]', text: 'text-[var(--color-text-tertiary)]', dot: 'bg-[var(--color-text-muted)]' },
  ok: { bg: 'bg-[var(--color-success-bg)]', text: 'text-[var(--color-success-text)]', dot: 'bg-[var(--color-success)]' },
  disabled: { bg: 'bg-[var(--color-bg-subtle)]', text: 'text-[var(--color-text-tertiary)]', dot: 'bg-[var(--color-text-muted)]' },
  pending: { bg: 'bg-[var(--color-warning-bg)]', text: 'text-[var(--color-warning-text)]', dot: 'bg-[var(--color-warning)]' },
  connected: { bg: 'bg-[var(--color-success-bg)]', text: 'text-[var(--color-success-text)]', dot: 'bg-[var(--color-success)]' },
  not_configured: { bg: 'bg-[var(--color-bg-subtle)]', text: 'text-[var(--color-text-tertiary)]', dot: 'bg-[var(--color-text-muted)]' },
  configured: { bg: 'bg-[var(--color-info-bg)]', text: 'text-[var(--color-info-text)]', dot: 'bg-[var(--color-info)]' },
  misconfigured: { bg: 'bg-[var(--color-warning-bg)]', text: 'text-[var(--color-warning-text)]', dot: 'bg-[var(--color-warning)]' },
  error: { bg: 'bg-[var(--color-error-bg)]', text: 'text-[var(--color-error-text)]', dot: 'bg-[var(--color-error)]' },
  processing: { bg: 'bg-[var(--color-info-bg)]', text: 'text-[var(--color-info-text)]', dot: 'bg-[var(--color-info)]' },
  // `queued` is the in-flight Sprint-3 status — JetStream-published, awaiting
  // worker dispatch. Amber distinguishes it from terminal sent (green) and
  // from the no-action "deferred" warnings.
  queued: { bg: 'bg-[var(--color-warning-bg)]', text: 'text-[var(--color-warning-text)]', dot: 'bg-[var(--color-warning)]' },
  // ─── Outbound webhook delivery states ─────────────────────────────────
  // `in_flight` is the transient "worker picked it up, awaiting HTTP
  // response" status — treat it as neutral/info so operators don't
  // conflate it with terminal failure. `retrying` is amber: the delivery
  // hit a non-2xx, but the worker is backing off and will try again.
  in_flight: { bg: 'bg-[var(--color-info-bg)]', text: 'text-[var(--color-info-text)]', dot: 'bg-[var(--color-info)]' },
  retrying: { bg: 'bg-[var(--color-warning-bg)]', text: 'text-[var(--color-warning-text)]', dot: 'bg-[var(--color-warning)]' },
  paused: { bg: 'bg-[var(--color-bg-subtle)]', text: 'text-[var(--color-text-tertiary)]', dot: 'bg-[var(--color-text-muted)]' },
  // ─── Broadcast lifecycle ──────────────────────────────────────────────
  // draft → scheduled → running → completed (terminal). `cancelled` and
  // `failed` are terminal negatives already covered above.
  draft: { bg: 'bg-[var(--color-bg-subtle)]', text: 'text-[var(--color-text-tertiary)]', dot: 'bg-[var(--color-text-muted)]' },
  scheduled: { bg: 'bg-[var(--color-info-bg)]', text: 'text-[var(--color-info-text)]', dot: 'bg-[var(--color-info)]' },
  running: { bg: 'bg-[var(--color-success-bg)]', text: 'text-[var(--color-success-text)]', dot: 'bg-[var(--color-success)]' },
}

const fallback = { bg: 'bg-[var(--color-bg-subtle)]', text: 'text-[var(--color-text-secondary)]', dot: 'bg-[var(--color-text-muted)]' }

const cfg = computed(() => statusConfig[props.status] || fallback)

// This component renders three separate vocabularies through one widget:
// the campaign_logs LogStatus set, the enrollment/broadcast/integration
// lifecycle values (`active`, `draft`, `in_flight`, `scheduled`, ...) and
// the health values (`up`, `down`, `degraded`). Only the first has an
// owner — src/constants/logStatus.ts — and this is the app's highest-
// impression status surface (LogsPage rows, ClientJourneyPage, the
// Overview recent-logs list).
//
// The template used to derive its own text with `status.replace(/_/g,' ')`
// plus CSS `capitalize`. That was a SECOND derivation of LogStatus display
// text, and it only looked correct because every label in LOG_STATUSES
// currently happens to be the title-case of its own snake_case value. The
// two already disagreed in the DOM ('quiet hour deferred' here vs
// 'Quiet Hour Deferred' everywhere else); give any status a label that is
// not its own title-case — 'Freq. Capped', 'SMS Opt-Out' — and this badge
// and the Channels row would print different names for the same status
// with nothing failing.
const isLogStatus = computed(() => props.status in LOG_STATUS_LABELS)

// A curated LogStatus label is rendered EXACTLY as authored, so CSS
// `capitalize` is applied only on the non-LogStatus path, where the
// underscores-to-spaces fallback still needs it to read as a title.
const label = computed(() =>
  isLogStatus.value ? logStatusLabel(props.status) : props.status.replace(/_/g, ' '),
)
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
    :class="[cfg.bg, cfg.text, { capitalize: !isLogStatus }]"
  >
    <span class="h-1.5 w-1.5 rounded-full" :class="cfg.dot"></span>
    {{ label }}
  </span>
</template>
