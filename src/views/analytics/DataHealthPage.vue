<script setup lang="ts">
import { ref, onMounted } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { fetchDataHealth } from '@/api/analytics'
import type { DataHealthData } from '@/api/types'

const data = ref<DataHealthData | null>(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    data.value = await fetchDataHealth()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load data health'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <PageHeader title="Data Health" description="System connectivity, event freshness, and data quality" />

    <div v-if="loading" class="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>
    <div v-else-if="error" class="bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-xl p-4 text-[var(--color-error-text)] text-sm">{{ error }}</div>
    <div v-else-if="data" class="space-y-6">
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Service Status</h3>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div v-for="s in data.services" :key="s.name" class="flex items-center gap-2 p-3 bg-[var(--color-bg-page)] rounded-lg">
            <span
              :class="[
                'h-3 w-3 rounded-full',
                s.status === 'up' ? 'bg-green-500' : 'bg-red-500',
              ]"
            />
            <span class="text-sm text-[var(--color-text-secondary)] capitalize">{{ s.name }}</span>
          </div>
        </div>
      </div>

      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Event Freshness</h3>
        <p class="text-xs text-[var(--color-text-muted)] mb-4">Counts are pulled from the Tracardi event store. "Last seen" is inferred from count windows — real-time timestamps are not available in this Tracardi version.</p>
        <table class="w-full text-sm">
          <thead><tr class="text-left text-[var(--color-text-tertiary)] text-xs uppercase">
            <th class="pb-2">Event Type</th><th class="pb-2 text-right">Last Seen</th><th class="pb-2 text-right">24h Count</th><th class="pb-2 text-right">7d Total</th>
          </tr></thead>
          <tbody>
            <tr v-for="e in data.event_freshness" :key="e.event_type" class="border-t border-[var(--color-border-muted)]">
              <td class="py-2 text-[var(--color-text-primary)] font-mono text-xs">{{ e.event_type }}</td>
              <td class="py-2 text-right text-xs" :class="e.last_seen && e.last_seen !== 'never' ? 'text-green-600' : 'text-[var(--color-text-muted)]'">{{ e.last_seen || 'never' }}</td>
              <td class="py-2 text-right" :class="e.count_24h > 0 ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'">{{ e.count_24h.toLocaleString() }}</td>
              <td class="py-2 text-right text-[var(--color-text-secondary)]">{{ Math.round((e.avg_7d ?? 0) * 7).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="data.volume_anomalies.length" class="bg-[var(--color-bg-card)] rounded-xl border border-yellow-200 p-6">
        <h3 class="text-sm font-semibold text-yellow-800 mb-4">Volume Anomalies</h3>
        <table class="w-full text-sm">
          <thead><tr class="text-left text-[var(--color-text-tertiary)] text-xs uppercase">
            <th class="pb-2">Event</th><th class="pb-2 text-right">Current</th>
            <th class="pb-2 text-right">Average</th><th class="pb-2 text-right">Deviation</th>
          </tr></thead>
          <tbody>
            <tr v-for="a in data.volume_anomalies" :key="a.event_type" class="border-t border-yellow-100">
              <td class="py-2 text-[var(--color-text-primary)] font-mono text-xs">{{ a.event_type }}</td>
              <td class="py-2 text-right">{{ a.current.toLocaleString() }}</td>
              <td class="py-2 text-right text-[var(--color-text-secondary)]">{{ a.average.toFixed(0) }}</td>
              <td class="py-2 text-right" :class="a.deviation > 0 ? 'text-green-600' : 'text-red-600'">
                {{ a.deviation > 0 ? '+' : '' }}{{ a.deviation.toFixed(1) }}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
