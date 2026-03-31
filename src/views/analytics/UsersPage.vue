<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import AnalyticsLayout from '@/components/AnalyticsLayout.vue'
import MetricCard from '@/components/MetricCard.vue'
import { useAnalyticsStore } from '@/stores/analytics'
import { fetchUsers } from '@/api/analytics'
import type { UsersData } from '@/api/types'

const analytics = useAnalyticsStore()
const data = ref<UsersData | null>(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await fetchUsers(analytics.since, analytics.until)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load user analytics'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => analytics.queryParams, load)
</script>

<template>
  <AnalyticsLayout title="Users & Behavior" description="Active users, top events, and demographics">
    <div v-if="loading" class="text-center py-12 text-gray-400">Loading...</div>
    <div v-else-if="data" class="space-y-6">
      <div class="grid grid-cols-3 gap-4">
        <MetricCard title="DAU" :value="data.dau.toLocaleString()" />
        <MetricCard title="WAU" :value="data.wau.toLocaleString()" />
        <MetricCard title="MAU" :value="data.mau.toLocaleString()" />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-xl border border-gray-200 p-6">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">Top Events</h3>
          <table class="w-full text-sm">
            <thead><tr class="text-left text-gray-500 text-xs uppercase">
              <th class="pb-2">Event</th><th class="pb-2 text-right">Count</th>
            </tr></thead>
            <tbody>
              <tr v-for="e in data.top_events" :key="e.event_type" class="border-t border-gray-100">
                <td class="py-2 text-gray-900 font-mono text-xs">{{ e.event_type }}</td>
                <td class="py-2 text-right text-gray-600">{{ e.count.toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-6">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">Geographic Distribution</h3>
          <table class="w-full text-sm">
            <thead><tr class="text-left text-gray-500 text-xs uppercase">
              <th class="pb-2">Country</th><th class="pb-2 text-right">Users</th>
            </tr></thead>
            <tbody>
              <tr v-for="g in data.geo_distribution" :key="g.country" class="border-t border-gray-100">
                <td class="py-2 text-gray-900">{{ g.country }}</td>
                <td class="py-2 text-right text-gray-600">{{ g.count.toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </AnalyticsLayout>
</template>
