<script setup lang="ts">
/**
 * RFMPage — the RFM (Recency-Frequency-Monetary) segmentation dashboard.
 *
 * Sources: /api/rfm/segments for the per-segment counts, /api/rfm/segment/:s
 * for drill-down into a specific cohort. Scores are recomputed nightly by
 * engine.ComputeRFMJob — this page reads the latest snapshot.
 *
 * Layout:
 *   - KPI tiles (total scored clients, win-worthy count, at-risk count)
 *   - Donut chart: segment-share of the scored population
 *   - Table: one row per segment with human-readable label, count,
 *     share %, and a 'Create campaign' shortcut that opens the
 *     campaign editor pre-filtered to the segment.
 *
 * 11 segments come from Kumar & Reinartz — see internal/model/catalog.go
 * constants and internal/rfm/rfm.go segmentFor().
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AnalyticsLayout from '@/components/AnalyticsLayout.vue'
import BaseCard from '@/components/BaseCard.vue'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { fetchRFMSegmentCounts, type RFMSegment } from '@/api/rfm'
import { useToast } from '@/composables/useToast'

ChartJS.register(ArcElement, Tooltip, Legend)

const router = useRouter()
const { showToast } = useToast()

const counts = ref<Record<RFMSegment, number>>({} as any)
const segments = ref<RFMSegment[]>([])
const loading = ref(true)

interface SegmentMeta { key: RFMSegment; label: string; description: string; color: string }

// Segment metadata — kept in the same order as the canonical
// Kumar-Reinartz matrix, highest-value first. Colours are a deliberate
// gradient from emerald (champions) → rose (lost) so the donut reads
// as a health arc.
const SEGMENT_META: SegmentMeta[] = [
  { key: 'champions',       label: 'Champions',         description: 'Bought recently + often + big-ticket. Reward + upsell.',       color: '#059669' },
  { key: 'loyal',           label: 'Loyal',             description: 'Consistent buyers. Make them feel seen.',                       color: '#10b981' },
  { key: 'potential_loyal', label: 'Potential loyal',   description: 'Recent + engaged. Nudge toward the second + third purchase.',    color: '#34d399' },
  { key: 'recent',          label: 'Recent',            description: 'First-time buyers inside the last ~30 days. Classic welcome.',  color: '#6ee7b7' },
  { key: 'promising',       label: 'Promising',         description: 'Recent but low spend. Incentive-test campaigns.',                color: '#a7f3d0' },
  { key: 'need_attention',  label: 'Need attention',    description: 'Mid-recency, mid-frequency. Personalise or lose them.',          color: '#fbbf24' },
  { key: 'about_to_sleep',  label: 'About to sleep',    description: 'Dropping off engagement. Re-engage with soft touches.',          color: '#f59e0b' },
  { key: 'at_risk',         label: 'At risk',           description: 'Older, high value. Retention priority.',                         color: '#f97316' },
  { key: 'cant_lose',       label: "Can't lose",        description: 'Past VIPs slipping away. Direct outreach warranted.',            color: '#dc2626' },
  { key: 'hibernating',     label: 'Hibernating',       description: 'Low recency + low frequency. Winback series material.',          color: '#9ca3af' },
  { key: 'lost',            label: 'Lost',              description: 'Deep inactive. Low-cost reactivation only.',                     color: '#6b7280' },
]

async function load() {
  loading.value = true
  try {
    const data = await fetchRFMSegmentCounts()
    counts.value = data.counts || ({} as any)
    segments.value = data.segments || []
  } catch {
    showToast('Failed to load RFM data', 'error')
  } finally {
    loading.value = false
  }
}
onMounted(load)

const totalScored = computed(() =>
  Object.values(counts.value).reduce<number>((sum, n) => sum + (n || 0), 0),
)

const winWorthy = computed(() =>
  (['champions', 'loyal', 'potential_loyal'] as RFMSegment[])
    .reduce((s, k) => s + (counts.value[k] || 0), 0),
)

const atRisk = computed(() =>
  (['at_risk', 'cant_lose', 'about_to_sleep'] as RFMSegment[])
    .reduce((s, k) => s + (counts.value[k] || 0), 0),
)

const donutData = computed(() => {
  const visible = SEGMENT_META.filter(m => (counts.value[m.key] || 0) > 0)
  return {
    labels: visible.map(m => m.label),
    datasets: [{
      data: visible.map(m => counts.value[m.key] || 0),
      backgroundColor: visible.map(m => m.color),
      borderWidth: 0,
    }],
  }
})
const donutOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { position: 'right' as const, labels: { boxWidth: 12, font: { size: 11 } } } },
  cutout: '62%',
}

function sharePct(seg: RFMSegment): number {
  const n = counts.value[seg] || 0
  if (totalScored.value === 0) return 0
  return Math.round((n / totalScored.value) * 1000) / 10
}

function createCampaignForSegment(seg: RFMSegment) {
  // Deep-link to the campaign editor with the rfm_segment preselected
  // via query string. The editor reads `?rfm_segment=` and seeds the
  // first step's condition_params accordingly.
  router.push({ path: '/campaigns/new', query: { rfm_segment: seg } })
}
</script>

<template>
  <AnalyticsLayout
    title="RFM segmentation"
    description="Recency × Frequency × Monetary scoring over the last 12 months, refreshed nightly."
  >
    <div v-if="loading" class="py-12 text-center text-[var(--color-text-muted)]" role="status">Loading RFM…</div>

    <div v-else class="space-y-4">
      <!-- KPI tiles -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
          <div class="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Scored clients</div>
          <div class="mt-1 text-2xl font-semibold tabular-nums">{{ totalScored.toLocaleString() }}</div>
        </div>
        <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
          <div class="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Win-worthy (champions + loyal + potential)</div>
          <div class="mt-1 text-2xl font-semibold tabular-nums text-emerald-600">{{ winWorthy.toLocaleString() }}</div>
        </div>
        <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
          <div class="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">At risk (at_risk + cant_lose + about_to_sleep)</div>
          <div class="mt-1 text-2xl font-semibold tabular-nums text-rose-600">{{ atRisk.toLocaleString() }}</div>
        </div>
      </div>

      <!-- Donut + table side-by-side on wide screens -->
      <div class="grid gap-4 lg:grid-cols-[420px_1fr]">
        <BaseCard>
          <div class="mb-2 text-sm font-medium">Segment share</div>
          <div style="height: 320px;">
            <Doughnut v-if="totalScored > 0" :data="donutData" :options="donutOptions" />
            <div v-else class="flex h-full items-center justify-center text-sm text-[var(--color-text-muted)]">
              Nightly job hasn't computed scores yet — check back tomorrow.
            </div>
          </div>
        </BaseCard>

        <BaseCard flush class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-[var(--color-bg-subtle)] text-left text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
              <tr>
                <th class="px-4 py-2">Segment</th>
                <th class="px-4 py-2 text-right">Clients</th>
                <th class="px-4 py-2 text-right">Share</th>
                <th class="px-4 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--color-border)]">
              <tr v-for="m in SEGMENT_META" :key="m.key">
                <td class="px-4 py-2">
                  <div class="flex items-start gap-2">
                    <span class="mt-1 h-2 w-2 flex-shrink-0 rounded-full" :style="{ background: m.color }" aria-hidden="true" />
                    <div class="min-w-0">
                      <div class="font-medium">{{ m.label }}</div>
                      <div class="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{{ m.description }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-2 text-right tabular-nums font-medium">{{ (counts[m.key] || 0).toLocaleString() }}</td>
                <td class="px-4 py-2 text-right tabular-nums text-[var(--color-text-tertiary)]">{{ sharePct(m.key) }}%</td>
                <td class="px-4 py-2 text-right">
                  <button
                    @click="createCampaignForSegment(m.key)"
                    class="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1 text-xs font-medium hover:bg-[var(--color-bg-page)]"
                    :aria-label="`Create campaign targeting ${m.label}`"
                  >Create campaign →</button>
                </td>
              </tr>
            </tbody>
          </table>
        </BaseCard>
      </div>
    </div>
  </AnalyticsLayout>
</template>
