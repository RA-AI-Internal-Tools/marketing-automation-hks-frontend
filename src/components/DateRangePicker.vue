<script setup lang="ts">
import { computed } from 'vue'
import { useAnalyticsStore, type DatePreset } from '@/stores/analytics'

const store = useAnalyticsStore()

const presets: { label: string; value: DatePreset }[] = [
  { label: '7 days', value: 'last7days' },
  { label: '30 days', value: 'last30days' },
  { label: '90 days', value: 'last90days' },
]

const sinceDate = computed({
  get: () => store.since.slice(0, 10),
  set: (val: string) => store.setCustomRange(new Date(val).toISOString(), store.until),
})

const untilDate = computed({
  get: () => store.until.slice(0, 10),
  set: (val: string) => store.setCustomRange(store.since, new Date(val + 'T23:59:59').toISOString()),
})
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap">
    <button
      v-for="p in presets"
      :key="p.value"
      @click="store.setPreset(p.value)"
      :class="[
        'px-3.5 py-1.5 text-xs font-medium rounded-full border transition-all duration-150',
        store.preset === p.value
          ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm'
          : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-border)] hover:bg-[var(--color-bg-page)]',
      ]"
    >
      {{ p.label }}
    </button>
    <div class="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
      <input
        type="date"
        :value="sinceDate"
        @input="sinceDate = ($event.target as HTMLInputElement).value"
        class="px-2.5 py-1.5 border border-[var(--color-border)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[#0099db] transition-shadow"
      />
      <span class="text-[var(--color-text-muted)]">to</span>
      <input
        type="date"
        :value="untilDate"
        @input="untilDate = ($event.target as HTMLInputElement).value"
        class="px-2.5 py-1.5 border border-[var(--color-border)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[#0099db] transition-shadow"
      />
    </div>
  </div>
</template>
