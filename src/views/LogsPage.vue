<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { fetchLogs, exportLogs } from '@/api/dashboard'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import type { CampaignLog } from '@/api/types'

const auth = useAuthStore()
const { showToast } = useToast()
const exporting = ref(false)

const logs = ref<CampaignLog[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
const page = ref(0)
const limit = 50

const filterCampaign = ref('')
const filterStatus = ref('')
const filterChannel = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params: Record<string, any> = { limit, offset: page.value * limit }
    if (filterCampaign.value) params.campaign = filterCampaign.value
    if (filterStatus.value) params.status = filterStatus.value
    if (filterChannel.value) params.channel = filterChannel.value

    const result = await fetchLogs(params)
    logs.value = result.data || []
    total.value = result.total
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load logs'
  } finally {
    loading.value = false
  }
}

onMounted(load)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch([filterCampaign, filterStatus, filterChannel], () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    page.value = 0
    load()
  }, 300)
})

// Clear any pending debounced fetch so it can't fire after unmount.
onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

async function handleExport() {
  exporting.value = true
  try {
    await exportLogs({ campaign: filterCampaign.value, status: filterStatus.value, channel: filterChannel.value })
    showToast('Logs exported successfully', 'success')
  } catch {
    showToast('Failed to export logs', 'error')
  } finally {
    exporting.value = false
  }
}

function formatDate(d?: string): string {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}
</script>

<template>
  <div class="page-enter">
    <div class="flex items-center justify-between mb-6">
      <PageHeader title="Campaign Logs" description="Audit trail for every campaign step execution" />
      <button
        v-if="auth.canWrite"
        :disabled="exporting"
        @click="handleExport"
        class="px-4 py-2 bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] text-sm font-medium rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors disabled:opacity-50"
      >
        {{ exporting ? 'Exporting...' : 'Export CSV' }}
      </button>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-6">
      <input
        v-model="filterCampaign"
        type="text"
        placeholder="Campaign slug..."
        class="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
      />
      <select v-model="filterStatus" class="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-card)]">
        <!-- Full LogStatus vocabulary from internal/model/campaign.go.
             Keep synced so operators can filter to every terminal state
             the executor emits (bounced/opened/clicked/complaint/
             quiet_hour_deferred were missing and hid events). -->
        <option value="">All statuses</option>
        <option value="sent">Sent</option>
        <option value="delivered">Delivered</option>
        <option value="opened">Opened</option>
        <option value="clicked">Clicked</option>
        <option value="bounced">Bounced</option>
        <option value="failed">Failed</option>
        <option value="complaint">Complaint</option>
        <option value="skipped">Skipped</option>
        <option value="frequency_capped">Frequency Capped</option>
        <option value="no_consent">No Consent</option>
        <option value="condition_not_met">Condition Not Met</option>
        <option value="quiet_hour_deferred">Quiet Hour Deferred</option>
      </select>
      <select v-model="filterChannel" class="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-card)]">
        <option value="">All channels</option>
        <option value="email">Email</option>
        <option value="sms">SMS</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="push">Push</option>
      </select>
    </div>

    <!-- Error -->
    <div v-if="error" class="mb-4 bg-[var(--color-error-bg)] border border-[var(--color-error-border)] text-[var(--color-error-text)] px-4 py-3 rounded-lg text-sm">{{ error }}</div>

    <!-- Table -->
    <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-[var(--color-border)]">
          <thead class="bg-[var(--color-bg-page)]">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Time</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Campaign</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Client</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Step</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Channel</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Provider</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Status</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Error</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--color-border-muted)]">
            <tr v-if="loading">
              <td colspan="8" class="px-4 py-8 text-center text-[var(--color-text-muted)]">Loading...</td>
            </tr>
            <tr v-else-if="logs.length === 0">
              <td colspan="8" class="px-4 py-8 text-center text-[var(--color-text-muted)]">No logs found</td>
            </tr>
            <tr v-for="log in logs" :key="log.id" class="hover:bg-[var(--color-bg-hover)] transition-colors">
              <td class="px-4 py-3 text-xs text-[var(--color-text-tertiary)]">{{ formatDate(log.created_at) }}</td>
              <td class="px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">{{ log.campaign_slug }}</td>
              <td class="px-4 py-3 text-sm text-[var(--color-text-secondary)]">{{ log.client_id }}</td>
              <td class="px-4 py-3 text-sm text-[var(--color-text-secondary)]">{{ log.step_index }}</td>
              <td class="px-4 py-3 text-sm text-[var(--color-text-secondary)]">{{ log.channel }}</td>
              <td class="px-4 py-3 text-sm text-[var(--color-text-tertiary)]">{{ log.provider }}</td>
              <td class="px-4 py-3"><StatusBadge :status="log.status" /></td>
              <td class="px-4 py-3 text-xs text-[var(--color-error-text)] max-w-[200px] truncate" :title="log.error_message">
                {{ log.error_message || '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="px-4 py-3 border-t border-[var(--color-border)] flex items-center justify-between text-sm text-[var(--color-text-tertiary)]">
        <span>{{ total }} total</span>
        <div class="flex gap-2">
          <button :disabled="page === 0" @click="page--; load()" class="px-3 py-1 rounded border border-[var(--color-border)] disabled:opacity-50 hover:bg-[var(--color-bg-hover)] transition-colors">Prev</button>
          <button :disabled="(page + 1) * limit >= total" @click="page++; load()" class="px-3 py-1 rounded border border-[var(--color-border)] disabled:opacity-50 hover:bg-[var(--color-bg-hover)] transition-colors">Next</button>
        </div>
      </div>
    </div>
  </div>
</template>
