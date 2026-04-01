<script setup lang="ts">
import { useEnvironmentStore } from '@/stores/environment'

const env = useEnvironmentStore()

defineProps<{
  compact?: boolean
}>()
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider rounded-full whitespace-nowrap',
      compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]',
      env.isSandbox
        ? 'bg-[var(--env-sandbox-badge-bg)] text-[var(--env-sandbox-badge-text)] border border-[var(--env-sandbox-border)]'
        : 'bg-[var(--env-production-badge-bg)] text-[var(--env-production-badge-text)] border border-[var(--env-production-border)]',
    ]"
  >
    <span
      :class="[
        'h-1.5 w-1.5 rounded-full',
        env.isSandbox ? 'bg-[var(--env-sandbox-accent)]' : 'bg-[var(--env-production-accent)]',
      ]"
    ></span>
    {{ env.mode }}
  </span>
</template>
