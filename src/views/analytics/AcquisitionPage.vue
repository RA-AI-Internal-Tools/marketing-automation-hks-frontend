<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import AnalyticsLayout from '@/components/AnalyticsLayout.vue'
import MetricCard from '@/components/MetricCard.vue'
import DonutChart from '@/components/DonutChart.vue'
import { useAnalyticsStore } from '@/stores/analytics'
import { fetchAcquisition } from '@/api/analytics'
import type { AcquisitionData } from '@/api/types'

const analytics = useAnalyticsStore()
const data = ref<AcquisitionData | null>(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await fetchAcquisition(analytics.since, analytics.until)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load acquisition data'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => analytics.queryParams, load)
</script>

<template>
  <AnalyticsLayout title="Acquisition" description="Traffic sources, UTM campaigns, and signups">
    <div v-if="loading" class="text-center py-12 text-gray-400">Loading...</div>
    <div v-else-if="data" class="space-y-6">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="New Users" :value="data.new_users.toLocaleString()" />
        <MetricCard title="Returning Users" :value="data.returning_users.toLocaleString()" />
        <MetricCard title="Signup Rate" :value="data.signup_rate.toFixed(2) + '%'" />
        <MetricCard title="Total Sources" :value="data.sources.length" />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-xl border border-gray-200 p-6">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">Traffic Sources</h3>
          <DonutChart
            v-if="data.sources.length"
            :labels="data.sources.map((s) => s.source)"
            :values="data.sources.map((s) => s.count)"
          />
          <p v-else class="text-sm text-gray-400">No data</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-6">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">UTM Campaigns</h3>
          <table v-if="data.utm_campaigns.length" class="w-full text-sm">
            <thead><tr class="text-left text-gray-500 text-xs uppercase">
              <th class="pb-2">Campaign</th><th class="pb-2 text-right">Visits</th><th class="pb-2 text-right">Conversions</th>
            </tr></thead>
            <tbody>
              <tr v-for="c in data.utm_campaigns" :key="c.campaign" class="border-t border-gray-100">
                <td class="py-2 text-gray-900">{{ c.campaign }}</td>
                <td class="py-2 text-right text-gray-600">{{ c.count.toLocaleString() }}</td>
                <td class="py-2 text-right text-gray-600">{{ c.conversions.toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="text-sm text-gray-400">No data</p>
        </div>
      </div>
    </div>
  </AnalyticsLayout>
</template>
