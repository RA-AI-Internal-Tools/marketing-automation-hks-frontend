<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import DataTable, { type Column } from '@/components/DataTable.vue'
import { fetchConsents, optOut, optIn } from '@/api/dashboard'
import { getChannelVocabulary } from '@/api/channels'
import { useAuthStore } from '@/stores/auth'
import type { ClientConsent } from '@/api/types'

const auth = useAuthStore()

const clientId = ref('')
const consents = ref<ClientConsent[]>([])
const loading = ref(false)
const error = ref('')

// Client-side sort on the loaded page (consents for one client are
// always small — no dedicated server-side sort field needed).
const sortKey = ref<string | null>(null)
const sortDir = ref<'asc' | 'desc' | null>(null)

const columns: Column[] = [
  { key: 'client_id', label: 'Client', sortable: true },
  { key: 'channel', label: 'Channel' },
  { key: 'purpose', label: 'Purpose' },
  { key: 'opted_in', label: 'Status' },
  { key: 'updated_at', label: 'Updated', sortable: true },
  { key: 'action', label: 'Action', align: 'right' },
]

const sortedConsents = computed(() => {
  if (!sortKey.value || !sortDir.value) return consents.value
  const k = sortKey.value as keyof ClientConsent
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...consents.value].sort((a: any, b: any) => {
    const av = a[k] ?? ''
    const bv = b[k] ?? ''
    if (av < bv) return -1 * dir
    if (av > bv) return 1 * dir
    return 0
  })
})

async function lookupConsents() {
  const id = parseInt(clientId.value)
  if (!id) { error.value = 'Please enter a valid client ID'; return }
  error.value = ''
  loading.value = true
  try {
    consents.value = await fetchConsents(id)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load consents'
  } finally {
    loading.value = false
  }
}

// Opt-out is destructive (a user can no longer be reached on that
// channel until they re-opt-in from their own UI), so it goes through a
// confirmation step. Opt-in is additive — no confirm needed.
const pendingOptOut = ref<{ clientId: number; channel: string; purpose?: string } | null>(null)

function requestOptOut(cid: number, channel: string, purpose?: string) {
  pendingOptOut.value = { clientId: cid, channel, purpose }
}

async function confirmPendingOptOut() {
  if (!pendingOptOut.value) return
  const { clientId: cid, channel, purpose } = pendingOptOut.value
  pendingOptOut.value = null
  try {
    await optOut(cid, channel, purpose)
    await lookupConsents()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Action failed'
  }
}

async function toggleConsent(consent: ClientConsent) {
  // Thread `purpose` through so toggling a personalization row doesn't
  // collide with the user's marketing consent on the same channel.
  if (consent.opted_in) {
    requestOptOut(consent.client_id, consent.channel, consent.purpose)
    return
  }
  try {
    await optIn(consent.client_id, consent.channel, consent.purpose)
    await lookupConsents()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Action failed'
  }
}

// Hardcoded list acts as the first-paint default and the failure
// fallback. On mount we ask the backend for the canonical vocabulary so
// new channels (e.g. 'onsite') show up without a frontend deploy.
const allChannels = ref<string[]>(['email', 'sms', 'whatsapp', 'push', 'onsite'])

onMounted(async () => {
  try {
    const channels = await getChannelVocabulary()
    if (Array.isArray(channels) && channels.length > 0) {
      allChannels.value = channels
    }
  } catch {
    // Keep fallback — the quick opt-out UI stays functional.
  }
})

function purposeLabel(purpose?: string, channel?: string) {
  if (purpose === 'personalization' && channel === 'global') return 'personalization (global)'
  return purpose || 'legacy / unspecified'
}

function createOptOut(channel: string) {
  const id = parseInt(clientId.value)
  if (!id) return
  requestOptOut(id, channel)
}
</script>

<template>
  <div class="page-enter">
    <PageHeader title="Consent Management" description="Manage client opt-in/opt-out preferences per channel" />

    <!-- Lookup form -->
    <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6 mb-6">
      <div class="flex gap-3 items-end">
        <div>
          <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Client ID</label>
          <p class="text-xs text-[var(--color-text-muted)] mb-1">Enter a numeric AR-PAY client ID to view and manage channel consent preferences.</p>
          <input
            v-model="clientId"
            type="text"
            placeholder="Enter client ID..."
            class="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm w-48"
            @keyup.enter="lookupConsents"
          />
        </div>
        <button
          @click="lookupConsents"
          class="btn btn-primary"
        >
          Lookup
        </button>
      </div>
      <p v-if="error" class="mt-2 text-sm text-[var(--color-error-text)]">{{ error }}</p>
    </div>

    <!-- Results -->
    <div v-if="loading" class="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>

    <div v-if="consents.length > 0 || clientId" class="space-y-4">
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden px-6 py-4">
        <h2 class="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">Consents for Client #{{ clientId }}</h2>
      </div>
      <DataTable
        :columns="columns"
        :rows="sortedConsents"
        row-key="id"
        :loading="loading"
        empty-title="No explicit consents found"
        empty-description="(all channels are implicitly opted-in)"
        sortable
        v-model:sort-key="sortKey"
        v-model:sort-dir="sortDir"
      >
        <template #cell-channel="{ row }">
          <span class="text-sm font-medium text-[var(--color-text-primary)] uppercase">{{ row.channel }}</span>
        </template>
        <template #cell-purpose="{ row }">
          <span class="text-sm text-[var(--color-text-tertiary)]">{{ purposeLabel(row.purpose, row.channel) }}</span>
        </template>
        <template #cell-opted_in="{ row }">
          <StatusBadge :status="row.opted_in ? 'active' : 'inactive'" />
          <span class="ml-2 text-sm text-[var(--color-text-tertiary)]">{{ row.opted_in ? 'Opted In' : 'Opted Out' }}</span>
        </template>
        <template #cell-updated_at="{ row }">
          <span class="text-sm text-[var(--color-text-tertiary)]">{{ new Date(row.updated_at).toLocaleString() }}</span>
        </template>
        <template #cell-action="{ row }">
          <button
            v-if="auth.canWrite"
            @click="toggleConsent(row)"
            :class="row.opted_in ? 'text-[var(--color-error-text)] hover:text-[var(--color-error-text)]' : 'text-[var(--color-success-text)] hover:text-[var(--color-success-text)]'"
            class="text-sm font-medium"
          >
            {{ row.opted_in ? 'Opt Out' : 'Opt In' }}
          </button>
        </template>
      </DataTable>

      <!-- Quick opt-out for channels not yet in the table -->
      <div v-if="consents.length < allChannels.length" class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-4">
        <p class="text-xs text-[var(--color-text-tertiary)] mb-2">Quick opt-out (implicit opt-in channels):</p>
        <div v-if="auth.canWrite" class="flex gap-2 flex-wrap">
          <button
            v-for="ch in allChannels.filter(c => !consents.find(x => x.channel === c))"
            :key="ch"
            @click="createOptOut(ch)"
            class="px-3 py-1 text-xs border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)]"
          >
            Opt out {{ ch }}
          </button>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :open="!!pendingOptOut"
      :title="`Opt out client #${pendingOptOut?.clientId ?? ''}?`"
      :message="pendingOptOut ? `Are you sure you want to opt out client #${pendingOptOut.clientId} from ${pendingOptOut.channel}? They will no longer receive ${pendingOptOut.channel} messages until they opt back in.` : ''"
      confirm-text="Opt out"
      cancel-text="Cancel"
      variant="danger"
      @confirm="confirmPendingOptOut"
      @cancel="pendingOptOut = null"
    />
  </div>
</template>
