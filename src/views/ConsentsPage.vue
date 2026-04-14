<script setup lang="ts">
import { ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { fetchConsents, optOut, optIn } from '@/api/dashboard'
import { useAuthStore } from '@/stores/auth'
import type { ClientConsent } from '@/api/types'

const auth = useAuthStore()

const clientId = ref('')
const consents = ref<ClientConsent[]>([])
const loading = ref(false)
const error = ref('')

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
const pendingOptOut = ref<{ clientId: number; channel: string } | null>(null)

function requestOptOut(cid: number, channel: string) {
  pendingOptOut.value = { clientId: cid, channel }
}

async function confirmPendingOptOut() {
  if (!pendingOptOut.value) return
  const { clientId: cid, channel } = pendingOptOut.value
  pendingOptOut.value = null
  try {
    await optOut(cid, channel)
    await lookupConsents()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Action failed'
  }
}

async function toggleConsent(consent: ClientConsent) {
  if (consent.opted_in) {
    requestOptOut(consent.client_id, consent.channel)
    return
  }
  try {
    await optIn(consent.client_id, consent.channel)
    await lookupConsents()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Action failed'
  }
}

const allChannels = ['email', 'sms', 'whatsapp', 'push']

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
          class="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-hover)]"
        >
          Lookup
        </button>
      </div>
      <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
    </div>

    <!-- Results -->
    <div v-if="loading" class="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>

    <div v-else-if="consents.length > 0 || clientId" class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-[var(--color-border)]">
        <h2 class="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">Consents for Client #{{ clientId }}</h2>
      </div>
      <table class="min-w-full divide-y divide-[var(--color-border)]">
        <thead class="bg-[var(--color-bg-page)]">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Channel</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Purpose</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Status</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Updated</th>
            <th class="px-4 py-3 text-right text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--color-border-muted)]">
          <tr v-for="c in consents" :key="c.id" class="hover:bg-[var(--color-bg-hover)] transition-colors">
            <td class="px-4 py-3 text-sm font-medium text-[var(--color-text-primary)] uppercase">{{ c.channel }}</td>
            <td class="px-4 py-3 text-sm text-[var(--color-text-tertiary)]">
              {{ purposeLabel(c.purpose, c.channel) }}
            </td>
            <td class="px-4 py-3">
              <StatusBadge :status="c.opted_in ? 'active' : 'inactive'" />
              <span class="ml-2 text-sm text-[var(--color-text-tertiary)]">{{ c.opted_in ? 'Opted In' : 'Opted Out' }}</span>
            </td>
            <td class="px-4 py-3 text-sm text-[var(--color-text-tertiary)]">{{ new Date(c.updated_at).toLocaleString() }}</td>
            <td class="px-4 py-3 text-right">
              <button
                v-if="auth.canWrite"
                @click="toggleConsent(c)"
                :class="c.opted_in ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'"
                class="text-sm font-medium"
              >
                {{ c.opted_in ? 'Opt Out' : 'Opt In' }}
              </button>
            </td>
          </tr>
          <tr v-if="consents.length === 0">
            <td colspan="5" class="px-4 py-6 text-center text-[var(--color-text-muted)]">
              No explicit consents found (all channels are implicitly opted-in)
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Quick opt-out for channels not yet in the table -->
      <div v-if="consents.length < allChannels.length" class="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-page)]">
        <p class="text-xs text-[var(--color-text-tertiary)] mb-2">Quick opt-out (implicit opt-in channels):</p>
        <div v-if="auth.canWrite" class="flex gap-2">
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
