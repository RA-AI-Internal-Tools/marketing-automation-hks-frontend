<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  cohorts: {
    cohort: string
    total: number
    periods: number[]
  }[]
}>()

function cellColor(value: number): string {
  if (value >= 80) return 'bg-[var(--color-primary)] text-white'
  if (value >= 60) return 'bg-[var(--color-primary-hover)] text-white'
  if (value >= 40) return 'bg-[var(--color-accent)] text-white'
  if (value >= 20) return 'bg-[var(--color-accent-light)] text-[var(--color-primary)]'
  if (value > 0) return 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
  return 'bg-[var(--color-bg-page)] text-[var(--color-text-muted)]'
}

const maxPeriods = computed(() => Math.max(...(props.cohorts.map((c) => c.periods.length) || [0]), 0))
</script>

<template>
  <div class="overflow-x-auto">
    <table class="min-w-full text-xs">
      <thead>
        <tr>
          <th class="px-3 py-2.5 text-left font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide text-[10px]">Cohort</th>
          <th class="px-3 py-2.5 text-right font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide text-[10px]">Clients</th>
          <th
            v-for="i in maxPeriods"
            :key="i"
            class="px-3 py-2.5 text-center font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide text-[10px]"
          >
            M{{ i }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in cohorts" :key="row.cohort" class="hover:bg-[var(--color-bg-hover)] transition-colors">
          <td class="px-3 py-2 font-medium text-[var(--color-text-secondary)]">{{ row.cohort }}</td>
          <td class="px-3 py-2 text-right text-[var(--color-text-secondary)]">{{ row.total.toLocaleString() }}</td>
          <td
            v-for="(val, i) in row.periods"
            :key="i"
            :class="['px-3 py-2 text-center rounded-md font-medium', cellColor(val)]"
          >
            {{ val.toFixed(0) }}%
          </td>
          <td
            v-for="i in maxPeriods - row.periods.length"
            :key="'empty-' + i"
            class="px-3 py-2"
          />
        </tr>
      </tbody>
    </table>
  </div>
</template>
