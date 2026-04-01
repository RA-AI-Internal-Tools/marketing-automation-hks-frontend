<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { fetchEnrollments, exportEnrollments } from '@/api/dashboard'
import { useAuthStore } from '@/stores/auth'
import type { CampaignEnrollment } from '@/api/types'

const auth = useAuthStore()

const enrollments = ref<CampaignEnrollment[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
const page = ref(0)
const limit = 25

const filterStatus = ref('')
const filterCampaign = ref('')
const filterClient = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params: Record<string, any> = { limit, offset: page.value * limit }
    if (filterStatus.value) params.status = filterStatus.value
    if (filterCampaign.value) params.campaign = filterCampaign.value
    if (filterClient.value) params.client_id = filterClient.value

    const result = await fetchEnrollments(params)
    enrollments.value = result.data || []
    total.value = result.total
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load enrollments'
  } finally {
    loading.value = false
  }
}

onMounted(load)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch([filterStatus, filterCampaign, filterClient], () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    page.value = 0
    load()
  }, 300)
})

function formatDate(d?: string): string {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}
</script>

<template>
  <div class="page-enter page-enter">
    <div class="flex items-center justify-between mb-6">
      <PageHeader title="Enrollments" description="Client campaign enrollment tracking" />
      <button
        v-if="auth.canWrite"
        @click="exportEnrollments({ status: filterStatus, campaign: filterCampaign, client_id: filterClient })"
        class="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
      >
        Export CSV
      </button>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-6">
      <select v-model="filterStatus" class="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
        <option value="expired">Expired</option>
      </select>
      <input
        v-model="filterCampaign"
        type="text"
        placeholder="Campaign slug..."
        class="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        v-model="filterClient"
        type="text"
        placeholder="Client ID..."
        class="rounded-lg border border-gray-300 px-3 py-2 text-sm w-32"
      />
    </div>

    <!-- Error -->
    <div v-if="error" class="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{{ error }}</div>

    <!-- Table -->
    <div class="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ID</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Campaign</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Step</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Next Step At</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Enrolled</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="loading">
              <td colspan="7" class="px-4 py-8 text-center text-gray-400">Loading...</td>
            </tr>
            <tr v-else-if="enrollments.length === 0">
              <td colspan="7" class="px-4 py-8 text-center text-gray-400">No enrollments found</td>
            </tr>
            <tr v-for="e in enrollments" :key="e.id" class="hover:bg-slate-50/70 transition-colors">
              <td class="px-4 py-3 text-sm text-gray-500">#{{ e.id }}</td>
              <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ e.definition?.slug ?? e.campaign_definition_id }}</td>
              <td class="px-4 py-3 text-sm text-gray-700">{{ e.client_id }}</td>
              <td class="px-4 py-3 text-sm text-gray-700">{{ e.current_step }}</td>
              <td class="px-4 py-3"><StatusBadge :status="e.status" /></td>
              <td class="px-4 py-3 text-sm text-gray-500">{{ formatDate(e.next_step_at) }}</td>
              <td class="px-4 py-3 text-sm text-gray-500">{{ formatDate(e.enrolled_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
        <span>{{ total }} total</span>
        <div class="flex gap-2">
          <button
            :disabled="page === 0"
            @click="page--; load()"
            class="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 hover:bg-slate-50/70 transition-colors"
          >
            Prev
          </button>
          <button
            :disabled="(page + 1) * limit >= total"
            @click="page++; load()"
            class="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 hover:bg-slate-50/70 transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
