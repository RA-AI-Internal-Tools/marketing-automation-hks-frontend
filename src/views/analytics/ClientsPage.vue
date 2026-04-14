<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import AnalyticsLayout from '@/components/AnalyticsLayout.vue'
import MetricCard from '@/components/MetricCard.vue'
import { useAnalyticsStore } from '@/stores/analytics'
import { fetchUsers } from '@/api/analytics'
import type { UsersData } from '@/api/types'

const analytics = useAnalyticsStore()
const data = ref<UsersData | null>(null)
const loading = ref(true)
const error = ref('')

const normalizedTopEvents = computed(() => {
  const events = data.value?.top_events || []
  return events.map((e: any) => ({
    key: e.event_type || e.name || 'unknown',
    label: e.event_type || e.name || 'unknown',
    count: Number(e.count ?? e.value ?? 0),
  }))
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await fetchUsers(analytics.since, analytics.until)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load client analytics'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => analytics.queryParams, load)
</script>

<template>
  <AnalyticsLayout title="Clients & Behavior" description="Active clients, top events, and demographics">
    <div v-if="loading" class="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>
    <div v-else-if="error" class="bg-[var(--color-error-bg)] border border-[var(--color-error-border)] text-[var(--color-error-text)] px-4 py-3 rounded-lg text-sm">{{ error }}</div>
    <div v-else-if="data" class="space-y-6">
      <div class="grid grid-cols-3 gap-4">
        <MetricCard title="DAU" :value="data.dau.toLocaleString()" />
        <MetricCard title="WAU" :value="data.wau.toLocaleString()" />
        <MetricCard title="MAU" :value="data.mau.toLocaleString()" />
      </div>
      <p class="text-xs text-[var(--color-text-muted)] -mt-2">DAU/WAU counts unique client IDs from <code class="bg-[var(--color-bg-subtle)] px-1 rounded">page-view</code> events in the selected period. MAU may differ due to date-range query limits in the current Tracardi version.</p>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
          <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Top Events</h3>
          <table class="w-full text-sm">
            <thead><tr class="text-left text-[var(--color-text-tertiary)] text-xs uppercase">
              <th class="pb-2">Event</th><th class="pb-2 text-right">Count</th>
            </tr></thead>
            <tbody>
              <tr v-for="e in normalizedTopEvents" :key="e.key" class="border-t border-[var(--color-border-muted)]">
                <td class="py-2 text-[var(--color-text-primary)] font-mono text-xs">{{ e.label }}</td>
                <td class="py-2 text-right text-[var(--color-text-secondary)]">{{ e.count.toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
          <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Geographic Distribution</h3>
          <table class="w-full text-sm">
            <thead><tr class="text-left text-[var(--color-text-tertiary)] text-xs uppercase">
              <th class="pb-2">Country</th><th class="pb-2 text-right">Clients</th>
            </tr></thead>
            <tbody>
              <tr v-for="g in data.geo_distribution" :key="g.country" class="border-t border-[var(--color-border-muted)]">
                <td class="py-2 text-[var(--color-text-primary)]">{{ g.country }}</td>
                <td class="py-2 text-right text-[var(--color-text-secondary)]">{{ g.count.toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </AnalyticsLayout>
</template>
