<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import AnalyticsLayout from '@/components/AnalyticsLayout.vue'
import MetricCard from '@/components/MetricCard.vue'
import { useAnalyticsStore } from '@/stores/analytics'
import { fetchOrders } from '@/api/analytics'
import type { OrdersData } from '@/api/types'
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
const data = ref<OrdersData | null>(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await fetchOrders(analytics.since, analytics.until)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load order data'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => analytics.queryParams, load)

function fmtCurrency(n: number): string {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
</script>

<template>
  <AnalyticsLayout title="Orders & Revenue" description="Order metrics, AOV, and revenue trends">
    <div v-if="loading" class="text-center py-12 text-gray-400">Loading...</div>
    <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{{ error }}</div>
    <div v-else-if="data" class="space-y-6">
      <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard title="Total Revenue" :value="fmtCurrency(data.total_revenue)" :delta="data.total_revenue_delta" />
        <MetricCard title="AOV" :value="fmtCurrency(data.aov)" :delta="data.aov_delta" />
        <MetricCard title="Total Orders" :value="data.total_orders.toLocaleString()" :delta="data.total_orders_delta" />
      </div>

      <div class="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">Revenue Trend</h3>
        <Line
          v-if="data.revenue_trend.length"
          :data="{
            labels: data.revenue_trend.map((d) => d.date),
            datasets: [{
              label: 'Revenue',
              data: data.revenue_trend.map((d) => d.revenue),
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              fill: true,
              tension: 0.3,
            }],
          }"
          :options="{ responsive: true, plugins: { legend: { display: false } } }"
        />
      </div>

      <div class="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">Order Status</h3>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div v-for="s in data.order_status" :key="s.status" class="text-center p-3 bg-gray-50 rounded-lg">
            <p class="text-2xl font-bold text-gray-900">{{ s.count.toLocaleString() }}</p>
            <p class="text-xs text-gray-500 mt-1 capitalize">{{ s.status }}</p>
          </div>
        </div>
      </div>
    </div>
  </AnalyticsLayout>
</template>
