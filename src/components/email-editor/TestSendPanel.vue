<script setup lang="ts">
import { ref } from 'vue'
import { testSend } from '@/api/dashboard'
import { PaperAirplaneIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
  templateKey: string
  sampleData: Record<string, any>
}>()

const recipientEmail = ref('')
const clientId = ref<number | undefined>()
const sending = ref(false)
const result = ref<string | null>(null)
const error = ref('')

async function handleSend() {
  error.value = ''
  result.value = null

  if (!props.templateKey.trim()) {
    error.value = 'Save the template first to generate a template key'
    return
  }
  if (!clientId.value) {
    error.value = 'Client ID is required for test send'
    return
  }

  sending.value = true
  try {
    const params: Record<string, any> = { ...props.sampleData }
    if (recipientEmail.value.trim()) {
      params._test_recipient = recipientEmail.value.trim()
    }
    const res = await testSend({
      channel: 'email',
      template_key: props.templateKey,
      client_id: clientId.value,
      params,
    })
    result.value = JSON.stringify(res, null, 2)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Test send failed'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="p-5 space-y-4 max-w-xl">
    <h3 class="text-sm font-semibold text-gray-900">Test Send</h3>
    <p class="text-xs text-gray-500">
      Send a test email using the current template and sample data to verify rendering.
    </p>

    <div>
      <label class="block text-xs font-medium text-gray-600 mb-1">Test Recipient Email</label>
      <input
        v-model="recipientEmail"
        type="email"
        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0099db]/40 focus:border-[#0099db]"
        placeholder="you@example.com"
      />
    </div>

    <div>
      <label class="block text-xs font-medium text-gray-600 mb-1">Client ID</label>
      <input
        v-model.number="clientId"
        type="number"
        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0099db]/40 focus:border-[#0099db]"
        placeholder="123"
      />
    </div>

    <div v-if="Object.keys(sampleData).length > 0" class="p-3 bg-gray-50 rounded-lg">
      <p class="text-[11px] font-medium text-gray-500 mb-1">Template parameters from sample data:</p>
      <p class="text-[11px] text-gray-400 font-mono truncate">
        {{ Object.keys(sampleData).slice(0, 6).join(', ') }}{{ Object.keys(sampleData).length > 6 ? '...' : '' }}
      </p>
    </div>

    <div v-if="error" class="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-lg">
      {{ error }}
    </div>

    <div v-if="result" class="bg-emerald-50 border border-emerald-100 px-4 py-3 rounded-lg">
      <p class="text-xs font-medium text-emerald-700 mb-1">Test sent successfully</p>
      <pre class="text-[11px] text-emerald-600 font-mono whitespace-pre-wrap">{{ result }}</pre>
    </div>

    <button
      @click="handleSend"
      :disabled="sending || !props.templateKey.trim()"
      class="inline-flex items-center gap-2 px-5 py-2.5 bg-[#020288] text-white text-sm font-medium rounded-lg hover:bg-[#0d35d7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
    >
      <PaperAirplaneIcon class="h-4 w-4" />
      {{ sending ? 'Sending...' : 'Send Test Email' }}
    </button>
  </div>
</template>
