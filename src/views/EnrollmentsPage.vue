<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import StatusBadge from '@/components/StatusBadge.vue'
import DataTable, { type Column } from '@/components/DataTable.vue'
import { usePreferencesStore } from '@/stores/preferences'
import { fetchEnrollments, exportEnrollments } from '@/api/dashboard'
import { getEnrollmentStatusVocabulary, DEFAULT_ENROLLMENT_STATUSES } from '@/api/enrollments'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import type { CampaignEnrollment } from '@/api/types'

const auth = useAuthStore()
const { showToast } = useToast()
const prefs = usePreferencesStore()
const exporting = ref(false)

const enrollments = ref<CampaignEnrollment[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
const page = ref(1)
const pageSize = ref(prefs.pageSize || 25)

const sortKey = ref<string | null>('enrolled_at')
const sortDir = ref<'asc' | 'desc' | null>('desc')

const columns: Column[] = [
  { key: 'id', label: 'ID', width: '80px' },
  { key: 'campaign_slug', label: 'Campaign', sortable: true },
  { key: 'client_id', label: 'Client' },
  { key: 'current_step', label: 'Step', width: '60px' },
  { key: 'status', label: 'Status' },
  { key: 'next_step_at', label: 'Next Step At' },
  { key: 'enrolled_at', label: 'Enrolled', sortable: true },
]

// Surface enrollments with a pre-derived campaign_slug so the column
// can read it straight from the row key (the API shape nests it under
// definition.slug, which DataTable's default cell can't reach).
const displayRows = computed(() => enrollments.value.map(e => ({
  ...e,
  campaign_slug: e.definition?.slug ?? e.campaign_definition_id,
})))

const route = useRoute()
const router = useRouter()

const filterStatus = ref((route.query.status as string) || '')
const filterCampaign = ref((route.query.campaign as string) || '')
const filterClient = ref('')

function syncQuery() {
  const q: Record<string, string> = { ...route.query } as any
  const delta: Record<string, string | undefined> = {
    status: filterStatus.value || undefined,
    campaign: filterCampaign.value || undefined,
  }
  for (const [k, v] of Object.entries(delta)) {
    if (v) q[k] = v; else delete q[k]
  }
  router.replace({ query: q }).catch(() => { /* duplicate nav */ })
}
const statusOptions = ref<string[]>([...DEFAULT_ENROLLMENT_STATUSES])

function statusLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params: Record<string, any> = { limit: pageSize.value, offset: (page.value - 1) * pageSize.value }
    if (filterStatus.value) params.status = filterStatus.value
    if (filterCampaign.value) params.campaign = filterCampaign.value
    if (filterClient.value) params.client_id = filterClient.value
    if (sortKey.value && sortDir.value) {
      params.sort = sortKey.value
      params.order = sortDir.value
    }

    const result = await fetchEnrollments(params)
    enrollments.value = result.data || []
    total.value = result.total
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load enrollments'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  // Pull status vocabulary so the filter doesn't silently drop new
  // statuses the backend adds (e.g. 'paused'). Falls back to the
  // hardcoded list on 404 / network error.
  statusOptions.value = await getEnrollmentStatusVocabulary()
  await load()
})

let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch([filterStatus, filterCampaign, filterClient], () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    page.value = 1
    syncQuery()
    load()
  }, 300)
})

useKeyboardShortcuts([
  { key: 'e', handler: () => { handleExport() }, description: 'Export current enrollments' },
])
watch([sortKey, sortDir, page, pageSize], () => load())

// Prevent a pending debounced fetch from firing after the component is
// torn down (it would touch `page` / `load` on a disposed instance).
onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

async function handleExport() {
  exporting.value = true
  try {
    await exportEnrollments({ status: filterStatus.value, campaign: filterCampaign.value, client_id: filterClient.value })
    showToast('Enrollments exported successfully', 'success')
  } catch {
    showToast('Failed to export enrollments', 'error')
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
      <PageHeader title="Enrollments" description="Client campaign enrollment tracking" />
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
      <select v-model="filterStatus" class="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-card)]">
        <!-- Keep synced with EnrollmentStatus* constants in
             internal/model/campaign.go. 'waiting' covers G6
             wait-for-event enrollments paused until an external event
             fires — previously hidden from the filter dropdown. -->
        <option value="">All statuses</option>
        <option v-for="s in statusOptions" :key="s" :value="s">{{ statusLabel(s) }}</option>
      </select>
      <input
        v-model="filterCampaign"
        type="text"
        placeholder="Campaign slug..."
        class="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
      />
      <input
        v-model="filterClient"
        type="text"
        placeholder="Client ID..."
        class="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm w-32"
      />
    </div>

    <DataTable
      :columns="columns"
      :rows="displayRows"
      row-key="id"
      :loading="loading"
      :error="error"
      :total="total"
      empty-title="No enrollments found"
      empty-description="Enrollments are created when a tracked event (e.g. client-registered, checkout-started) matches an active campaign trigger."
      sortable
      paginated
      v-model:sort-key="sortKey"
      v-model:sort-dir="sortDir"
      v-model:page="page"
      v-model:page-size="pageSize"
      @retry="load"
    >
      <template #cell-id="{ row }">#{{ row.id }}</template>
      <template #cell-campaign_slug="{ row }">
        <span class="font-medium text-[var(--color-text-primary)]">{{ row.campaign_slug }}</span>
      </template>
      <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
      <template #cell-next_step_at="{ row }">
        <span class="text-sm text-[var(--color-text-tertiary)]">{{ formatDate(row.next_step_at) }}</span>
      </template>
      <template #cell-enrolled_at="{ row }">
        <span class="text-sm text-[var(--color-text-tertiary)]">{{ formatDate(row.enrolled_at) }}</span>
      </template>
    </DataTable>
  </div>
</template>
