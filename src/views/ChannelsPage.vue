<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import { fetchChannelStats } from '@/api/dashboard'
import type { ChannelStats } from '@/api/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const channels = ref<ChannelStats[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    channels.value = await fetchChannelStats()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load channel stats'
  } finally {
    loading.value = false
  }
})

const totalSent = computed(() => channels.value.reduce((s, c) => s + c.sent, 0))
const totalFailed = computed(() => channels.value.reduce((s, c) => s + c.failed, 0))
const successRate = computed(() => {
  const total = totalSent.value + totalFailed.value
  return total > 0 ? Math.round((totalSent.value / total) * 100) : 0
})

const chartData = computed(() => ({
  labels: channels.value.map((c) => c.channel.toUpperCase()),
  datasets: [
    { label: 'Sent', data: channels.value.map((c) => c.sent), backgroundColor: '#22c55e' },
    { label: 'Failed', data: channels.value.map((c) => c.failed), backgroundColor: '#ef4444' },
    { label: 'Freq Capped', data: channels.value.map((c) => c.frequency_capped), backgroundColor: '#eab308' },
    { label: 'No Consent', data: channels.value.map((c) => c.no_consent), backgroundColor: '#f97316' },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'top' as const } },
  scales: { x: { stacked: false }, y: { beginAtZero: true } },
}
</script>

<template>
  <div class="page-enter page-enter">
    <PageHeader title="Channel Analytics" description="Message delivery performance per channel" />

    <div v-if="loading" class="text-center py-12 text-gray-400">Loading channels...</div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{{ error }}</div>

    <template v-else>
      <div class="grid grid-cols-3 gap-4 mb-8">
        <StatCard title="Total Sent" :value="totalSent" color="green" />
        <StatCard title="Total Failed" :value="totalFailed" color="red" />
        <StatCard title="Success Rate" :value="`${successRate}%`" color="indigo" />
      </div>

      <div class="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 mb-8">
        <h2 class="text-lg font-semibold tracking-tight text-gray-900 mb-4">Channel Breakdown</h2>
        <div class="h-72">
          <Bar :data="chartData" :options="chartOptions" />
        </div>
      </div>

      <!-- Per-channel detail cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div v-for="ch in channels" :key="ch.channel" class="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
          <h3 class="text-sm font-semibold text-gray-900 uppercase mb-3">{{ ch.channel }}</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between"><span class="text-gray-500">Sent</span><span class="font-medium text-green-700">{{ ch.sent }}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">Failed</span><span class="font-medium text-red-600">{{ ch.failed }}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">Skipped</span><span class="font-medium text-gray-600">{{ ch.skipped }}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">Freq Capped</span><span class="font-medium text-yellow-700">{{ ch.frequency_capped }}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">No Consent</span><span class="font-medium text-orange-700">{{ ch.no_consent }}</span></div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
