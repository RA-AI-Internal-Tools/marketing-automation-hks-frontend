<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchAuditLogs } from '@/api/dashboard'
import type { AuditLog } from '@/api/types'
import { ShieldCheckIcon } from '@heroicons/vue/24/outline'

const logs = ref<AuditLog[]>([])
const total = ref(0)
const page = ref(1)
const perPage = 50
const loading = ref(true)
const error = ref('')

// Filters
const filterAction = ref('')
const filterDateFrom = ref('')
const filterDateTo = ref('')

const actionOptions = ['create', 'update', 'delete', 'toggle']

const actionColors: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  toggle: 'bg-amber-100 text-amber-700',
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params: Record<string, any> = { limit: perPage, offset: (page.value - 1) * perPage }
    if (filterAction.value) params.action = filterAction.value
    if (filterDateFrom.value) params.since = new Date(filterDateFrom.value).toISOString()
    if (filterDateTo.value) params.until = new Date(filterDateTo.value + 'T23:59:59').toISOString()
    const res = await fetchAuditLogs(params)
    logs.value = res.data
    total.value = res.total
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load audit logs'
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  load()
}

function clearFilters() {
  filterAction.value = ''
  filterDateFrom.value = ''
  filterDateTo.value = ''
  page.value = 1
  load()
}

function prevPage() {
  if (page.value > 1 && !loading.value) { page.value--; load() }
}

function nextPage() {
  if (page.value * perPage < total.value && !loading.value) { page.value++; load() }
}

function formatDetail(detail?: Record<string, any>): string {
  if (!detail) return '-'
  return Object.entries(detail).map(([k, v]) => `${k}: ${v}`).join(', ')
}

onMounted(load)
</script>

<template>
  <div class="page-enter space-y-6">
    <div class="flex items-center gap-3">
      <ShieldCheckIcon class="w-7 h-7 text-[#0099db]" />
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">Audit Logs</h1>
        <p class="text-sm text-[var(--color-text-tertiary)]">Track all administrative actions across the platform</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-end gap-3 bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-4">
      <div>
        <label class="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Action Type</label>
        <select v-model="filterAction"
          class="px-3 py-1.5 text-sm border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]">
          <option value="">All actions</option>
          <option v-for="a in actionOptions" :key="a" :value="a">{{ a }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">From</label>
        <input v-model="filterDateFrom" type="date"
          class="px-3 py-1.5 text-sm border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]" />
      </div>
      <div>
        <label class="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">To</label>
        <input v-model="filterDateTo" type="date"
          class="px-3 py-1.5 text-sm border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]" />
      </div>
      <button @click="applyFilters"
        class="px-4 py-1.5 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors">
        Apply
      </button>
      <button @click="clearFilters"
        class="px-4 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-page)] transition-colors">
        Clear
      </button>
    </div>

    <div v-if="loading" class="text-center py-12 text-[var(--color-text-muted)]">Loading audit logs...</div>

    <div v-else-if="error" class="bg-[var(--color-error-bg)] border border-[var(--color-error-border)] text-[var(--color-error-text)] px-4 py-3 rounded-lg text-sm">{{ error }}</div>

    <div v-else class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-[var(--color-bg-page)]">
          <tr class="text-left text-[var(--color-text-tertiary)] text-xs uppercase tracking-wide">
            <th class="px-4 py-3">Time</th>
            <th class="px-4 py-3">User</th>
            <th class="px-4 py-3">Action</th>
            <th class="px-4 py-3">Resource</th>
            <th class="px-4 py-3">ID</th>
            <th class="px-4 py-3">Details</th>
            <th class="px-4 py-3">IP</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id" class="border-t border-[var(--color-border-muted)] hover:bg-[var(--color-bg-hover)] transition-colors">
            <td class="px-4 py-3 text-[var(--color-text-tertiary)] text-xs whitespace-nowrap">
              {{ new Date(log.created_at).toLocaleString() }}
            </td>
            <td class="px-4 py-3 text-[var(--color-text-secondary)]">{{ log.user_email }}</td>
            <td class="px-4 py-3">
              <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="actionColors[log.action] || 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]'">
                {{ log.action }}
              </span>
            </td>
            <td class="px-4 py-3 text-[var(--color-text-secondary)] font-medium">{{ log.resource }}</td>
            <td class="px-4 py-3 text-[var(--color-text-tertiary)] font-mono text-xs">{{ log.resource_id ?? '-' }}</td>
            <td class="px-4 py-3 text-[var(--color-text-tertiary)] text-xs max-w-xs truncate">{{ formatDetail(log.detail) }}</td>
            <td class="px-4 py-3 text-[var(--color-text-muted)] font-mono text-xs">{{ log.ip_address || '-' }}</td>
          </tr>
          <tr v-if="logs.length === 0">
            <td colspan="7" class="px-4 py-8 text-center text-[var(--color-text-muted)]">No audit logs found</td>
          </tr>
        </tbody>
      </table>

      <div class="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-page)]">
        <span class="text-xs text-[var(--color-text-tertiary)]">{{ total }} total entries</span>
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
  </div>
</template>
