<script setup lang="ts">
defineProps<{ status: string }>()

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-[var(--color-success-bg)]', text: 'text-[var(--color-success-text)]', dot: 'bg-[var(--color-success)]' },
  completed: { bg: 'bg-[var(--color-info-bg)]', text: 'text-[var(--color-info-text)]', dot: 'bg-[var(--color-info)]' },
  cancelled: { bg: 'bg-[var(--color-bg-subtle)]', text: 'text-[var(--color-text-tertiary)]', dot: 'bg-[var(--color-text-muted)]' },
  expired: { bg: 'bg-[var(--color-warning-bg)]', text: 'text-[var(--color-warning-text)]', dot: 'bg-[var(--color-warning)]' },
  sent: { bg: 'bg-[var(--color-success-bg)]', text: 'text-[var(--color-success-text)]', dot: 'bg-[var(--color-success)]' },
  failed: { bg: 'bg-[var(--color-error-bg)]', text: 'text-[var(--color-error-text)]', dot: 'bg-[var(--color-error)]' },
  skipped: { bg: 'bg-[var(--color-bg-subtle)]', text: 'text-[var(--color-text-tertiary)]', dot: 'bg-[var(--color-text-muted)]' },
  frequency_capped: { bg: 'bg-[var(--color-warning-bg)]', text: 'text-[var(--color-warning-text)]', dot: 'bg-[var(--color-warning)]' },
  no_consent: { bg: 'bg-[var(--color-warning-bg)]', text: 'text-[var(--color-warning-text)]', dot: 'bg-[var(--color-warning)]' },
  condition_not_met: { bg: 'bg-[var(--color-bg-subtle)]', text: 'text-[var(--color-text-tertiary)]', dot: 'bg-[var(--color-text-muted)]' },
  up: { bg: 'bg-[var(--color-success-bg)]', text: 'text-[var(--color-success-text)]', dot: 'bg-[var(--color-success)]' },
  down: { bg: 'bg-[var(--color-error-bg)]', text: 'text-[var(--color-error-text)]', dot: 'bg-[var(--color-error)]' },
  inactive: { bg: 'bg-[var(--color-bg-subtle)]', text: 'text-[var(--color-text-tertiary)]', dot: 'bg-[var(--color-text-muted)]' },
  ok: { bg: 'bg-[var(--color-success-bg)]', text: 'text-[var(--color-success-text)]', dot: 'bg-[var(--color-success)]' },
  disabled: { bg: 'bg-[var(--color-bg-subtle)]', text: 'text-[var(--color-text-tertiary)]', dot: 'bg-[var(--color-text-muted)]' },
  pending: { bg: 'bg-[var(--color-warning-bg)]', text: 'text-[var(--color-warning-text)]', dot: 'bg-[var(--color-warning)]' },
  connected: { bg: 'bg-[var(--color-success-bg)]', text: 'text-[var(--color-success-text)]', dot: 'bg-[var(--color-success)]' },
  not_configured: { bg: 'bg-[var(--color-bg-subtle)]', text: 'text-[var(--color-text-tertiary)]', dot: 'bg-[var(--color-text-muted)]' },
  error: { bg: 'bg-[var(--color-error-bg)]', text: 'text-[var(--color-error-text)]', dot: 'bg-[var(--color-error)]' },
  processing: { bg: 'bg-[var(--color-info-bg)]', text: 'text-[var(--color-info-text)]', dot: 'bg-[var(--color-info)]' },
  queued: { bg: 'bg-[var(--color-info-bg)]', text: 'text-[var(--color-info-text)]', dot: 'bg-[var(--color-info)]' },
}

const fallback = { bg: 'bg-[var(--color-bg-subtle)]', text: 'text-[var(--color-text-secondary)]', dot: 'bg-[var(--color-text-muted)]' }
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
    :class="[(statusConfig[status] || fallback).bg, (statusConfig[status] || fallback).text]"
  >
    <span class="h-1.5 w-1.5 rounded-full" :class="(statusConfig[status] || fallback).dot"></span>
    {{ status.replace(/_/g, ' ') }}
  </span>
</template>
