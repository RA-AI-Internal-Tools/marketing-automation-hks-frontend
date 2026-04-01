<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import {
  fetchOverviewStats,
  fetchDailyVolume,
  fetchCampaignPerformance,
} from '@/api/dashboard'
import type { OverviewStats, DailyVolume, CampaignPerformance } from '@/api/types'
import { useDashboardStore } from '@/stores/dashboard'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const dashboardStore = useDashboardStore()
const stats = ref<OverviewStats | null>(null)
const volume = ref<DailyVolume[]>([])
const campaigns = ref<CampaignPerformance[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const [s, v, c] = await Promise.all([
      fetchOverviewStats(),
      fetchDailyVolume(30),
      fetchCampaignPerformance(),
    ])
    stats.value = s
    volume.value = v
    campaigns.value = c
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load dashboard data'
  } finally {
    loading.value = false
  }
  dashboardStore.startSSE()
})

onUnmounted(() => {
  dashboardStore.stopSSE()
})

const chartData = computed(() => ({
  labels: volume.value.map((d) => d.date.slice(5)),
  datasets: [
    {
      label: 'Sent',
      data: volume.value.map((d) => d.sent),
      borderColor: '#020288',
      backgroundColor: 'rgba(2, 2, 136, 0.08)',
      fill: true,
      tension: 0.4,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
    },
    {
      label: 'Failed',
      data: volume.value.map((d) => d.failed),
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239, 68, 68, 0.06)',
      fill: true,
      tension: 0.4,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: 'index' as const },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: { padding: 16, usePointStyle: true, pointStyleWidth: 8, font: { size: 12, family: 'Inter' } },
    },
  },
  scales: {
    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 11, family: 'Inter' } } },
    x: { grid: { display: false }, ticks: { font: { size: 11, family: 'Inter' } } },
  },
}
</script>

<template>
  <div class="page-enter">
    <div class="flex items-center justify-between mb-2">
      <PageHeader title="Overview" description="Campaign automation performance at a glance" />
      <div class="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
        <span
          class="inline-block h-2 w-2 rounded-full"
          :class="dashboardStore.sseConnected ? 'bg-emerald-500' : 'bg-[var(--color-text-muted)]'"
        ></span>
        {{ dashboardStore.sseConnected ? 'Live' : 'Connecting...' }}
      </div>
    </div>

    <!-- Skeleton loading state -->
    <div v-if="loading" class="space-y-6">
      <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div v-for="i in 6" :key="i" class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
          <div class="h-1 skeleton"></div>
          <div class="p-5 space-y-3">
            <div class="skeleton h-3 w-20"></div>
            <div class="skeleton h-7 w-16"></div>
          </div>
        </div>
      </div>
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
        <div class="skeleton h-5 w-48 mb-4"></div>
        <div class="skeleton h-72 w-full"></div>
      </div>
    </div>

    <div v-else-if="error" class="bg-[var(--color-error-bg)] border border-[var(--color-error-border)] text-[var(--color-error-text)] px-4 py-3 rounded-xl text-sm">{{ error }}</div>

    <template v-else>
      <!-- Stats cards -->
      <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatCard title="Total Campaigns" :value="stats?.total_campaigns ?? 0" color="indigo" />
        <StatCard title="Active Campaigns" :value="stats?.active_campaigns ?? 0" color="green" />
        <StatCard title="Total Enrollments" :value="stats?.total_enrollments ?? 0" color="blue" />
        <StatCard title="Active" :value="stats?.active_enrollments ?? 0" color="green" />
        <StatCard title="Completed" :value="stats?.completed_enrollments ?? 0" color="blue" />
        <StatCard title="Cancelled" :value="stats?.cancelled_enrollments ?? 0" color="yellow" />
      </div>

      <!-- Daily volume chart -->
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6 mb-8">
        <h2 class="text-lg font-semibold tracking-tight text-[var(--color-text-primary)] mb-4">Send Volume (Last 30 Days)</h2>
        <div class="h-72">
          <Line :data="chartData" :options="chartOptions" />
        </div>
      </div>

      <!-- Live SSE Feed -->
      <div v-if="dashboardStore.recentLogs.length || dashboardStore.recentEnrollments.length"
           class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6 mb-8">
        <div class="flex items-center gap-2 mb-4">
          <span class="relative flex h-2.5 w-2.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <h2 class="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">Live Activity</h2>
        </div>
        <div class="space-y-1.5 max-h-64 overflow-y-auto">
          <!-- Recent logs -->
          <div v-for="log in dashboardStore.recentLogs.slice(0, 15)" :key="'log-' + log.id"
            class="flex items-center justify-between text-sm px-3 py-2.5 rounded-lg bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-hover)] transition-colors">
            <div class="flex items-center gap-3">
              <span
                class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                :class="log.status === 'sent' ? 'bg-emerald-50 text-emerald-700' :
                         log.status === 'failed' ? 'bg-red-50 text-red-700' :
                         'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]'"
              >
                <span class="h-1.5 w-1.5 rounded-full" :class="log.status === 'sent' ? 'bg-emerald-500' : log.status === 'failed' ? 'bg-red-500' : 'bg-gray-400'"></span>
                {{ log.status }}
              </span>
              <span class="text-[var(--color-text-secondary)] font-medium">{{ log.campaign_slug }}</span>
              <span class="text-[var(--color-text-muted)]">step {{ log.step_index }} via {{ log.channel }}</span>
            </div>
            <span class="text-xs text-[var(--color-text-muted)] whitespace-nowrap">{{ new Date(log.created_at).toLocaleTimeString() }}</span>
          </div>
          <!-- Recent enrollments -->
          <div v-for="enr in dashboardStore.recentEnrollments.slice(0, 10)" :key="'enr-' + enr.id"
            class="flex items-center justify-between text-sm px-3 py-2.5 rounded-lg bg-blue-50/50 hover:bg-blue-50 transition-colors">
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-[#020288]">
                <span class="h-1.5 w-1.5 rounded-full bg-[#020288]"></span>
                enrollment
              </span>
              <span class="text-[var(--color-text-secondary)] font-medium">Client #{{ enr.client_id }}</span>
              <span class="text-[var(--color-text-muted)]">{{ enr.status }} &middot; step {{ enr.current_step }}</span>
            </div>
            <span class="text-xs text-[var(--color-text-muted)] whitespace-nowrap">{{ new Date(enr.created_at).toLocaleTimeString() }}</span>
          </div>
          <p v-if="!dashboardStore.recentLogs.length && !dashboardStore.recentEnrollments.length"
             class="text-[var(--color-text-muted)] text-sm text-center py-4">Waiting for live events...</p>
        </div>
      </div>

      <!-- Campaign performance table -->
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-[var(--color-border-muted)]">
          <h2 class="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">Campaign Performance</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-[var(--color-border)]">
            <thead class="bg-[var(--color-bg-subtle)]">
              <tr>
                <th class="px-4 py-3 text-left text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Campaign</th>
                <th class="px-4 py-3 text-right text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Sent</th>
                <th class="px-4 py-3 text-right text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Failed</th>
                <th class="px-4 py-3 text-right text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Skipped</th>
                <th class="px-4 py-3 text-right text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Enrollments</th>
                <th class="px-4 py-3 text-right text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Completions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--color-border-muted)]">
              <tr v-for="c in campaigns" :key="c.campaign_slug" class="hover:bg-[var(--color-bg-hover)] transition-colors">
                <td class="px-4 py-3.5 text-sm font-medium text-[var(--color-text-primary)]">{{ c.campaign_slug }}</td>
                <td class="px-4 py-3.5 text-sm text-right font-medium text-emerald-600">{{ c.total_sent }}</td>
                <td class="px-4 py-3.5 text-sm text-right font-medium text-red-600">{{ c.total_failed }}</td>
                <td class="px-4 py-3.5 text-sm text-right text-[var(--color-text-tertiary)]">{{ c.total_skipped }}</td>
                <td class="px-4 py-3.5 text-sm text-right text-[var(--color-text-secondary)]">{{ c.enrollments }}</td>
                <td class="px-4 py-3.5 text-sm text-right font-medium text-[#0099db]">{{ c.completions }}</td>
              </tr>
              <tr v-if="campaigns.length === 0">
                <td colspan="6" class="px-4 py-8 text-center text-[var(--color-text-muted)]">No campaign data</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
