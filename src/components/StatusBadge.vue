<script setup lang="ts">
defineProps<{ status: string }>()

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
  failed: { bg: 'bg-[var(--color-error-bg)]', text: 'text-[var(--color-error-text)]', dot: 'bg-[var(--color-error)]' },
  // ─── Skip / deferred variants ─────────────────────────────────────────
  // Distinct from terminal failures: nothing was sent and nothing went
  // wrong; either policy or environment held the message back.
  skipped: { bg: 'bg-[var(--color-bg-subtle)]', text: 'text-[var(--color-text-tertiary)]', dot: 'bg-[var(--color-text-muted)]' },
  frequency_capped: { bg: 'bg-[var(--color-warning-bg)]', text: 'text-[var(--color-warning-text)]', dot: 'bg-[var(--color-warning)]' },
  no_consent: { bg: 'bg-[var(--color-warning-bg)]', text: 'text-[var(--color-warning-text)]', dot: 'bg-[var(--color-warning)]' },
  condition_not_met: { bg: 'bg-[var(--color-bg-subtle)]', text: 'text-[var(--color-text-tertiary)]', dot: 'bg-[var(--color-text-muted)]' },
  quiet_hour_deferred: { bg: 'bg-[var(--color-warning-bg)]', text: 'text-[var(--color-warning-text)]', dot: 'bg-[var(--color-warning)]' },
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
  // ─── Broadcast lifecycle ──────────────────────────────────────────────
  // draft → scheduled → running → completed (terminal). `cancelled` and
  // `failed` are terminal negatives already covered above.
  draft: { bg: 'bg-[var(--color-bg-subtle)]', text: 'text-[var(--color-text-tertiary)]', dot: 'bg-[var(--color-text-muted)]' },
  scheduled: { bg: 'bg-[var(--color-info-bg)]', text: 'text-[var(--color-info-text)]', dot: 'bg-[var(--color-info)]' },
  running: { bg: 'bg-[var(--color-success-bg)]', text: 'text-[var(--color-success-text)]', dot: 'bg-[var(--color-success)]' },
}

const fallback = { bg: 'bg-[var(--color-bg-subtle)]', text: 'text-[var(--color-text-secondary)]', dot: 'bg-[var(--color-text-muted)]' }
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize"
    :class="[(statusConfig[status] || fallback).bg, (statusConfig[status] || fallback).text]"
  >
    <span class="h-1.5 w-1.5 rounded-full" :class="(statusConfig[status] || fallback).dot"></span>
    {{ status.replace(/_/g, ' ') }}
  </span>
</template>
