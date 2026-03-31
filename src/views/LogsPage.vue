<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { fetchLogs, exportLogs } from '@/api/dashboard'
import { useAuthStore } from '@/stores/auth'
import type { CampaignLog } from '@/api/types'

const auth = useAuthStore()

const logs = ref<CampaignLog[]>([])
const total = ref(0)
const loading = ref(true)
const page = ref(0)
const limit = 50

const filterCampaign = ref('')
const filterStatus = ref('')
const filterChannel = ref('')

async function load() {
  loading.value = true
  try {
    const params: Record<string, any> = { limit, offset: page.value * limit }
    if (filterCampaign.value) params.campaign = filterCampaign.value
    if (filterStatus.value) params.status = filterStatus.value
    if (filterChannel.value) params.channel = filterChannel.value

    const result = await fetchLogs(params)
    logs.value = result.data || []
    total.value = result.total
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch([filterCampaign, filterStatus, filterChannel], () => { page.value = 0; load() })

function formatDate(d?: string): string {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <PageHeader title="Campaign Logs" description="Audit trail for every campaign step execution" />
      <button
        v-if="auth.canWrite"
        @click="exportLogs({ campaign: filterCampaign, status: filterStatus, channel: filterChannel })"
        class="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
      >
        Export CSV
      </button>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-6">
      <input
        v-model="filterCampaign"
        type="text"
        placeholder="Campaign slug..."
        class="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <select v-model="filterStatus" class="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
        <option value="">All statuses</option>
        <option value="sent">Sent</option>
        <option value="failed">Failed</option>
        <option value="skipped">Skipped</option>
        <option value="frequency_capped">Frequency Capped</option>
        <option value="no_consent">No Consent</option>
        <option value="condition_not_met">Condition Not Met</option>
      </select>
      <select v-model="filterChannel" class="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
        <option value="">All channels</option>
        <option value="email">Email</option>
        <option value="sms">SMS</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="push">Push</option>
      </select>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Time</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Campaign</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Step</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Channel</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Provider</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Error</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="loading">
              <td colspan="8" class="px-4 py-8 text-center text-gray-400">Loading...</td>
            </tr>
            <tr v-else-if="logs.length === 0">
              <td colspan="8" class="px-4 py-8 text-center text-gray-400">No logs found</td>
            </tr>
            <tr v-for="log in logs" :key="log.id" class="hover:bg-gray-50">
              <td class="px-4 py-3 text-xs text-gray-500">{{ formatDate(log.created_at) }}</td>
              <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ log.campaign_slug }}</td>
              <td class="px-4 py-3 text-sm text-gray-700">{{ log.client_id }}</td>
              <td class="px-4 py-3 text-sm text-gray-700">{{ log.step_index }}</td>
              <td class="px-4 py-3 text-sm text-gray-700">{{ log.channel }}</td>
              <td class="px-4 py-3 text-sm text-gray-500">{{ log.provider }}</td>
              <td class="px-4 py-3"><StatusBadge :status="log.status" /></td>
              <td class="px-4 py-3 text-xs text-red-500 max-w-[200px] truncate" :title="log.error_message">
                {{ log.error_message || '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
        <span>{{ total }} total</span>
        <div class="flex gap-2">
          <button :disabled="page === 0" @click="page--; load()" class="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50">Prev</button>
          <button :disabled="(page + 1) * limit >= total" @click="page++; load()" class="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50">Next</button>
        </div>
      </div>
    </div>
  </div>
</template>
