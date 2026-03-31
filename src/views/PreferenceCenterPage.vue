<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/api/client'

const route = useRoute()

const clientId = ref(0)
const loading = ref(true)
const saving = ref<string | null>(null)
const error = ref('')
const success = ref('')

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

async function loadPreferences() {
  const cid = Number(route.query.client_id || route.params.clientId)
  if (!cid) {
    error.value = 'Missing client identifier. Please use the link from your email.'
    loading.value = false
    return
  }
  clientId.value = cid

  try {
    // This endpoint may require a signed token in production
    const { data } = await api.get(`/api/consents/${cid}`)
    const consentMap = new Map<string, boolean>()
    for (const c of data) {
      consentMap.set(c.channel, c.opted_in)
    }
    // Update channels with actual consent data (default = opted in if no record)
    for (const ch of channels.value) {
      if (consentMap.has(ch.channel)) {
        ch.opted_in = consentMap.get(ch.channel)!
      }
    }
  } catch (e: any) {
    // If 401, this might be a public page that needs different auth
    error.value = 'Unable to load your preferences. Please try again later.'
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
      await api.post('/api/consents/opt-in', { client_id: clientId.value, channel: channel.channel })
    } else {
      await api.post('/api/consents/opt-out', { client_id: clientId.value, channel: channel.channel })
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
        await api.post('/api/consents/opt-out', { client_id: clientId.value, channel: ch.channel })
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
      <div v-else-if="clientId" class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
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
              'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
              channel.opted_in ? 'bg-indigo-600' : 'bg-gray-200',
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
