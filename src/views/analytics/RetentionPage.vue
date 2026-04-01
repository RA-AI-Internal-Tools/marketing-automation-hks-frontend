<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import AnalyticsLayout from '@/components/AnalyticsLayout.vue'
import CohortTable from '@/components/CohortTable.vue'
import { useAnalyticsStore } from '@/stores/analytics'
import { fetchRetention } from '@/api/analytics'
import type { RetentionData } from '@/api/types'

const analytics = useAnalyticsStore()
const data = ref<RetentionData | null>(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await fetchRetention(analytics.since, analytics.until)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load retention data'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => analytics.queryParams, load)
</script>

<template>
  <AnalyticsLayout title="Retention & CRM" description="Cohort analysis, campaign effectiveness, and consent stats">
    <div v-if="loading" class="text-center py-12 text-gray-400">Loading...</div>
    <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{{ error }}</div>
    <div v-else-if="data" class="space-y-6">
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">Cohort Retention</h3>
        <CohortTable v-if="data.cohorts.length" :cohorts="data.cohorts" />
        <p v-else class="text-sm text-gray-400">No cohort data available</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-xl border border-gray-200 p-6">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">Campaign Conversions</h3>
          <table v-if="data.campaign_conversions.length" class="w-full text-sm">
            <thead><tr class="text-left text-gray-500 text-xs uppercase">
              <th class="pb-2">Campaign</th><th class="pb-2 text-right">Enrolled</th>
              <th class="pb-2 text-right">Converted</th><th class="pb-2 text-right">Rate</th>
            </tr></thead>
            <tbody>
              <tr v-for="c in data.campaign_conversions" :key="c.campaign_slug" class="border-t border-gray-100">
                <td class="py-2 text-gray-900 font-mono text-xs">{{ c.campaign_slug }}</td>
                <td class="py-2 text-right text-gray-600">{{ c.enrollments.toLocaleString() }}</td>
                <td class="py-2 text-right text-gray-600">{{ c.conversions.toLocaleString() }}</td>
                <td class="py-2 text-right text-green-600">{{ c.conversion_rate.toFixed(1) }}%</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="text-sm text-gray-400">No data</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-6">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">Consent Stats</h3>
          <table v-if="data.consent_stats.length" class="w-full text-sm">
            <thead><tr class="text-left text-gray-500 text-xs uppercase">
              <th class="pb-2">Channel</th><th class="pb-2 text-right">Opted In</th>
              <th class="pb-2 text-right">Opted Out</th><th class="pb-2 text-right">Rate</th>
            </tr></thead>
            <tbody>
              <tr v-for="s in data.consent_stats" :key="s.channel" class="border-t border-gray-100">
                <td class="py-2 text-gray-900 capitalize">{{ s.channel }}</td>
                <td class="py-2 text-right text-green-600">{{ s.opted_in.toLocaleString() }}</td>
                <td class="py-2 text-right text-red-500">{{ s.opted_out.toLocaleString() }}</td>
                <td class="py-2 text-right text-gray-600">{{ s.rate.toFixed(1) }}%</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="text-sm text-gray-400">No data</p>
        </div>
      </div>
    </div>
  </AnalyticsLayout>
</template>
