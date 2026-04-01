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
  if (value >= 80) return 'bg-[#020288] text-white'
  if (value >= 60) return 'bg-[#0d35d7] text-white'
  if (value >= 40) return 'bg-[#0099db] text-white'
  if (value >= 20) return 'bg-[#0099db]/20 text-[#020288]'
  if (value > 0) return 'bg-[#0099db]/10 text-[#0d35d7]'
  return 'bg-gray-50 text-gray-400'
}

const maxPeriods = computed(() => Math.max(...(props.cohorts.map((c) => c.periods.length) || [0]), 0))
</script>

<template>
  <div class="overflow-x-auto">
    <table class="min-w-full text-xs">
      <thead>
        <tr>
          <th class="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Cohort</th>
          <th class="px-3 py-2.5 text-right font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Users</th>
          <th
            v-for="i in maxPeriods"
            :key="i"
            class="px-3 py-2.5 text-center font-semibold text-gray-500 uppercase tracking-wide text-[10px]"
          >
            M{{ i }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in cohorts" :key="row.cohort" class="hover:bg-slate-50/50 transition-colors">
          <td class="px-3 py-2 font-medium text-gray-700">{{ row.cohort }}</td>
          <td class="px-3 py-2 text-right text-gray-600">{{ row.total.toLocaleString() }}</td>
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
