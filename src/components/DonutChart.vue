<script setup lang="ts">
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { chartColors } from '@/utils/chartColors'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps<{
  labels: string[]
  values: number[]
  colors?: string[]
}>()

// Pull --chart-1..--chart-10 from the design-system at render time so
// dark mode + theme swaps flow through without hard-coded hex drift.
const defaultColors = computed(() => chartColors())

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [
    {
      data: props.values,
      backgroundColor: props.colors || defaultColors.value.slice(0, props.values.length),
      borderWidth: 2,
      borderColor: 'var(--color-bg-card)',
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: { padding: 16, usePointStyle: true, pointStyleWidth: 8 },
    },
  },
  cutout: '60%',
}
</script>

<template>
  <div class="h-64">
    <Doughnut :data="chartData" :options="chartOptions" />
  </div>
</template>
