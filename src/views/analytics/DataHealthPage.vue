<script setup lang="ts">
import { ref, onMounted } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { fetchDataHealth } from '@/api/analytics'
import type { DataHealthData } from '@/api/types'

const data = ref<DataHealthData | null>(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    data.value = await fetchDataHealth()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load data health'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <PageHeader title="Data Health" description="System connectivity, event freshness, and data quality" />

    <div v-if="loading" class="text-center py-12 text-gray-400">Loading...</div>
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{{ error }}</div>
    <div v-else-if="data" class="space-y-6">
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">Service Status</h3>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div v-for="s in data.services" :key="s.name" class="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <span
              :class="[
                'h-3 w-3 rounded-full',
                s.status === 'up' ? 'bg-green-500' : 'bg-red-500',
              ]"
            />
            <span class="text-sm text-gray-700 capitalize">{{ s.name }}</span>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">Event Freshness</h3>
        <table class="w-full text-sm">
          <thead><tr class="text-left text-gray-500 text-xs uppercase">
            <th class="pb-2">Event Type</th><th class="pb-2 text-right">Last Seen</th><th class="pb-2 text-right">24h Count</th>
          </tr></thead>
          <tbody>
            <tr v-for="e in data.event_freshness" :key="e.event_type" class="border-t border-gray-100">
              <td class="py-2 text-gray-900 font-mono text-xs">{{ e.event_type }}</td>
              <td class="py-2 text-right text-gray-600">{{ e.last_seen || 'never' }}</td>
              <td class="py-2 text-right text-gray-600">{{ e.count_24h.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="data.volume_anomalies.length" class="bg-white rounded-xl border border-yellow-200 p-6">
        <h3 class="text-sm font-semibold text-yellow-800 mb-4">Volume Anomalies</h3>
        <table class="w-full text-sm">
          <thead><tr class="text-left text-gray-500 text-xs uppercase">
            <th class="pb-2">Event</th><th class="pb-2 text-right">Current</th>
            <th class="pb-2 text-right">Average</th><th class="pb-2 text-right">Deviation</th>
          </tr></thead>
          <tbody>
            <tr v-for="a in data.volume_anomalies" :key="a.event_type" class="border-t border-yellow-100">
              <td class="py-2 text-gray-900 font-mono text-xs">{{ a.event_type }}</td>
              <td class="py-2 text-right">{{ a.current.toLocaleString() }}</td>
              <td class="py-2 text-right text-gray-600">{{ a.average.toFixed(0) }}</td>
              <td class="py-2 text-right" :class="a.deviation > 0 ? 'text-green-600' : 'text-red-600'">
                {{ a.deviation > 0 ? '+' : '' }}{{ a.deviation.toFixed(1) }}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
