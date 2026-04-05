<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { fetchPushAudience, sendPushToAudience } from '@/api/push'
import type { PushAudienceEntry, PushSendResponse } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { BellAlertIcon } from '@heroicons/vue/24/outline'

const auth = useAuthStore()
const { showToast } = useToast()

// --- Audience table state ---
const rows = ref<PushAudienceEntry[]>([])
const total = ref(0)
const page = ref(1)
const perPage = 25
const loading = ref(true)
const error = ref('')

// Filters
const searchInput = ref('')
const filterPlatform = ref('')
const filterActive = ref('')

// Selection
const selected = ref<Set<number>>(new Set())
const allVisibleSelected = computed(() =>
  rows.value.length > 0 && rows.value.every(r => selected.value.has(r.client_id))
)

function toggleSelectAll() {
  if (allVisibleSelected.value) {
    for (const r of rows.value) selected.value.delete(r.client_id)
  } else {
    for (const r of rows.value) selected.value.add(r.client_id)
  }
}

function toggleRow(clientId: number) {
  if (selected.value.has(clientId)) {
    selected.value.delete(clientId)
  } else {
    selected.value.add(clientId)
  }
}

// --- Compose state ---
const pushTitle = ref('')
const pushBody = ref('')
const pushLink = ref('')
const sending = ref(false)

const canSend = computed(() =>
  selected.value.size > 0 && pushTitle.value.trim() !== '' && pushBody.value.trim() !== '' && !sending.value
)

// --- Result modal ---
const showResultModal = ref(false)
const sendResult = ref<PushSendResponse | null>(null)

// --- Data loading ---
async function load() {
  loading.value = true
  error.value = ''
  try {
    const params: Record<string, any> = { limit: perPage, offset: (page.value - 1) * perPage }
    if (searchInput.value.trim()) params.search = searchInput.value.trim()
    if (filterPlatform.value) params.platform = filterPlatform.value
    if (filterActive.value) params.active = filterActive.value
    const res = await fetchPushAudience(params)
    rows.value = res.data || []
    total.value = res.total
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load push audience'
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  load()
}

function clearFilters() {
  searchInput.value = ''
  filterPlatform.value = ''
  filterActive.value = ''
  page.value = 1
  load()
}

function prevPage() {
  if (page.value > 1 && !loading.value) { page.value--; load() }
}

function nextPage() {
  if (page.value * perPage < total.value && !loading.value) { page.value++; load() }
}

// --- Send ---
async function handleSend() {
  if (!canSend.value) return
  sending.value = true
  try {
    const req = {
      client_ids: Array.from(selected.value),
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

const statusColors: Record<string, string> = {
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  no_consent: 'bg-amber-100 text-amber-700',
}

onMounted(load)
</script>

<template>
  <div class="page-enter space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <BellAlertIcon class="w-7 h-7 text-[#0099db]" />
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">Push Audience</h1>
        <p class="text-sm text-[var(--color-text-tertiary)]">Browse registered push users and send notifications</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-end gap-3 bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-4">
      <div>
        <label class="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Search Client ID</label>
        <input v-model="searchInput" type="text" placeholder="e.g. 1234"
          class="px-3 py-1.5 text-sm border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] w-40"
          @keydown.enter="applyFilters" />
      </div>
      <div>
        <label class="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Platform</label>
        <select v-model="filterPlatform"
          class="px-3 py-1.5 text-sm border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]">
          <option value="">All platforms</option>
          <option value="android">Android</option>
          <option value="ios">iOS</option>
          <option value="web">Web</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Status</label>
        <select v-model="filterActive"
          class="px-3 py-1.5 text-sm border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]">
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      <button @click="applyFilters"
        class="px-4 py-1.5 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors">
        Apply
      </button>
      <button @click="clearFilters"
        class="px-4 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-page)] transition-colors">
        Clear
      </button>
      <div v-if="selected.size > 0" class="ml-auto text-sm font-medium text-[var(--color-accent)]">
        {{ selected.size }} client{{ selected.size === 1 ? '' : 's' }} selected
      </div>
    </div>

    <!-- Loading / Error -->
    <div v-if="loading" class="text-center py-12 text-[var(--color-text-muted)]">Loading push audience...</div>
    <div v-else-if="error" class="bg-[var(--color-error-bg)] border border-[var(--color-error-border)] text-[var(--color-error-text)] px-4 py-3 rounded-lg text-sm">{{ error }}</div>

    <!-- Table -->
    <div v-else class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-[var(--color-bg-page)]">
            <tr class="text-left text-[var(--color-text-tertiary)] text-xs uppercase tracking-wide">
              <th class="px-4 py-3 w-10">
                <input type="checkbox" :checked="allVisibleSelected" @change="toggleSelectAll"
                  class="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
              </th>
              <th class="px-4 py-3">Client ID</th>
              <th class="px-4 py-3">Devices</th>
              <th class="px-4 py-3">Platforms</th>
              <th class="px-4 py-3">Last Seen</th>
              <th class="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.client_id"
              class="border-t border-[var(--color-border-muted)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
              @click="toggleRow(row.client_id)">
              <td class="px-4 py-3" @click.stop>
                <input type="checkbox" :checked="selected.has(row.client_id)" @change="toggleRow(row.client_id)"
                  class="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
              </td>
              <td class="px-4 py-3 font-mono text-[var(--color-text-primary)] font-medium">{{ row.client_id }}</td>
              <td class="px-4 py-3 text-[var(--color-text-secondary)]">{{ row.device_count }}</td>
              <td class="px-4 py-3">
                <span v-for="p in row.platforms" :key="p"
                  class="inline-block mr-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]">
                  {{ p }}
                </span>
              </td>
              <td class="px-4 py-3 text-[var(--color-text-tertiary)] text-xs whitespace-nowrap">{{ formatDate(row.last_seen_at) }}</td>
              <td class="px-4 py-3">
                <span :class="[
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  row.is_active ? 'bg-green-100 text-green-700' : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'
                ]">{{ row.is_active ? 'Active' : 'Inactive' }}</span>
              </td>
            </tr>
            <tr v-if="rows.length === 0">
              <td colspan="6" class="px-4 py-8 text-center text-[var(--color-text-muted)]">No push registrations found</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-page)]">
        <span class="text-xs text-[var(--color-text-tertiary)]">{{ total }} total client{{ total === 1 ? '' : 's' }}</span>
        <div class="flex gap-2">
          <button @click="prevPage" :disabled="page <= 1"
            class="px-3 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-page)] disabled:opacity-50">
            Previous
          </button>
          <span class="px-3 py-1 text-xs text-[var(--color-text-secondary)]">Page {{ page }}</span>
          <button @click="nextPage" :disabled="page * perPage >= total"
            class="px-3 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-page)] disabled:opacity-50">
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Compose & Send Panel -->
    <div v-if="auth.canWrite" class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6 space-y-4">
      <h2 class="text-lg font-semibold text-[var(--color-text-primary)]">Send Push Notification</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Title *</label>
          <input v-model="pushTitle" type="text" placeholder="Notification title"
            class="w-full px-3 py-2 text-sm border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]" />
        </div>
        <div>
          <label class="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Link (optional)</label>
          <input v-model="pushLink" type="url" placeholder="https://..."
            class="w-full px-3 py-2 text-sm border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]" />
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Body *</label>
        <textarea v-model="pushBody" rows="3" placeholder="Notification body text"
          class="w-full px-3 py-2 text-sm border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] resize-y" />
      </div>

      <div class="flex items-center justify-between pt-2">
        <span class="text-sm text-[var(--color-text-tertiary)]">
          {{ selected.size > 0 ? `${selected.size} client${selected.size === 1 ? '' : 's'} selected` : 'No clients selected' }}
        </span>
        <button @click="handleSend" :disabled="!canSend"
          class="px-5 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {{ sending ? 'Sending...' : `Send to ${selected.size} client${selected.size === 1 ? '' : 's'}` }}
        </button>
      </div>
    </div>

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
            <span class="text-sm text-green-600"><strong>Sent:</strong> {{ sendResult.summary.sent }}</span>
            <span class="text-sm text-red-600"><strong>Failed:</strong> {{ sendResult.summary.failed }}</span>
            <span class="text-sm text-amber-600"><strong>No Consent:</strong> {{ sendResult.summary.no_consent }}</span>
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
                    <span :class="['px-2 py-0.5 rounded-full text-xs font-medium', statusColors[r.status] || '']">
                      {{ r.status }}
                    </span>
                  </td>
                  <td class="py-2 text-xs text-[var(--color-text-tertiary)]">{{ r.error || r.provider_message_id || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Footer -->
          <div class="px-6 py-3 border-t border-[var(--color-border)] flex justify-end">
            <button @click="closeResultModal"
              class="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
