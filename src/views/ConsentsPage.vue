<script setup lang="ts">
import { ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
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

async function toggleConsent(consent: ClientConsent) {
  try {
    if (consent.opted_in) {
      await optOut(consent.client_id, consent.channel)
    } else {
      await optIn(consent.client_id, consent.channel)
    }
    await lookupConsents()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Action failed'
  }
}

const allChannels = ['email', 'sms', 'whatsapp', 'push']

async function createOptOut(channel: string) {
  const id = parseInt(clientId.value)
  if (!id) return
  try {
    await optOut(id, channel)
    await lookupConsents()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Action failed'
  }
}
</script>

<template>
  <div>
    <PageHeader title="Consent Management" description="Manage client opt-in/opt-out preferences per channel" />

    <!-- Lookup form -->
    <div class="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <div class="flex gap-3 items-end">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
          <input
            v-model="clientId"
            type="text"
            placeholder="Enter client ID..."
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm w-48"
            @keyup.enter="lookupConsents"
          />
        </div>
        <button
          @click="lookupConsents"
          class="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          Lookup
        </button>
      </div>
      <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
    </div>

    <!-- Results -->
    <div v-if="loading" class="text-center py-12 text-gray-400">Loading...</div>

    <div v-else-if="consents.length > 0 || clientId" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">Consents for Client #{{ clientId }}</h2>
      </div>
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Channel</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Updated</th>
            <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="c in consents" :key="c.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 text-sm font-medium text-gray-900 uppercase">{{ c.channel }}</td>
            <td class="px-4 py-3">
              <StatusBadge :status="c.opted_in ? 'active' : 'inactive'" />
              <span class="ml-2 text-sm text-gray-500">{{ c.opted_in ? 'Opted In' : 'Opted Out' }}</span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ new Date(c.updated_at).toLocaleString() }}</td>
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
            <td colspan="4" class="px-4 py-6 text-center text-gray-400">
              No explicit consents found (all channels are implicitly opted-in)
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Quick opt-out for channels not yet in the table -->
      <div v-if="consents.length < allChannels.length" class="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <p class="text-xs text-gray-500 mb-2">Quick opt-out (implicit opt-in channels):</p>
        <div v-if="auth.canWrite" class="flex gap-2">
          <button
            v-for="ch in allChannels.filter(c => !consents.find(x => x.channel === c))"
            :key="ch"
            @click="createOptOut(ch)"
            class="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            Opt out {{ ch }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
