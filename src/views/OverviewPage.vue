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

const heroNumber = computed(() => (stats.value?.total_enrollments ?? 0).toLocaleString())
const heroDelta = computed(() => {
  // rolling last-7 vs prev-7 approximation from daily volume
  const n = volume.value.length
  if (n < 14) return null
  const recent = volume.value.slice(n - 7).reduce((a, d) => a + d.sent, 0)
  const prior = volume.value.slice(n - 14, n - 7).reduce((a, d) => a + d.sent, 0)
  if (prior === 0) return recent > 0 ? { pct: 100, up: true } : null
  const pct = Math.round(((recent - prior) / prior) * 100)
  return { pct: Math.abs(pct), up: pct >= 0 }
})

const weeklySent = computed(() => {
  const n = volume.value.length
  return volume.value.slice(Math.max(0, n - 7)).reduce((a, d) => a + d.sent, 0)
})
const weeklyFailed = computed(() => {
  const n = volume.value.length
  return volume.value.slice(Math.max(0, n - 7)).reduce((a, d) => a + d.failed, 0)
})

const chartData = computed(() => ({
  labels: volume.value.map((d) => d.date.slice(5)),
  datasets: [
    {
      label: 'Sent',
      data: volume.value.map((d) => d.sent),
      borderColor: '#020288',
      backgroundColor: 'rgba(2, 2, 136, 0.18)',
      fill: true,
      tension: 0.35,
      borderWidth: 2.25,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: '#020288',
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2,
    },
    {
      label: 'Failed',
      data: volume.value.map((d) => d.failed),
      borderColor: '#b4281e',
      backgroundColor: 'rgba(180, 40, 30, 0.14)',
      fill: true,
      tension: 0.35,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: '#b4281e',
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: 'index' as const },
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        padding: 16,
        usePointStyle: true,
        pointStyleWidth: 6,
        boxHeight: 6,
        font: { size: 11, family: 'IBM Plex Sans', weight: 500 as const },
        color: 'rgba(107, 106, 92, 1)',
      },
    },
    tooltip: {
      backgroundColor: '#1a1a15',
      padding: 12,
      cornerRadius: 6,
      titleFont: { family: 'IBM Plex Sans', weight: 600 as const, size: 12 },
      bodyFont: { family: 'IBM Plex Mono', size: 12 },
      bodySpacing: 6,
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      displayColors: true,
      boxPadding: 4,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(15, 23, 42, 0.04)', drawTicks: false },
      border: { display: false },
      ticks: {
        font: { size: 10, family: 'IBM Plex Mono' },
        color: 'rgba(107, 106, 92, 1)',
        padding: 8,
      },
    },
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: {
        font: { size: 10, family: 'IBM Plex Mono' },
        color: 'rgba(107, 106, 92, 1)',
      },
    },
  },
}

function pctLabel(n: number, total: number): string {
  if (!total) return '—'
  const p = (n / total) * 100
  return (p < 0.1 ? '<0.1' : p.toFixed(1)) + '%'
}
</script>

<template>
  <div class="page-enter">
    <!-- ─────────── Hero masthead ─────────── -->
    <header class="hero">
      <div class="hero-top">
        <span class="rule-dot">Overview · Realtime</span>
        <div class="hero-status" :class="{ 'is-live': dashboardStore.sseConnected }">
          <span class="hero-status-dot" />
          {{ dashboardStore.sseConnected ? 'Stream connected' : 'Stream offline' }}
        </div>
      </div>

      <h1 class="hero-title">
        <span>Campaigns</span>
        <span class="hero-title-comma">,</span>
        <span>segments</span>
        <span class="hero-title-comma">,</span>
        <span class="hero-title-italic">performance.</span>
      </h1>

      <div class="hero-grid">
        <div class="hero-main">
          <div class="hero-metric-label">Total enrollments lifetime</div>
          <div class="hero-metric-value">{{ loading ? '—' : heroNumber }}</div>
          <div v-if="heroDelta" class="hero-metric-delta" :class="heroDelta.up ? 'delta-up' : 'delta-down'">
            <span>{{ heroDelta.up ? '↗' : '↘' }}</span>
            <span>{{ heroDelta.pct }}% last 7 vs prior 7</span>
          </div>
        </div>

        <div class="hero-side">
          <div class="hero-side-row">
            <div class="hero-side-label">Sent · last 7 days</div>
            <div class="hero-side-num">{{ weeklySent.toLocaleString() }}</div>
          </div>
          <div class="hero-side-row">
            <div class="hero-side-label">Failed · last 7 days</div>
            <div class="hero-side-num hero-side-num-error">{{ weeklyFailed.toLocaleString() }}</div>
          </div>
          <div class="hero-side-row">
            <div class="hero-side-label">Delivery rate · last 7 days</div>
            <div class="hero-side-num">
              {{ weeklySent + weeklyFailed === 0
                ? '—'
                : ((weeklySent / (weeklySent + weeklyFailed)) * 100).toFixed(1) + '%' }}
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- ─────────── Error state ─────────── -->
    <div v-if="error" class="error-panel">{{ error }}</div>

    <!-- ─────────── Loading skeleton ─────────── -->
    <div v-if="loading" class="space-y-6">
      <div class="stat-grid">
        <div v-for="i in 6" :key="i" class="stat-skel">
          <div class="skeleton h-3 w-20 mb-5"></div>
          <div class="skeleton h-9 w-20"></div>
        </div>
      </div>
      <div class="chart-card">
        <div class="skeleton h-4 w-48 mb-6"></div>
        <div class="skeleton h-64 w-full"></div>
      </div>
    </div>

    <template v-else>
      <!-- ─────────── Stat grid ─────────── -->
      <section class="stat-section">
        <div class="section-head">
          <span class="rule-dot">Pipeline</span>
          <span class="section-rule" />
        </div>
        <div class="stat-grid stagger">
          <StatCard title="Total campaigns"  :value="stats?.total_campaigns ?? 0" />
          <StatCard title="Active campaigns" :value="stats?.active_campaigns ?? 0" accent="emerald" trend="up" />
          <StatCard title="Enrollments"      :value="stats?.total_enrollments ?? 0" accent="cyan" />
          <StatCard title="In flight"        :value="stats?.active_enrollments ?? 0" accent="emerald" />
          <StatCard title="Completed"        :value="stats?.completed_enrollments ?? 0" />
          <StatCard title="Cancelled"        :value="stats?.cancelled_enrollments ?? 0" accent="amber" />
        </div>
      </section>

      <!-- ─────────── Chart ─────────── -->
      <section class="chart-section">
        <div class="section-head">
          <span class="rule-dot">Send volume · last 30 days</span>
          <span class="section-rule" />
          <div class="chart-legend-inline">
            <span class="legend-swatch legend-sent" /> <span>Sent</span>
            <span class="legend-swatch legend-failed" /> <span>Failed</span>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-wrap">
            <Line :data="chartData" :options="chartOptions" />
          </div>
        </div>
      </section>

      <!-- ─────────── Live feed ─────────── -->
      <section
        v-if="dashboardStore.recentLogs.length || dashboardStore.recentEnrollments.length"
        class="live-section"
      >
        <div class="section-head">
          <span class="live-pulse" aria-hidden="true">
            <span class="live-pulse-dot"></span>
            <span class="live-pulse-ring"></span>
          </span>
          <span class="rule-dot" style="color: var(--color-text-primary);">Live activity</span>
          <span class="section-rule" />
        </div>

        <div class="live-card">
          <ol class="live-feed">
            <li
              v-for="log in dashboardStore.recentLogs.slice(0, 12)"
              :key="'log-' + log.id"
              class="live-row"
            >
              <span class="live-status" :data-status="log.status">{{ log.status }}</span>
              <span class="live-campaign">{{ log.campaign_slug }}</span>
              <span class="live-meta">step {{ log.step_index }} · {{ log.channel }}</span>
              <span class="live-time">{{ new Date(log.created_at).toLocaleTimeString() }}</span>
            </li>
            <li
              v-for="enr in dashboardStore.recentEnrollments.slice(0, 8)"
              :key="'enr-' + enr.id"
              class="live-row live-row-enroll"
            >
              <span class="live-status" data-status="enroll">enroll</span>
              <span class="live-campaign">Client #{{ enr.client_id }}</span>
              <span class="live-meta">{{ enr.status }} · step {{ enr.current_step }}</span>
              <span class="live-time">{{ new Date(enr.created_at).toLocaleTimeString() }}</span>
            </li>
          </ol>
        </div>
      </section>

      <!-- ─────────── Performance table ─────────── -->
      <section class="perf-section">
        <div class="section-head">
          <span class="rule-dot">Campaign performance</span>
          <span class="section-rule" />
        </div>
        <div class="perf-card">
          <div class="table-scroll">
          <table class="perf-table num-tabular">
            <thead>
              <tr>
                <th class="perf-col-name">Campaign</th>
                <th>Sent</th>
                <th>Failed</th>
                <th>Skipped</th>
                <th>Enrollments</th>
                <th>Completions</th>
                <th>Completion rate</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in campaigns" :key="c.campaign_slug">
                <td class="perf-col-name">
                  <span class="perf-slug">{{ c.campaign_slug }}</span>
                </td>
                <td class="num-pos">{{ c.total_sent.toLocaleString() }}</td>
                <td class="num-neg">{{ c.total_failed.toLocaleString() }}</td>
                <td class="num-muted">{{ c.total_skipped.toLocaleString() }}</td>
                <td>{{ c.enrollments.toLocaleString() }}</td>
                <td class="num-accent">{{ c.completions.toLocaleString() }}</td>
                <td class="num-muted">{{ pctLabel(c.completions, c.enrollments) }}</td>
              </tr>
              <tr v-if="campaigns.length === 0">
                <td colspan="7" class="perf-empty">No campaign data yet.</td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
/* ───────── Hero ───────── */
.hero {
  position: relative;
  padding: 8px 0 40px;
  border-bottom: 1px solid var(--color-divider);
  margin-bottom: 40px;
}

.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
}

.hero-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--color-text-tertiary);
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
}
.hero-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-muted);
}
.hero-status.is-live { color: var(--color-success-text); background: var(--color-success-bg); border-color: var(--color-success-border); }
.hero-status.is-live .hero-status-dot {
  background: var(--color-success);
  box-shadow: 0 0 0 3px rgba(11, 122, 75, 0.15);
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.hero-title {
  font-family: var(--font-display);
  font-weight: 300;
  font-size: clamp(32px, 5.5vw, 72px);
  line-height: 1;
  letter-spacing: -0.035em;
  color: var(--color-text-primary);
  font-variation-settings: 'opsz' 144, 'SOFT' 20;
  margin-bottom: 36px;
}
@media (max-width: 640px) { .hero-title { margin-bottom: 24px; } }
.hero-title > span { display: inline-block; }
.hero-title-comma {
  color: var(--hks-cyan);
  font-weight: 400;
  padding: 0 0.12em 0 0;
}
.hero-title-italic {
  font-style: italic;
  font-variation-settings: 'opsz' 144, 'SOFT' 60, 'WONK' 1;
  color: var(--hks-deep-blue);
  margin-left: 0.12em;
}

.hero-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 32px;
}
@media (min-width: 960px) {
  .hero-grid { grid-template-columns: 1.3fr 1fr; align-items: center; }
}

.hero-metric-label {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
}
.hero-metric-value {
  margin-top: 14px;
  font-family: var(--font-display);
  font-weight: 300;
  font-size: clamp(60px, 8vw, 96px);
  line-height: 0.9;
  letter-spacing: -0.045em;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums lining-nums;
  font-variation-settings: 'opsz' 144, 'SOFT' 30;
}
.hero-metric-delta {
  margin-top: 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.02em;
}
.delta-up { color: var(--color-success); }
.delta-down { color: var(--color-error); }

.hero-side {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 24px;
  border-left: 1px solid var(--color-border);
}
@media (max-width: 959px) {
  .hero-side {
    border-left: none;
    border-top: 1px solid var(--color-border);
    padding: 20px 0 0;
  }
}
.hero-side-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--color-divider);
}
.hero-side-row:last-child { border-bottom: none; padding-bottom: 0; }
.hero-side-label {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
}
.hero-side-num {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 24px;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.015em;
}
.hero-side-num-error { color: var(--color-error); }

/* ───────── Sections ───────── */
.section-head {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}
.section-rule {
  flex: 1;
  height: 1px;
  background: var(--color-divider);
}

.stat-section,
.chart-section,
.live-section,
.perf-section { margin-bottom: 40px; }

/* ───────── Stat grid ───────── */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
@media (min-width: 640px) { .stat-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1100px) { .stat-grid { grid-template-columns: repeat(6, 1fr); } }

.stat-skel {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 20px 22px;
}

/* ───────── Chart ───────── */
.chart-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 24px;
}
.chart-wrap { height: 280px; }

.chart-legend-inline {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-weight: 500;
  letter-spacing: 0.04em;
}
.chart-legend-inline span { display: inline-flex; align-items: center; }
.legend-swatch {
  display: inline-block;
  width: 10px;
  height: 2px;
  margin-right: 6px;
}
.legend-sent { background: var(--hks-deep-blue); }
.legend-failed { background: var(--color-error); }

/* ───────── Live activity ───────── */
.live-pulse {
  position: relative;
  width: 12px;
  height: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.live-pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-success);
  z-index: 2;
}
.live-pulse-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1.5px solid var(--color-success);
  animation: ringOut 1.8s ease-out infinite;
}
@keyframes ringOut {
  0%   { transform: scale(0.5); opacity: 1; }
  100% { transform: scale(1.6); opacity: 0; }
}

.live-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 8px 4px;
  max-height: 360px;
  overflow-y: auto;
}
.live-feed {
  display: flex;
  flex-direction: column;
  list-style: none;
  padding: 0;
  margin: 0;
}
.live-row {
  display: grid;
  grid-template-columns: 76px 1fr auto auto;
  gap: 14px;
  align-items: center;
  padding: 8px 16px;
  font-size: 12.5px;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}
.live-row:hover { background: var(--color-bg-subtle); }

.live-status {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid;
  text-align: center;
}
.live-status[data-status="sent"]     { color: var(--color-success-text); background: var(--color-success-bg); border-color: var(--color-success-border); }
.live-status[data-status="failed"]   { color: var(--color-error-text);   background: var(--color-error-bg);   border-color: var(--color-error-border); }
.live-status[data-status="skipped"]  { color: var(--color-warning-text); background: var(--color-warning-bg); border-color: var(--color-warning-border); }
.live-status[data-status="enroll"]   { color: var(--color-primary-text); background: var(--color-primary-soft); border-color: var(--color-primary-border); }

.live-campaign {
  font-family: var(--font-sans);
  font-weight: 500;
  color: var(--color-text-primary);
}
.live-meta {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
}
.live-time {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
}

/* ───────── Performance table ───────── */
.perf-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.perf-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-sans);
  font-size: 13px;
}
.perf-table thead th {
  position: sticky;
  top: 0;
  padding: 14px 20px;
  text-align: right;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  background: var(--color-bg-table-header);
  border-bottom: 1px solid var(--color-border);
}
.perf-table thead th.perf-col-name { text-align: left; }
.perf-table tbody td {
  padding: 14px 20px;
  text-align: right;
  border-bottom: 1px solid var(--color-divider);
  color: var(--color-text-secondary);
}
.perf-table tbody tr:last-child td { border-bottom: 0; }
.perf-table tbody tr:hover { background: var(--color-bg-subtle); }

.perf-col-name { text-align: left; }
.perf-slug {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-text-primary);
  font-weight: 500;
  letter-spacing: -0.005em;
}

.num-pos { color: var(--color-success); font-weight: 500; }
.num-neg { color: var(--color-error); font-weight: 500; }
.num-muted { color: var(--color-text-muted); }
.num-accent { color: var(--hks-cyan); font-weight: 500; }

.perf-empty {
  text-align: center !important;
  padding: 48px 20px !important;
  color: var(--color-text-muted) !important;
  font-style: italic;
}

/* ───────── Error panel ───────── */
.error-panel {
  padding: 16px 20px;
  background: var(--color-error-bg);
  border: 1px solid var(--color-error-border);
  color: var(--color-error-text);
  border-radius: var(--radius-md);
  font-size: 13.5px;
  font-weight: 500;
  margin-bottom: 24px;
}
</style>
