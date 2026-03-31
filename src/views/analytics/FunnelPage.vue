<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import AnalyticsLayout from '@/components/AnalyticsLayout.vue'
import MetricCard from '@/components/MetricCard.vue'
import FunnelChart from '@/components/FunnelChart.vue'
import { useAnalyticsStore } from '@/stores/analytics'
import { fetchFunnel } from '@/api/analytics'
import type { FunnelData } from '@/api/types'

const analytics = useAnalyticsStore()
const data = ref<FunnelData | null>(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await fetchFunnel(analytics.since, analytics.until)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load funnel data'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => analytics.queryParams, load)
</script>

<template>
  <AnalyticsLayout title="Funnel Analysis" description="Conversion funnel from browsing to purchase">
    <div v-if="loading" class="text-center py-12 text-gray-400">Loading...</div>
    <div v-else-if="data" class="space-y-6">
      <MetricCard
        title="Overall Conversion"
        :value="data.overall_conversion.toFixed(2) + '%'"
        color="green"
      />
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-6">Conversion Funnel</h3>
        <FunnelChart :stages="data.stages" />
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">Stage Details</h3>
        <table class="w-full text-sm">
          <thead><tr class="text-left text-gray-500 text-xs uppercase">
            <th class="pb-2">Stage</th><th class="pb-2 text-right">Count</th>
            <th class="pb-2 text-right">Conversion</th><th class="pb-2 text-right">Drop-off</th>
          </tr></thead>
          <tbody>
            <tr v-for="s in data.stages" :key="s.name" class="border-t border-gray-100">
              <td class="py-2 text-gray-900 font-medium">{{ s.name }}</td>
              <td class="py-2 text-right text-gray-600">{{ s.count.toLocaleString() }}</td>
              <td class="py-2 text-right text-green-600">{{ s.conversion_rate.toFixed(1) }}%</td>
              <td class="py-2 text-right text-red-500">{{ s.drop_off_rate.toFixed(1) }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </AnalyticsLayout>
</template>
