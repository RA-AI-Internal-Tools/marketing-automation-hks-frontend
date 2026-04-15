<script setup lang="ts">
import { ref, computed } from 'vue'
import { testSend } from '@/api/dashboard'
import ModalWrapper from './ModalWrapper.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

// ModalWrapper uses v-model — bridge to the parent's existing `:open` prop.
const isOpen = computed({
  get: () => props.open,
  set: (v) => { if (!v) emit('close') },
})

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
  if (!templateKey.value || templateKey.value.trim() === '') {
    error.value = 'Template key is required'
    return
  }
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
  <ModalWrapper v-model="isOpen" title="Test Send" size="md">
    <template #body>
      <div class="space-y-4">
        <div>
          <label class="form-label">Channel</label>
          <select v-model="channel" class="form-select">
            <option v-for="ch in channels" :key="ch" :value="ch">{{ ch }}</option>
          </select>
        </div>
        <div>
          <label class="form-label">Template Key</label>
          <input v-model="templateKey" class="form-input" placeholder="e.g. welcome_email" />
        </div>
        <div>
          <label class="form-label">Client ID</label>
          <input v-model.number="clientId" type="number" class="form-input" placeholder="123" />
        </div>
        <div>
          <label class="form-label">Params (JSON)</label>
          <textarea v-model="paramsJson" rows="3" class="form-textarea font-mono" placeholder='{"first_name": "John"}'></textarea>
        </div>

        <div v-if="error" class="text-sm text-[var(--color-error-text)] bg-[var(--color-error-bg)] border border-[var(--color-error-border)] px-4 py-3 rounded-lg">{{ error }}</div>
        <div v-if="result" class="text-sm text-[var(--color-success-text)] bg-[var(--color-success-bg)] border border-[var(--color-success-border)] px-4 py-3 rounded-lg">
          <pre class="whitespace-pre-wrap font-mono text-xs">{{ result }}</pre>
        </div>
      </div>
    </template>
    <template #footer>
      <button
        @click="handleSend"
        :disabled="sending"
        class="btn btn-primary"
      >{{ sending ? 'Sending...' : 'Send Test Message' }}</button>
    </template>
  </ModalWrapper>
</template>
