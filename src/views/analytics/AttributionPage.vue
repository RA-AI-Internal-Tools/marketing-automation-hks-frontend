<script setup lang="ts">
/**
 * AttributionPage — revenue attributed to MA campaigns.
 *
 * Combines the overview (KPIs + daily line chart) and the per-campaign ×
 * per-channel breakdown table on one page. Window + attribution model
 * are UI selectors; both propagate to the backend as query params.
 */
import { ref, computed, onMounted, watch } from 'vue'
import AnalyticsLayout from '@/components/AnalyticsLayout.vue'
import { Line, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import {
  fetchRevenueAttributionOverview, fetchRevenueAttribution,
  type RevenueAttributionOverview, type RevenueAttributionRow,
  type AttributionModel,
} from '@/api/revenue_attribution'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)

const days = ref<number>(30)
const model = ref<AttributionModel>('last_touch')
const windowOptions = [1, 2, 3, 7, 30, 90]

const overview = ref<RevenueAttributionOverview | null>(null)
const rows = ref<RevenueAttributionRow[]>([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [ov, rv] = await Promise.all([
      fetchRevenueAttributionOverview(days.value, model.value),
      fetchRevenueAttribution(days.value, model.value),
    ])
    overview.value = ov
    rows.value = rv.rows
  } catch (e: any) {
    error.value = e?.response?.data?.error || 'Failed to load attribution'
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch([days, model], load)

function money(n: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
function moneyFull(n: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n)
}

const lineData = computed(() => {
  const pts = overview.value?.daily_series || []
  return {
    labels: pts.map(p => p.date.slice(5)),
    datasets: [{
      label: 'Revenue',
      data: pts.map(p => p.revenue),
      borderColor: '#0099db',
      backgroundColor: 'rgba(0,153,219,0.15)',
      borderWidth: 2,
      fill: true,
      tension: 0.25,
      pointRadius: 0,
    }],
  }
})
const lineOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true, ticks: { callback: (v: any) => money(v) } },
    x: { grid: { display: false } },
  },
}

const campaignTotals = computed(() => {
  const map = new Map<string, number>()
  for (const r of rows.value) {
    map.set(r.campaign_slug, (map.get(r.campaign_slug) || 0) + r.revenue)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
})

const barData = computed(() => ({
  labels: campaignTotals.value.map(([k]) => k),
  datasets: [{
    label: 'Revenue',
    data: campaignTotals.value.map(([, v]) => v),
    backgroundColor: '#020288',
    borderRadius: 4,
  }],
}))
const barOptions = {
  indexAxis: 'y' as const,
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { beginAtZero: true, ticks: { callback: (v: any) => money(v) } },
  },
}
</script>

<template>
  <AnalyticsLayout
    title="Revenue Attribution"
    description="Revenue linked to campaign sends — last-touch and linear models over a rolling window."
  >
    <div class="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 text-sm">
      <div class="flex items-center gap-2">
        <span class="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Window</span>
        <div class="inline-flex rounded-md border border-[var(--color-border)] p-0.5" role="group" aria-label="Attribution window">
          <button v-for="w in windowOptions" :key="w"
                  @click="days = w"
                  :aria-pressed="days === w"
                  :class="[
                    'px-2 py-1 text-xs font-medium rounded',
                    days === w ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-page)]',
                  ]">
            {{ w }}d
          </button>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Model</span>
        <div class="inline-flex rounded-md border border-[var(--color-border)] p-0.5" role="group" aria-label="Attribution model">
          <button
            @click="model = 'last_touch'"
            :aria-pressed="model === 'last_touch'"
            :class="[
              'px-2 py-1 text-xs font-medium rounded',
              model === 'last_touch' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-page)]',
            ]"
          >Last-touch</button>
          <button
            @click="model = 'linear'"
            :aria-pressed="model === 'linear'"
            :class="[
              'px-2 py-1 text-xs font-medium rounded',
              model === 'linear' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-page)]',
            ]"
          >Linear</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="py-12 text-center text-[var(--color-text-muted)]" role="status">Loading attribution…</div>

    <div v-else-if="error" class="rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-4 text-sm text-[var(--color-error-text)]">
      {{ error }}
    </div>

    <div v-else-if="overview" class="space-y-4">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
          <div class="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Attributed revenue · {{ overview.window_days }}d</div>
          <div class="mt-1 text-2xl font-semibold tabular-nums">{{ moneyFull(overview.total_revenue) }}</div>
        </div>
        <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
          <div class="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Attributed sends</div>
          <div class="mt-1 text-2xl font-semibold tabular-nums">{{ overview.total_sends.toLocaleString() }}</div>
        </div>
        <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
          <div class="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Revenue per send</div>
          <div class="mt-1 text-2xl font-semibold tabular-nums">{{ moneyFull(overview.revenue_per_send) }}</div>
        </div>
      </div>

      <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
        <div class="mb-2 text-sm font-medium">Daily attributed revenue</div>
        <div style="height: 220px;">
          <Line :data="lineData" :options="lineOptions" />
        </div>
      </div>

      <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
        <div class="mb-2 text-sm font-medium">Top campaigns by revenue</div>
        <div style="height: 280px;">
          <Bar v-if="campaignTotals.length > 0" :data="barData" :options="barOptions" />
          <div v-else class="py-10 text-center text-sm text-[var(--color-text-muted)]">No attributed revenue in this window yet.</div>
        </div>
      </div>

      <div class="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]">
        <table class="w-full text-sm">
          <thead class="bg-[var(--color-bg-subtle)] text-left text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
            <tr>
              <th class="px-4 py-2">Campaign</th>
              <th class="px-4 py-2">Channel</th>
              <th class="px-4 py-2 text-right">Sends</th>
              <th class="px-4 py-2 text-right">Revenue</th>
              <th class="px-4 py-2 text-right">Clients</th>
              <th class="px-4 py-2 text-right">Rev/send</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--color-border)]">
            <tr v-for="(r, i) in rows" :key="`${r.campaign_slug}-${r.channel}-${i}`">
              <td class="px-4 py-2 font-mono text-xs">{{ r.campaign_slug || '—' }}</td>
              <td class="px-4 py-2"><span class="rounded bg-[var(--color-bg-subtle)] px-1.5 py-0.5 font-mono text-[10px] uppercase">{{ r.channel }}</span></td>
              <td class="px-4 py-2 text-right tabular-nums">{{ r.sends.toLocaleString() }}</td>
              <td class="px-4 py-2 text-right tabular-nums font-medium">{{ moneyFull(r.revenue) }}</td>
              <td class="px-4 py-2 text-right tabular-nums">{{ r.unique_clients.toLocaleString() }}</td>
              <td class="px-4 py-2 text-right tabular-nums">{{ r.sends > 0 ? moneyFull(r.revenue / r.sends) : '—' }}</td>
            </tr>
            <tr v-if="rows.length === 0">
              <td colspan="6" class="py-6 text-center text-sm text-[var(--color-text-muted)]">
                No attribution events in this window yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </AnalyticsLayout>
</template>
