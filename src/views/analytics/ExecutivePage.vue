<script setup lang="ts">
import { onMounted, watch } from 'vue'
import AnalyticsLayout from '@/components/AnalyticsLayout.vue'
import MetricCard from '@/components/MetricCard.vue'
import BaseCard from '@/components/BaseCard.vue'
import { useAnalyticsStore } from '@/stores/analytics'
import { fetchExecutiveOverview } from '@/api/analytics'
import type { ExecutiveOverview } from '@/api/types'
import { useCachedFetch } from '@/composables/useCache'
import { chartPalette, alpha } from '@/utils/chartColors'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const analytics = useAnalyticsStore()

// 60s TTL on the executive dashboard — it's the heaviest of the analytics
// endpoints (4-5s backend per live QA) and operators often bounce between
// tabs in under a minute. Cache key includes the date range so different
// windows don't pollute each other.
const { data, loading, error, load: runLoad } = useCachedFetch<ExecutiveOverview>(
  () => `analytics:executive:${analytics.since}:${analytics.until}`,
  () => fetchExecutiveOverview(analytics.since, analytics.until),
  60_000,
)

async function load() { await runLoad() }

onMounted(load)
// Date range change = different cache key = different underlying fetcher.
// Re-call load so the new key is hydrated (first call primes, second
// serves cache).
watch(() => analytics.queryParams, load)

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}
</script>

<template>
  <AnalyticsLayout title="Executive Overview" description="Key business metrics at a glance">
    <div v-if="loading" class="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>
    <div v-else-if="error" class="bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-xl p-4 text-[var(--color-error-text)] text-sm">{{ error }}</div>
    <div v-else-if="data" class="space-y-6">
      <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <MetricCard title="Revenue" :value="'$' + fmt(data.revenue)" :delta="data.revenue_delta" delta-label="vs prev" />
        <MetricCard title="Traffic" :value="fmt(data.traffic)" :delta="data.traffic_delta" delta-label="vs prev" />
        <MetricCard title="Conversion Rate" :value="data.conversion_rate.toFixed(2) + '%'" :delta="data.conversion_rate_delta" />
        <MetricCard title="Active Users" :value="fmt(data.active_users)" :delta="data.active_users_delta" />
        <MetricCard title="Orders" :value="fmt(data.total_orders)" :delta="data.total_orders_delta" />
      </div>
      <p class="text-xs text-[var(--color-text-muted)] -mt-2">Traffic and active users are live from Tracardi. Revenue, conversion rate, and order counts populate once real purchase flows are active in the store.</p>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BaseCard>
          <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Revenue Trend</h3>
          <Line
            v-if="data.daily_revenue.length"
            :data="{
              labels: data.daily_revenue.map((d) => d.date),
              datasets: [{
                label: 'Revenue',
                data: data.daily_revenue.map((d) => d.revenue),
                borderColor: chartPalette().primary,
                backgroundColor: alpha(chartPalette().primary, 0.1),
                fill: true,
                tension: 0.3,
              }],
            }"
            :options="{ responsive: true, plugins: { legend: { display: false } } }"
          />
          <p v-else class="text-sm text-[var(--color-text-muted)]">No data</p>
        </BaseCard>
        <BaseCard>
          <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Traffic Trend</h3>
          <Line
            v-if="data.daily_traffic.length"
            :data="{
              labels: data.daily_traffic.map((d) => d.date),
              datasets: [{
                label: 'Page Views',
                data: data.daily_traffic.map((d) => d.count),
                borderColor: chartPalette().info,
                backgroundColor: alpha(chartPalette().info, 0.1),
                fill: true,
                tension: 0.3,
              }],
            }"
            :options="{ responsive: true, plugins: { legend: { display: false } } }"
          />
          <p v-else class="text-sm text-[var(--color-text-muted)]">No data</p>
        </BaseCard>
      </div>
    </div>
  </AnalyticsLayout>
</template>
