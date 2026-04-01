<script setup lang="ts">
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps<{
  labels: string[]
  values: number[]
  colors?: string[]
}>()

const defaultColors = [
  '#020288', '#0d35d7', '#0099db', '#50C8ED', '#10b981',
  '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#f97316',
]

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [
    {
      data: props.values,
      backgroundColor: props.colors || defaultColors.slice(0, props.values.length),
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
