<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import AnalyticsLayout from '@/components/AnalyticsLayout.vue'
import { useAnalyticsStore } from '@/stores/analytics'
import { fetchAttribution } from '@/api/analytics'

const analytics = useAnalyticsStore()
const data = ref<any>(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await fetchAttribution(analytics.since, analytics.until)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load attribution data'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => analytics.queryParams, load)
</script>

<template>
  <AnalyticsLayout title="Multi-Touch Attribution" description="Campaign attribution across customer touchpoints">
    <div v-if="loading" class="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>
    <div v-else-if="error" class="bg-[var(--color-error-bg)] border border-[var(--color-error-border)] text-[var(--color-error-text)] px-4 py-3 rounded-lg text-sm">{{ error }}</div>
    <div v-else-if="data" class="space-y-6">
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Campaign Attribution</h3>
        <table v-if="data.campaigns?.length" class="w-full text-sm">
          <thead><tr class="text-left text-[var(--color-text-tertiary)] text-xs uppercase">
            <th class="pb-2">Campaign</th>
            <th class="pb-2 text-right">Touches</th>
            <th class="pb-2 text-right">Conversions</th>
            <th class="pb-2 text-right">Conv. Rate</th>
          </tr></thead>
          <tbody>
            <tr v-for="c in data.campaigns" :key="c.campaign_name" class="border-t border-[var(--color-border-muted)]">
              <td class="py-2 text-[var(--color-text-primary)] font-mono text-xs">{{ c.campaign_name }}</td>
              <td class="py-2 text-right text-[var(--color-text-secondary)]">{{ c.touches?.toLocaleString() }}</td>
              <td class="py-2 text-right text-[var(--color-text-secondary)]">{{ c.conversions?.toLocaleString() }}</td>
              <td class="py-2 text-right text-green-600">{{ c.conversion_rate?.toFixed(1) }}%</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="text-sm text-[var(--color-text-muted)]">No attribution data yet. Attribution data populates as campaigns generate touchpoints and conversions.</p>
      </div>
    </div>
  </AnalyticsLayout>
</template>
