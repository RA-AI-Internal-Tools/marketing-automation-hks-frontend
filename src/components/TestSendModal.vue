<script setup lang="ts">
import { ref } from 'vue'
import { testSend } from '@/api/dashboard'
import { XMarkIcon } from '@heroicons/vue/24/outline'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const channel = ref('email')
const templateKey = ref('')
const clientId = ref<number | undefined>()
const paramsJson = ref('{}')
const sending = ref(false)
const result = ref<string | null>(null)
const error = ref('')

const channels = ['email', 'sms', 'whatsapp', 'push']

async function handleSend() {
  error.value = ''
  result.value = null
  if (!clientId.value) {
    error.value = 'Client ID is required'
    return
  }

  let params: Record<string, any> = {}
  try {
    params = JSON.parse(paramsJson.value)
  } catch {
    error.value = 'Invalid JSON in params'
    return
  }

  sending.value = true
  try {
    const res = await testSend({
      channel: channel.value,
      template_key: templateKey.value,
      client_id: clientId.value,
      params,
    })
    result.value = JSON.stringify(res, null, 2)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Send failed'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/50" @click="emit('close')" />
      <div class="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900">Test Send</h3>
          <button @click="emit('close')" class="text-gray-400 hover:text-gray-600">
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Channel</label>
            <select v-model="channel" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option v-for="ch in channels" :key="ch" :value="ch">{{ ch }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Template Key</label>
            <input v-model="templateKey" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="e.g. welcome_email" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
            <input v-model.number="clientId" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="123" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Params (JSON)</label>
            <textarea v-model="paramsJson" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" placeholder='{"first_name": "John"}'></textarea>
          </div>
        </div>

        <div v-if="error" class="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{{ error }}</div>
        <div v-if="result" class="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
          <pre class="whitespace-pre-wrap font-mono text-xs">{{ result }}</pre>
        </div>

        <button
          @click="handleSend"
          :disabled="sending"
          class="w-full py-2.5 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {{ sending ? 'Sending...' : 'Send Test Message' }}
        </button>
      </div>
    </div>
  </Teleport>
</template>
