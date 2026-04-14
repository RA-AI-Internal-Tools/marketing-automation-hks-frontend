<script setup lang="ts">
import { computed } from 'vue'
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
  title: string
  value: string | number
  delta?: number
  deltaLabel?: string
  color?: 'indigo' | 'green' | 'yellow' | 'red' | 'blue'
}>()

const accentColors: Record<string, string> = {
  indigo: 'bg-[var(--color-primary)]',
  green: 'bg-[var(--color-success)]',
  yellow: 'bg-[var(--color-warning)]',
  red: 'bg-[var(--color-error)]',
  blue: 'bg-[var(--color-accent)]',
}
</script>

<template>
  <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm card-interactive overflow-hidden">
    <div class="h-1" :class="accentColors[color || 'indigo']"></div>
    <div class="p-5">
      <p class="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">{{ title }}</p>
      <p class="mt-2 text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">{{ value }}</p>
      <div v-if="delta !== undefined" class="mt-2 flex items-center gap-1.5">
        <span
          :class="[
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
            delta >= 0 ? 'bg-[var(--color-success-soft)] text-[var(--color-success-strong)]' : 'bg-[var(--color-error-soft)] text-[var(--color-error-strong)]'
          ]"
        >
          <ArrowTrendingUpIcon v-if="delta >= 0" class="h-3.5 w-3.5" />
          <ArrowTrendingDownIcon v-else class="h-3.5 w-3.5" />
          {{ delta >= 0 ? '+' : '' }}{{ delta.toFixed(1) }}%
        </span>
        <span v-if="deltaLabel" class="text-xs text-[var(--color-text-muted)]">{{ deltaLabel }}</span>
      </div>
    </div>
  </div>
</template>
