<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AnalyticsLayout from '@/components/AnalyticsLayout.vue'
import { fetchChurn } from '@/api/analytics'

const data = ref<any>(null)
const loading = ref(true)
const error = ref('')

const riskColors: Record<string, string> = {
  low: 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]',
  medium: 'bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-[var(--color-error-soft)] text-[var(--color-error-text)]',
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await fetchChurn()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load churn data'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <AnalyticsLayout title="Churn Risk" description="Client churn prediction and risk scoring">
    <div v-if="loading" class="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>
    <div v-else-if="error" class="bg-[var(--color-error-bg)] border border-[var(--color-error-border)] text-[var(--color-error-text)] px-4 py-3 rounded-lg text-sm">{{ error }}</div>
    <div v-else-if="data" class="space-y-6">
      <!-- Distribution cards -->
      <div v-if="data.distribution" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="level in ['low', 'medium', 'high', 'critical']" :key="level" class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-4">
          <p class="text-xs text-[var(--color-text-tertiary)] uppercase font-semibold">{{ level }}</p>
          <p class="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{{ (data.distribution[level] ?? 0).toLocaleString() }}</p>
        </div>
      </div>

      <!-- At-risk clients table -->
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Top At-Risk Clients</h3>
        <table v-if="data.at_risk_clients?.length" class="w-full text-sm">
          <thead><tr class="text-left text-[var(--color-text-tertiary)] text-xs uppercase">
            <th class="pb-2">Client ID</th>
            <th class="pb-2 text-right">Score</th>
            <th class="pb-2">Risk Level</th>
            <th class="pb-2">Factors</th>
          </tr></thead>
          <tbody>
            <tr v-for="c in data.at_risk_clients" :key="c.client_id" class="border-t border-[var(--color-border-muted)]">
              <td class="py-2 text-[var(--color-text-primary)] font-mono text-xs">{{ c.client_id }}</td>
              <td class="py-2 text-right text-[var(--color-text-secondary)]">{{ c.score?.toFixed(2) }}</td>
              <td class="py-2">
                <span class="inline-block px-2 py-0.5 rounded text-xs font-medium" :class="riskColors[c.risk_level] || 'bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)]'">
                  {{ c.risk_level }}
                </span>
              </td>
              <td class="py-2 text-[var(--color-text-tertiary)] text-xs">{{ (c.factors || []).join(', ') }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="text-sm text-[var(--color-text-muted)]">No at-risk clients identified yet. Churn scoring requires sufficient behavioral data to generate predictions.</p>
      </div>
    </div>
  </AnalyticsLayout>
</template>
