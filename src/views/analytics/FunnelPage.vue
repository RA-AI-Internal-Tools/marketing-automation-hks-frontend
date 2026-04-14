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
  <AnalyticsLayout title="Funnel Analysis" description="Conversion funnel from browsing to purchase — stages map to canonical event names (checkout-started, order-completed)">
    <div v-if="loading" class="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>
    <div v-else-if="error" class="bg-[var(--color-error-bg)] border border-[var(--color-error-border)] text-[var(--color-error-text)] px-4 py-3 rounded-lg text-sm">{{ error }}</div>
    <div v-else-if="data" class="space-y-6">
      <MetricCard
        title="Overall Conversion"
        :value="data.overall_conversion.toFixed(2) + '%'"
        accent="green"
      />
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-6">Conversion Funnel</h3>
        <FunnelChart :stages="data.stages" />
      </div>
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Stage Details</h3>
        <table class="w-full text-sm">
          <thead><tr class="text-left text-[var(--color-text-tertiary)] text-xs uppercase">
            <th class="pb-2">Stage</th><th class="pb-2 text-right">Count</th>
            <th class="pb-2 text-right">Conversion</th><th class="pb-2 text-right">Drop-off</th>
          </tr></thead>
          <tbody>
            <tr v-for="s in data.stages" :key="s.name" class="border-t border-[var(--color-border-muted)]">
              <td class="py-2 text-[var(--color-text-primary)] font-medium">{{ s.name }}</td>
              <td class="py-2 text-right text-[var(--color-text-secondary)]">{{ s.count.toLocaleString() }}</td>
              <td class="py-2 text-right text-green-600">{{ s.conversion_rate.toFixed(1) }}%</td>
              <td class="py-2 text-right text-red-500">{{ s.drop_off_rate.toFixed(1) }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </AnalyticsLayout>
</template>
