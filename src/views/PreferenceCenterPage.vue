<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/api/client'

const route = useRoute()

const clientId = ref(0)
const token = ref('')
const loading = ref(true)
const saving = ref<string | null>(null)
const error = ref('')
const success = ref('')
const tokenInvalid = ref(false)

interface ChannelPreference {
  channel: string
  label: string
  description: string
  opted_in: boolean
}

const channels = ref<ChannelPreference[]>([
  { channel: 'email', label: 'Email', description: 'Promotional emails, cart reminders, and order updates', opted_in: true },
  { channel: 'sms', label: 'SMS', description: 'Text message notifications and alerts', opted_in: true },
  { channel: 'whatsapp', label: 'WhatsApp', description: 'WhatsApp messages for order updates and support', opted_in: true },
  { channel: 'push', label: 'Push Notifications', description: 'Browser and mobile push notifications', opted_in: true },
])

/** Build axios config that passes the signed token instead of the session Bearer token */
function publicConfig() {
  return {
    headers: { 'X-Preference-Token': token.value },
    _publicRequest: true,
  } as any
}

async function loadPreferences() {
  const cid = Number(route.query.client_id || route.params.clientId)
  const tkn = (route.query.token as string) || ''

  if (!cid || !tkn) {
    error.value = 'Invalid or missing link. Please use the link from your email.'
    tokenInvalid.value = true
    loading.value = false
    return
  }

  clientId.value = cid
  token.value = tkn

  try {
    const { data } = await api.get(`/api/consents/${cid}`, publicConfig())
    const consentMap = new Map<string, boolean>()
    for (const c of data) {
      consentMap.set(c.channel, c.opted_in)
    }
    for (const ch of channels.value) {
      if (consentMap.has(ch.channel)) {
        ch.opted_in = consentMap.get(ch.channel)!
      }
    }
  } catch (e: any) {
    if (e.response?.status === 401 || e.response?.status === 403) {
      error.value = 'This link has expired or is invalid. Please request a new preferences link.'
      tokenInvalid.value = true
    } else {
      error.value = 'Unable to load your preferences. Please try again later.'
    }
  } finally {
    loading.value = false
  }
}

async function toggleChannel(channel: ChannelPreference) {
  saving.value = channel.channel
  error.value = ''
  success.value = ''
  try {
    const newState = !channel.opted_in
    if (newState) {
      await api.post('/api/consents/opt-in', { client_id: clientId.value, channel: channel.channel }, publicConfig())
    } else {
      await api.post('/api/consents/opt-out', { client_id: clientId.value, channel: channel.channel }, publicConfig())
    }
    channel.opted_in = newState
    success.value = `${channel.label} notifications ${newState ? 'enabled' : 'disabled'}`
    setTimeout(() => { success.value = '' }, 3000)
  } catch (e: any) {
    error.value = `Failed to update ${channel.label} preference`
  } finally {
    saving.value = null
  }
}

async function optOutAll() {
  saving.value = 'all'
  error.value = ''
  try {
    for (const ch of channels.value) {
      if (ch.opted_in) {
        await api.post('/api/consents/opt-out', { client_id: clientId.value, channel: ch.channel }, publicConfig())
        ch.opted_in = false
      }
    }
    success.value = 'You have been unsubscribed from all notifications'
    setTimeout(() => { success.value = '' }, 5000)
  } catch (e: any) {
    error.value = 'Failed to update preferences'
  } finally {
    saving.value = null
  }
}

onMounted(loadPreferences)
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-start justify-center pt-12 px-4">
    <div class="w-full max-w-lg">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-gray-900">Notification Preferences</h1>
        <p class="mt-2 text-gray-600">Manage how DueGate communicates with you</p>
      </div>

      <!-- Error -->
      <div v-if="error" class="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
        {{ error }}
      </div>

      <!-- Success -->
      <div v-if="success" class="mb-4 bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm">
        {{ success }}
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-12 text-gray-500">Loading your preferences...</div>

      <!-- Channel list -->
      <div v-else-if="clientId && !tokenInvalid" class="bg-white rounded-xl border border-gray-200/80 shadow-sm divide-y divide-gray-100">
        <div
          v-for="channel in channels"
          :key="channel.channel"
          class="flex items-center justify-between p-5"
        >
          <div>
            <div class="font-medium text-gray-900">{{ channel.label }}</div>
            <div class="text-sm text-gray-500 mt-0.5">{{ channel.description }}</div>
          </div>
          <button
            @click="toggleChannel(channel)"
            :disabled="saving !== null"
            :class="[
              'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-[#0099db]/40 focus:ring-offset-2',
              channel.opted_in ? 'bg-[#020288]' : 'bg-gray-200',
              saving !== null ? 'opacity-50 cursor-not-allowed' : '',
            ]"
          >
            <span
              :class="[
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                channel.opted_in ? 'translate-x-5' : 'translate-x-0',
              ]"
            />
          </button>
        </div>

        <!-- Opt out all -->
        <div class="p-5">
          <button
            @click="optOutAll"
            :disabled="saving !== null || channels.every(c => !c.opted_in)"
            class="w-full py-2 px-4 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ saving === 'all' ? 'Unsubscribing...' : 'Unsubscribe from all' }}
          </button>
        </div>
      </div>

      <!-- Footer -->
      <p class="mt-6 text-center text-xs text-gray-400">
        Changes are saved immediately. You can update your preferences at any time.
      </p>
    </div>
  </div>
</template>
