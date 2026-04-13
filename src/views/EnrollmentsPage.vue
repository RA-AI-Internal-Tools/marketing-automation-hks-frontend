<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { fetchEnrollments, exportEnrollments } from '@/api/dashboard'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import type { CampaignEnrollment } from '@/api/types'

const auth = useAuthStore()
const { showToast } = useToast()
const exporting = ref(false)

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
        <option value="active">Active</option>
        <option value="waiting">Waiting</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
        <option value="expired">Expired</option>
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

    <!-- Error -->
    <div v-if="error" class="mb-4 bg-[var(--color-error-bg)] border border-[var(--color-error-border)] text-[var(--color-error-text)] px-4 py-3 rounded-lg text-sm">{{ error }}</div>

    <!-- Table -->
    <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-[var(--color-border)]">
          <thead class="bg-[var(--color-bg-page)]">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">ID</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Campaign</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Client</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Step</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Status</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Next Step At</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Enrolled</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--color-border-muted)]">
            <tr v-if="loading">
              <td colspan="7" class="px-4 py-8 text-center text-[var(--color-text-muted)]">Loading...</td>
            </tr>
            <tr v-else-if="enrollments.length === 0">
              <td colspan="7" class="px-4 py-8 text-center text-[var(--color-text-muted)]">
                No enrollments found. Enrollments are created when a tracked event (e.g.
                <code class="text-xs bg-[var(--color-bg-subtle)] px-1 rounded">client-registered</code>,
                <code class="text-xs bg-[var(--color-bg-subtle)] px-1 rounded">checkout-started</code>)
                matches an active campaign trigger.
              </td>
            </tr>
            <tr v-for="e in enrollments" :key="e.id" class="hover:bg-[var(--color-bg-hover)] transition-colors">
              <td class="px-4 py-3 text-sm text-[var(--color-text-tertiary)]">#{{ e.id }}</td>
              <td class="px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">{{ e.definition?.slug ?? e.campaign_definition_id }}</td>
              <td class="px-4 py-3 text-sm text-[var(--color-text-secondary)]">{{ e.client_id }}</td>
              <td class="px-4 py-3 text-sm text-[var(--color-text-secondary)]">{{ e.current_step }}</td>
              <td class="px-4 py-3"><StatusBadge :status="e.status" /></td>
              <td class="px-4 py-3 text-sm text-[var(--color-text-tertiary)]">{{ formatDate(e.next_step_at) }}</td>
              <td class="px-4 py-3 text-sm text-[var(--color-text-tertiary)]">{{ formatDate(e.enrolled_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="px-4 py-3 border-t border-[var(--color-border)] flex items-center justify-between text-sm text-[var(--color-text-tertiary)]">
        <span>{{ total }} total</span>
        <div class="flex gap-2">
          <button
            :disabled="page === 0"
            @click="page--; load()"
            class="px-3 py-1 rounded border border-[var(--color-border)] disabled:opacity-50 hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            Prev
          </button>
          <button
            :disabled="(page + 1) * limit >= total"
            @click="page++; load()"
            class="px-3 py-1 rounded border border-[var(--color-border)] disabled:opacity-50 hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
