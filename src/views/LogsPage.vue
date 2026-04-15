<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ChannelChip from '@/components/ChannelChip.vue'
import DataTable, { type Column } from '@/components/DataTable.vue'
import { fetchLogs, exportLogs } from '@/api/dashboard'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { usePreferencesStore } from '@/stores/preferences'
import type { CampaignLog } from '@/api/types'

const route = useRoute()
const router = useRouter()

const auth = useAuthStore()
const { showToast } = useToast()
const prefs = usePreferencesStore()
const exporting = ref(false)

const logs = ref<CampaignLog[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
// DataTable uses 1-based pages; translate on the API boundary below.
const page = ref(1)
const pageSize = ref(prefs.pageSize || 50)

// Server-side sort. `created_at` desc is the default for logs.
const sortKey = ref<string | null>('created_at')
const sortDir = ref<'asc' | 'desc' | null>('desc')

const columns: Column[] = [
  { key: 'created_at', label: 'Time', sortable: true, width: '160px' },
  { key: 'campaign_slug', label: 'Campaign' },
  { key: 'client_id', label: 'Client' },
  { key: 'step_index', label: 'Step', width: '60px' },
  { key: 'channel', label: 'Channel', width: '120px' },
  { key: 'provider', label: 'Provider' },
  { key: 'status', label: 'Status' },
  { key: 'error_message', label: 'Error' },
]

const filterCampaign = ref((route.query.campaign as string) || '')
const filterStatus = ref((route.query.status as string) || '')
const filterChannel = ref((route.query.channel as string) || '')

// Sync filters → URL so operators can bookmark / share drilled-down views.
// Empty strings are removed from the query string rather than serialised as ''.
function syncQuery() {
  const q: Record<string, string> = { ...route.query } as any
  const delta: Record<string, string | undefined> = {
    campaign: filterCampaign.value || undefined,
    status: filterStatus.value || undefined,
    channel: filterChannel.value || undefined,
  }
  for (const [k, v] of Object.entries(delta)) {
    if (v) q[k] = v; else delete q[k]
  }
  router.replace({ query: q }).catch(() => { /* duplicate nav */ })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params: Record<string, any> = {
      limit: pageSize.value,
      offset: (page.value - 1) * pageSize.value,
    }
    if (filterCampaign.value) params.campaign = filterCampaign.value
    if (filterStatus.value) params.status = filterStatus.value
    if (filterChannel.value) params.channel = filterChannel.value
    // NOTE: backend accepts sort/order; unknown keys are ignored so this
    // degrades gracefully for endpoints that don't yet sort.
    if (sortKey.value && sortDir.value) {
      params.sort = sortKey.value
      params.order = sortDir.value
    }

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
    page.value = 1
    syncQuery()
    load()
  }, 300)
})

// `e` triggers export — matches Enrollments/AuditLogs for muscle-memory.
useKeyboardShortcuts([
  { key: 'e', handler: () => { handleExport() }, description: 'Export current logs' },
])
watch([sortKey, sortDir, page, pageSize], () => load())

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

    <DataTable
      :columns="columns"
      :rows="logs"
      row-key="id"
      :loading="loading"
      :error="error"
      :total="total"
      empty-title="No logs found"
      sortable
      paginated
      v-model:sort-key="sortKey"
      v-model:sort-dir="sortDir"
      v-model:page="page"
      v-model:page-size="pageSize"
      @retry="load"
    >
      <template #cell-created_at="{ row }">
        <span class="text-xs text-[var(--color-text-tertiary)]">{{ formatDate(row.created_at) }}</span>
      </template>
      <template #cell-campaign_slug="{ row }">
        <span class="font-medium text-[var(--color-text-primary)]">{{ row.campaign_slug }}</span>
      </template>
      <template #cell-channel="{ row }">
        <ChannelChip :channel="row.channel" />
      </template>
      <template #cell-status="{ row }">
        <StatusBadge :status="row.status" />
      </template>
      <template #cell-error_message="{ row }">
        <span class="text-xs text-[var(--color-error-text)] inline-block max-w-[200px] truncate align-bottom" :title="row.error_message">
          {{ row.error_message || '—' }}
        </span>
      </template>
    </DataTable>
  </div>
</template>
