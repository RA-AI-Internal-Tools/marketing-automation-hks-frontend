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
  <Teleport to="body">
    <Transition
      enter-active-class="duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center">
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />
        <div class="relative bg-[var(--color-bg-card)] rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-muted)]">
            <h3 class="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">Test Send</h3>
            <button @click="emit('close')" class="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors p-1 hover:bg-[var(--color-bg-subtle)] rounded-lg">
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Channel</label>
              <select v-model="channel" class="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-bg-input)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] transition-shadow">
                <option v-for="ch in channels" :key="ch" :value="ch">{{ ch }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Template Key</label>
              <input v-model="templateKey" class="w-full px-3 py-2.5 border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] transition-shadow placeholder:text-[var(--color-text-muted)]" placeholder="e.g. welcome_email" />
            </div>
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Client ID</label>
              <input v-model.number="clientId" type="number" class="w-full px-3 py-2.5 border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] transition-shadow placeholder:text-[var(--color-text-muted)]" placeholder="123" />
            </div>
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Params (JSON)</label>
              <textarea v-model="paramsJson" rows="3" class="w-full px-3 py-2.5 border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] transition-shadow placeholder:text-[var(--color-text-muted)]" placeholder='{"first_name": "John"}'></textarea>
            </div>

            <div v-if="error" class="text-sm text-[var(--color-error-text)] bg-[var(--color-error-bg)] border border-[var(--color-error-border)] px-4 py-3 rounded-lg">{{ error }}</div>
            <div v-if="result" class="text-sm text-[var(--color-success-text)] bg-[var(--color-success-bg)] border border-[var(--color-success-border)] px-4 py-3 rounded-lg">
              <pre class="whitespace-pre-wrap font-mono text-xs">{{ result }}</pre>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 bg-[var(--color-bg-subtle)] border-t border-[var(--color-border-muted)]">
            <button
              @click="handleSend"
              :disabled="sending"
              class="btn btn-primary w-full justify-center"
            >
              {{ sending ? 'Sending...' : 'Send Test Message' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
