<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { fetchPushAudience, sendPushToAudience } from '@/api/push'
import type { PushAudienceEntry, PushSendResponse } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useEnvironmentStore } from '@/stores/environment'
import { useToast } from '@/composables/useToast'
import { usePreferencesStore } from '@/stores/preferences'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import DataTable, { type Column } from '@/components/DataTable.vue'

const auth = useAuthStore()
const env = useEnvironmentStore()
const { showToast } = useToast()
const prefs = usePreferencesStore()

// --- Audience table state ---
const rows = ref<PushAudienceEntry[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(prefs.pageSize || 25)

const sortKey = ref<string | null>('last_seen_at')
const sortDir = ref<'asc' | 'desc' | null>('desc')

const columns: Column[] = [
  { key: 'client_id', label: 'Client ID' },
  { key: 'device_count', label: 'Devices', width: '90px' },
  { key: 'device_category', label: 'Device' },
  { key: 'locale', label: 'Locale', width: '90px' },
  { key: 'last_seen_at', label: 'Last Seen', sortable: true, width: '160px' },
  { key: 'is_active', label: 'Status', width: '110px' },
]
const loading = ref(true)
const error = ref('')
// Monotonic sequence to drop stale load() responses (env flips, rapid
// filter/pagination clicks) before they overwrite the current view.
const loadSeq = ref(0)

// Filters
const searchInput = ref('')
const filterPlatform = ref('')
const filterActive = ref('')

// Selection — held as array for DataTable v-model compatibility. Other
// call sites that need set-semantics derive a Set via `selectedSet`.
const selectedList = ref<(string | number)[]>([])
const selected = computed(() => new Set(selectedList.value.map(Number)))

// --- Compose state ---
const pushTitle = ref('')
const pushBody = ref('')
const pushLink = ref('')
const sending = ref(false)

const canSend = computed(() =>
  selected.value.size > 0 && pushTitle.value.trim() !== '' && pushBody.value.trim() !== '' && !sending.value
)

// --- Confirmation dialog ---
const showConfirm = ref(false)

// --- Result modal ---
const showResultModal = ref(false)
const sendResult = ref<PushSendResponse | null>(null)

// --- Data loading ---
async function load() {
  const mySeq = ++loadSeq.value
  loading.value = true
  error.value = ''
  try {
    const params: Record<string, any> = { limit: pageSize.value, offset: (page.value - 1) * pageSize.value }
    if (searchInput.value.trim()) params.search = searchInput.value.trim()
    if (filterPlatform.value) params.platform = filterPlatform.value
    if (filterActive.value) params.active = filterActive.value
    params.environment = env.mode
    if (sortKey.value && sortDir.value) {
      params.sort = sortKey.value
      params.order = sortDir.value
    }
    const res = await fetchPushAudience(params)
    if (mySeq !== loadSeq.value) return
    rows.value = res.data || []
    total.value = res.total
  } catch (e: any) {
    if (mySeq !== loadSeq.value) return
    error.value = e.response?.data?.error || 'Failed to load push audience'
  } finally {
    if (mySeq === loadSeq.value) loading.value = false
  }
}

function clearSelectionOnScopeChange() {
  if (selectedList.value.length > 0) {
    selectedList.value = []
    showToast('Selection cleared (filter changed)', 'info')
  }
}

function applyFilters() {
  clearSelectionOnScopeChange()
  page.value = 1
  load()
}

function clearFilters() {
  searchInput.value = ''
  filterPlatform.value = ''
  filterActive.value = ''
  clearSelectionOnScopeChange()
  page.value = 1
  load()
}

watch([sortKey, sortDir, page, pageSize], () => load())

// --- Send ---
function requestSend() {
  if (!auth.canWrite) return
  if (!canSend.value) return
  showConfirm.value = true
}

async function confirmAndSend() {
  if (!auth.canWrite) return
  showConfirm.value = false
  sending.value = true
  try {
    const req = {
      client_ids: Array.from(selected.value) as number[],
      title: pushTitle.value.trim(),
      body: pushBody.value.trim(),
      link: pushLink.value.trim() || undefined,
    }
    const result = await sendPushToAudience(req)
    sendResult.value = result
    showResultModal.value = true

    if (result.summary.sent > 0) {
      showToast(`Push sent to ${result.summary.sent} device(s)`, 'success')
    }
    if (result.summary.failed > 0) {
      showToast(`${result.summary.failed} device(s) failed`, 'warning')
    }
  } catch (e: any) {
    showToast(e.response?.data?.error || 'Failed to send push', 'error')
  } finally {
    sending.value = false
  }
}

function closeResultModal() {
  showResultModal.value = false
  sendResult.value = null
}

function formatDate(d: string) {
  if (!d) return '-'
  return new Date(d).toLocaleString()
}

// Flipping the global env switcher must wipe stale rows/selection AND the
// unsaved draft — otherwise the operator could send a message composed in
// sandbox to clients looked up under production (or vice-versa).
watch(() => env.mode, () => {
  clearSelectionOnScopeChange()
  pushTitle.value = ''
  pushBody.value = ''
  pushLink.value = ''
  page.value = 1
  load()
})

onMounted(load)
</script>

<template>
  <div class="page-enter space-y-6">
    <PageHeader
      title="Push audience"
      description="Browse registered push devices and broadcast notifications to opted-in recipients."
    />

    <!-- Filters -->
    <div class="flex flex-wrap items-end gap-3 bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-4">
      <div>
        <label class="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Search Client ID</label>
        <input v-model="searchInput" type="text" placeholder="e.g. 1234"
          class="form-input w-40"
          @keydown.enter="applyFilters" />
      </div>
      <div>
        <label class="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Platform</label>
        <select v-model="filterPlatform" class="form-select">
          <option value="">All platforms</option>
          <option value="android">Android</option>
          <option value="ios">iOS</option>
          <option value="web">Web</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Status</label>
        <select v-model="filterActive" class="form-select">
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      <button @click="applyFilters" class="btn btn-primary">
        Apply
      </button>
      <button @click="clearFilters" class="btn btn-ghost">
        Clear
      </button>
      <div v-if="selected.size > 0" class="ml-auto text-sm font-medium text-[var(--color-accent)]">
        {{ selected.size }} client{{ selected.size === 1 ? '' : 's' }} selected
      </div>
    </div>

    <DataTable
      :columns="columns"
      :rows="rows"
      row-key="client_id"
      :loading="loading"
      :error="error"
      :total="total"
      empty-title="No push registrations found"
      sortable
      selectable
      paginated
      v-model:sort-key="sortKey"
      v-model:sort-dir="sortDir"
      v-model:selected="selectedList"
      v-model:page="page"
      v-model:page-size="pageSize"
      @retry="load"
    >
      <template #bulk-actions="{ selected: sel }">
        <button
          v-if="auth.canWrite"
          class="btn btn-primary btn-sm"
          :disabled="!canSend"
          @click="requestSend"
        >
          Send to {{ sel.length }} client{{ sel.length === 1 ? '' : 's' }}
        </button>
      </template>
      <template #cell-client_id="{ row }">
        <span class="font-mono text-[var(--color-text-primary)] font-medium">{{ row.client_id }}</span>
      </template>
      <template #cell-device_category="{ row }">
        <span
          v-for="d in ((row.device_categories && row.device_categories.length) ? row.device_categories : row.platforms)"
          :key="d"
          :title="(row.platforms || []).join(', ')"
          class="inline-block mr-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] capitalize"
        >
          {{ d }}
        </span>
      </template>
      <template #cell-locale="{ row }">
        <span class="text-xs text-[var(--color-text-tertiary)]">{{ (row.locales && row.locales[0]) || '—' }}</span>
      </template>
      <template #cell-last_seen_at="{ row }">
        <span class="text-xs text-[var(--color-text-tertiary)] whitespace-nowrap">{{ formatDate(row.last_seen_at) }}</span>
      </template>
      <template #cell-is_active="{ row }">
        <StatusBadge :status="row.is_active ? 'active' : 'inactive'" />
      </template>
    </DataTable>

    <!-- Compose & Send Panel -->
    <div v-if="auth.canWrite" class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6 space-y-4">
      <h2 class="text-lg font-semibold text-[var(--color-text-primary)]">Send Push Notification</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Title *</label>
          <input v-model="pushTitle" type="text" placeholder="Notification title" class="form-input" />
        </div>
        <div>
          <label class="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Link (optional)</label>
          <input v-model="pushLink" type="url" placeholder="https://..." class="form-input" />
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Body *</label>
        <textarea v-model="pushBody" rows="3" placeholder="Notification body text" class="form-textarea" />
      </div>

      <div class="flex items-center justify-between pt-2">
        <span class="text-sm text-[var(--color-text-tertiary)]">
          {{ selected.size > 0 ? `${selected.size} client${selected.size === 1 ? '' : 's'} selected` : 'No clients selected' }}
        </span>
        <button @click="requestSend" :disabled="!canSend" class="btn btn-primary">
          {{ sending ? 'Sending...' : `Send to ${selected.size} client${selected.size === 1 ? '' : 's'}` }}
        </button>
      </div>
    </div>

    <!-- Confirmation Dialog -->
    <ConfirmDialog
      :open="showConfirm"
      title="Confirm Push Send"
      :message="`You are about to send a push notification to ${selected.size} client${selected.size === 1 ? '' : 's'} in the ${env.mode} environment.\n\nTitle: ${pushTitle}\nBody: ${pushBody}${pushLink ? `\nLink: ${pushLink}` : ''}\n\nThis action cannot be undone.`"
      variant="danger"
      :confirm-text="`Send to ${selected.size} client${selected.size === 1 ? '' : 's'}`"
      @confirm="confirmAndSend"
      @cancel="showConfirm = false"
    />

    <!-- Result Modal -->
    <Teleport to="body">
      <div v-if="showResultModal && sendResult" class="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeResultModal" />
        <div class="relative bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-[var(--color-border)]">
            <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">Push Send Results</h3>
          </div>

          <!-- Summary -->
          <div class="px-6 py-3 flex gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg-page)]">
            <span class="text-sm"><strong>Total:</strong> {{ sendResult.summary.total }}</span>
            <span class="text-sm text-[var(--color-success-text)]"><strong>Sent:</strong> {{ sendResult.summary.sent }}</span>
            <span class="text-sm text-[var(--color-error-text)]"><strong>Failed:</strong> {{ sendResult.summary.failed }}</span>
            <span class="text-sm text-[var(--color-warning-text)]"><strong>No Consent:</strong> {{ sendResult.summary.no_consent }}</span>
          </div>

          <!-- Results table -->
          <div class="flex-1 overflow-y-auto px-6 py-3">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-[var(--color-text-tertiary)] text-xs uppercase tracking-wide">
                  <th class="pb-2">Client</th>
                  <th class="pb-2">Device</th>
                  <th class="pb-2">Status</th>
                  <th class="pb-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in sendResult.results" :key="i" class="border-t border-[var(--color-border-muted)]">
                  <td class="py-2 font-mono text-xs">{{ r.client_id }}</td>
                  <td class="py-2 font-mono text-xs text-[var(--color-text-tertiary)]">{{ r.device_token_masked || '-' }}</td>
                  <td class="py-2">
                    <StatusBadge :status="r.status" />
                  </td>
                  <td class="py-2 text-xs text-[var(--color-text-tertiary)]">{{ r.error || r.provider_message_id || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Footer -->
          <div class="px-6 py-3 border-t border-[var(--color-border)] flex justify-end">
            <button @click="closeResultModal" class="btn btn-primary">
              Close
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
