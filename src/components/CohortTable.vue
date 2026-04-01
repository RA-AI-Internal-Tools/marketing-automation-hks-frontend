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
  if (value >= 80) return 'bg-indigo-600 text-white'
  if (value >= 60) return 'bg-indigo-500 text-white'
  if (value >= 40) return 'bg-indigo-400 text-white'
  if (value >= 20) return 'bg-indigo-200 text-indigo-900'
  if (value > 0) return 'bg-indigo-100 text-indigo-700'
  return 'bg-gray-50 text-gray-400'
}

const maxPeriods = computed(() => Math.max(...(props.cohorts.map((c) => c.periods.length) || [0]), 0))
</script>

<template>
  <div class="overflow-x-auto">
    <table class="min-w-full text-xs">
      <thead>
        <tr>
          <th class="px-3 py-2 text-left font-medium text-gray-500">Cohort</th>
          <th class="px-3 py-2 text-right font-medium text-gray-500">Users</th>
          <th
            v-for="i in maxPeriods"
            :key="i"
            class="px-3 py-2 text-center font-medium text-gray-500"
          >
            M{{ i }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in cohorts" :key="row.cohort">
          <td class="px-3 py-2 font-medium text-gray-700">{{ row.cohort }}</td>
          <td class="px-3 py-2 text-right text-gray-600">{{ row.total.toLocaleString() }}</td>
          <td
            v-for="(val, i) in row.periods"
            :key="i"
            :class="['px-3 py-2 text-center rounded', cellColor(val)]"
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
