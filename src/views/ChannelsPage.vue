<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import { fetchChannelStats } from '@/api/dashboard'
import { chartPalette, getDesignColor } from '@/utils/chartColors'
import { CHANNEL_BREAKDOWN_STATUSES, logStatusLabel } from '@/constants/logStatus'
import type { ChannelCountKey } from '@/constants/logStatus'
import type { ChannelStats } from '@/api/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const channels = ref<ChannelStats[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    channels.value = await fetchChannelStats()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load channel stats'
  } finally {
    loading.value = false
  }
})

const totalSent = computed(() => channels.value.reduce((s, c) => s + c.sent, 0))
const totalFailed = computed(() => channels.value.reduce((s, c) => s + c.failed, 0))
const successRate = computed(() => {
  const total = totalSent.value + totalFailed.value
  return total > 0 ? Math.round((totalSent.value / total) * 100) : 0
})

// Value-column colour per status.
//
// `Record<ChannelCountKey, string>` — total over the count-carrying fields
// of ChannelStats, with no `??` fallback at the call site — is what makes
// the claim in this comment true rather than aspirational. It previously
// read "adding a status to that list surfaces here too rather than
// silently rendering unstyled" while `valueClass[status] ?? grey` did the
// exact opposite: an unrecognised status was styled the same grey as
// `skipped`, so a new status looked like a deliberate no-op. Now a new
// count column on the DTO is a vue-tsc error here until someone picks a
// colour for it.
const valueClass: Record<ChannelCountKey, string> = {
  sent: 'text-[var(--color-success-text)]',
  failed: 'text-[var(--color-error-text)]',
  skipped: 'text-[var(--color-text-secondary)]',
  frequency_capped: 'text-[var(--color-warning-text)]',
  no_consent: 'text-[var(--color-warning-text)]',
  // `info`, deliberately, and matching StatusBadge.vue's colour for the same
  // status. The warning tint above means "we decided not to send" — a policy
  // outcome. This one means "we could not decide", which is an operational
  // fault of ours and not a statement about the customer, so it must not
  // share the palette of the consent/frequency decisions sitting next to it.
  gate_unavailable: 'text-[var(--color-info-text)]',
}

// Every row on a per-channel card is a 1:1 count of ONE campaign_logs
// status, and its label comes from the shared vocabulary — never a
// hand-typed string. See src/constants/logStatus.ts.
//
// `ch[status]` is a plain checked index: CHANNEL_BREAKDOWN_STATUSES is
// typed `readonly ChannelCountKey[]`, so every status here is a required
// numeric field of the DTO the backend actually sends. The previous
// `(ch as unknown as Record<string, number>)[status] ?? 0` erased that
// check and turned a status the DTO does not carry into a confident,
// type-clean `0` on the dashboard.
function breakdownRows(ch: ChannelStats) {
  return CHANNEL_BREAKDOWN_STATUSES.map((status) => ({
    status,
    label: logStatusLabel(status),
    value: ch[status],
    cls: valueClass[status],
  }))
}

const chartData = computed(() => {
  const p = chartPalette()
  return {
    labels: channels.value.map((c) => c.channel.toUpperCase()),
    datasets: [
      { label: logStatusLabel('sent'),             data: channels.value.map((c) => c.sent),              backgroundColor: p.success },
      { label: logStatusLabel('failed'),           data: channels.value.map((c) => c.failed),            backgroundColor: p.error },
      { label: logStatusLabel('frequency_capped'), data: channels.value.map((c) => c.frequency_capped),  backgroundColor: p.warning },
      // No-consent uses a distinct orange-ish tint that isn't in the
      // 9-colour palette; pulled from --chart-10 so dark-mode keeps the
      // warning-adjacent-but-different semantic.
      { label: logStatusLabel('no_consent'),       data: channels.value.map((c) => c.no_consent),        backgroundColor: getDesignColor('--chart-10', '#f97316') },
    ],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'top' as const } },
  scales: { x: { stacked: false }, y: { beginAtZero: true } },
}
</script>

<template>
  <div class="page-enter">
    <PageHeader title="Channel Analytics" description="Message delivery performance per channel" />

    <div v-if="loading" class="text-center py-12 text-[var(--color-text-muted)]">Loading channels...</div>

    <div v-else-if="error" class="bg-[var(--color-error-bg)] border border-[var(--color-error-border)] text-[var(--color-error-text)] px-4 py-3 rounded-lg text-sm">{{ error }}</div>

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        <StatCard title="Total Sent" :value="totalSent" color="green" />
        <StatCard title="Total Failed" :value="totalFailed" color="red" />
        <StatCard title="Success Rate" :value="`${successRate}%`" color="indigo" />
      </div>

      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6 mb-8">
        <h2 class="text-lg font-semibold tracking-tight text-[var(--color-text-primary)] mb-4">Channel Breakdown</h2>
        <div class="h-72">
          <Bar :data="chartData" :options="chartOptions" />
        </div>
      </div>

      <!-- Per-channel detail cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div v-for="ch in channels" :key="ch.channel" class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-5">
          <h3 class="text-sm font-semibold text-[var(--color-text-primary)] uppercase mb-3">{{ ch.channel }}</h3>
          <div class="space-y-2 text-sm">
            <div
              v-for="row in breakdownRows(ch)"
              :key="row.status"
              class="flex justify-between"
              data-test="channel-stat"
              :data-status="row.status"
            >
              <span class="text-[var(--color-text-tertiary)]" data-test="channel-stat-label">{{ row.label }}</span>
              <span class="font-medium" :class="row.cls" data-test="channel-stat-value">{{ row.value }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
