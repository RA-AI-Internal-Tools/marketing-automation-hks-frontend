<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import AnalyticsLayout from '@/components/AnalyticsLayout.vue'
import { useAnalyticsStore } from '@/stores/analytics'
import { fetchCohort, fetchLTV } from '@/api/analytics'

const analytics = useAnalyticsStore()
const cohortData = ref<any>(null)
const ltvData = ref<any>(null)
const loading = ref(true)
const error = ref('')

function retentionColor(pct: number): string {
  if (pct >= 80) return 'bg-green-600 text-white'
  if (pct >= 60) return 'bg-green-400 text-white'
  if (pct >= 40) return 'bg-yellow-400 text-gray-900'
  if (pct >= 20) return 'bg-orange-400 text-white'
  if (pct > 0) return 'bg-red-400 text-white'
  return 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [c, l] = await Promise.all([
      fetchCohort(analytics.since, analytics.until),
      fetchLTV(analytics.since, analytics.until),
    ])
    cohortData.value = c
    ltvData.value = l
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load cohort data'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => analytics.queryParams, load)
</script>

<template>
  <AnalyticsLayout title="Cohorts & LTV" description="Cohort retention heatmap and lifetime value metrics">
    <div v-if="loading" class="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>
    <div v-else-if="error" class="bg-[var(--color-error-bg)] border border-[var(--color-error-border)] text-[var(--color-error-text)] px-4 py-3 rounded-lg text-sm">{{ error }}</div>
    <div v-else class="space-y-6">
      <!-- LTV Metrics -->
      <div v-if="ltvData" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-4">
          <p class="text-xs text-[var(--color-text-tertiary)] uppercase font-semibold">Avg LTV</p>
          <p class="text-2xl font-bold text-[var(--color-text-primary)] mt-1">${{ (ltvData.avg_ltv ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
        </div>
        <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-4">
          <p class="text-xs text-[var(--color-text-tertiary)] uppercase font-semibold">Avg Lifespan</p>
          <p class="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{{ (ltvData.avg_lifespan_months ?? 0).toFixed(1) }} months</p>
        </div>
        <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-4">
          <p class="text-xs text-[var(--color-text-tertiary)] uppercase font-semibold">Avg Revenue / Month</p>
          <p class="text-2xl font-bold text-[var(--color-text-primary)] mt-1">${{ (ltvData.avg_revenue_per_month ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
        </div>
      </div>

      <!-- Cohort heatmap -->
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Cohort Retention Heatmap</h3>
        <div v-if="cohortData?.cohorts?.length" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-[var(--color-text-tertiary)] text-xs uppercase">
                <th class="pb-2 pr-3">Cohort</th>
                <th class="pb-2 pr-3 text-right">Users</th>
                <th v-for="(_, i) in cohortData.cohorts[0]?.periods || []" :key="i" class="pb-2 text-center min-w-[48px]">
                  M{{ i }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in cohortData.cohorts" :key="row.cohort" class="border-t border-[var(--color-border-muted)]">
                <td class="py-1.5 pr-3 text-[var(--color-text-primary)] font-mono text-xs whitespace-nowrap">{{ row.cohort }}</td>
                <td class="py-1.5 pr-3 text-right text-[var(--color-text-secondary)]">{{ row.total?.toLocaleString() }}</td>
                <td v-for="(pct, i) in row.periods" :key="i" class="py-1.5 text-center">
                  <span class="inline-block px-1.5 py-0.5 rounded text-xs font-medium min-w-[40px]" :class="retentionColor(pct)">
                    {{ pct.toFixed(0) }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-sm text-[var(--color-text-muted)]">Cohort data requires at least 2 months of registration events to build meaningful retention cohorts.</p>
      </div>
    </div>
  </AnalyticsLayout>
</template>
