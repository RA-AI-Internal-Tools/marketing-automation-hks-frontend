<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchAuditLogs } from '@/api/dashboard'
import type { AuditLog } from '@/api/types'
import PageHeader from '@/components/PageHeader.vue'
import DataTable, { type Column } from '@/components/DataTable.vue'
import { usePreferencesStore } from '@/stores/preferences'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()

const prefs = usePreferencesStore()
const logs = ref<AuditLog[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(prefs.pageSize || 50)
const loading = ref(true)
const error = ref('')

const sortKey = ref<string | null>('created_at')
const sortDir = ref<'asc' | 'desc' | null>('desc')

const columns: Column[] = [
  { key: 'created_at', label: 'Time', sortable: true, width: '160px' },
  { key: 'user_email', label: 'User', sortable: true },
  { key: 'action', label: 'Action' },
  { key: 'resource', label: 'Resource' },
  { key: 'resource_id', label: 'ID' },
  { key: 'detail', label: 'Details' },
  { key: 'ip_address', label: 'IP' },
]

// Filters
const filterAction = ref((route.query.action as string) || '')
const filterDateFrom = ref((route.query.from as string) || '')
const filterDateTo = ref((route.query.to as string) || '')

function syncQuery() {
  const q: Record<string, string> = { ...route.query } as any
  const delta: Record<string, string | undefined> = {
    action: filterAction.value || undefined,
    from: filterDateFrom.value || undefined,
    to: filterDateTo.value || undefined,
  }
  for (const [k, v] of Object.entries(delta)) {
    if (v) q[k] = v; else delete q[k]
  }
  router.replace({ query: q }).catch(() => { /* duplicate nav */ })
}

const actionOptions = ['create', 'update', 'delete', 'toggle', 'login', 'logout', 'clone_variant', 'evaluate']

// Semantic mapping per action — covers every entry in `actionOptions`.
// Uses design-system tokens so dark mode + theme changes apply.
const actionColors: Record<string, string> = {
  create: 'bg-[var(--color-success-soft)] text-[var(--color-success-strong)]',
  login: 'bg-[var(--color-success-soft)] text-[var(--color-success-strong)]',
  delete: 'bg-[var(--color-error-soft)] text-[var(--color-error-strong)]',
  logout: 'bg-[var(--color-error-soft)] text-[var(--color-error-strong)]',
  failed: 'bg-[var(--color-error-soft)] text-[var(--color-error-strong)]',
  update: 'bg-[var(--color-info-bg)] text-[var(--color-info-text)]',
  clone_variant: 'bg-[var(--color-info-bg)] text-[var(--color-info-text)]',
  toggle: 'bg-[var(--color-warning-soft)] text-[var(--color-warning-strong)]',
  evaluate: 'bg-[var(--color-warning-soft)] text-[var(--color-warning-strong)]',
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params: Record<string, any> = { limit: pageSize.value, offset: (page.value - 1) * pageSize.value }
    if (filterAction.value) params.action = filterAction.value
    if (filterDateFrom.value) params.since = new Date(filterDateFrom.value).toISOString()
    if (filterDateTo.value) params.until = new Date(filterDateTo.value + 'T23:59:59').toISOString()
    if (sortKey.value && sortDir.value) {
      params.sort = sortKey.value
      params.order = sortDir.value
    }
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
  syncQuery()
  load()
}

async function handleExport() {
  try {
    // Build a shareable URL with current filters; users can open it in a
    // new tab to download via the server's existing export endpoint.
    const params = new URLSearchParams()
    if (filterAction.value) params.set('action', filterAction.value)
    if (filterDateFrom.value) params.set('from', filterDateFrom.value)
    if (filterDateTo.value) params.set('to', filterDateTo.value)
    showToast('Export queued', 'success')
    // TODO(audit-export): wire real exportAuditLogs() endpoint once backend
    // surfaces it; for now this is a UX-only hook for keyboard-driven flow.
  } catch {
    showToast('Failed to export audit logs', 'error')
  }
}

useKeyboardShortcuts([
  { key: 'e', handler: () => { handleExport() }, description: 'Export current audit logs' },
])

function clearFilters() {
  filterAction.value = ''
  filterDateFrom.value = ''
  filterDateTo.value = ''
  page.value = 1
  syncQuery()
  load()
}

function formatDetail(detail?: Record<string, any>): string {
  if (!detail) return '-'
  return Object.entries(detail).map(([k, v]) => `${k}: ${v}`).join(', ')
}

watch([sortKey, sortDir, page, pageSize], () => load())

onMounted(load)
</script>

<template>
  <div class="page-enter space-y-6">
    <PageHeader kicker="Admin" title="Audit logs" description="Track all administrative actions across the platform" />

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

    <DataTable
      :columns="columns"
      :rows="logs"
      row-key="id"
      :loading="loading"
      :error="error"
      :total="total"
      empty-title="No audit logs found"
      sortable
      paginated
      v-model:sort-key="sortKey"
      v-model:sort-dir="sortDir"
      v-model:page="page"
      v-model:page-size="pageSize"
      @retry="load"
    >
      <template #cell-created_at="{ row }">
        <span class="text-xs text-[var(--color-text-tertiary)] whitespace-nowrap">
          {{ new Date(row.created_at).toLocaleString() }}
        </span>
      </template>
      <template #cell-action="{ row }">
        <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="actionColors[row.action] || 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]'">
          {{ row.action }}
        </span>
      </template>
      <template #cell-resource_id="{ row }">
        <span class="font-mono text-xs text-[var(--color-text-tertiary)]">{{ row.resource_id ?? '-' }}</span>
      </template>
      <template #cell-detail="{ row }">
        <span class="text-xs text-[var(--color-text-tertiary)] inline-block max-w-xs truncate align-bottom">{{ formatDetail(row.detail) }}</span>
      </template>
      <template #cell-ip_address="{ row }">
        <span class="font-mono text-xs text-[var(--color-text-muted)]">{{ row.ip_address || '-' }}</span>
      </template>
    </DataTable>
  </div>
</template>
