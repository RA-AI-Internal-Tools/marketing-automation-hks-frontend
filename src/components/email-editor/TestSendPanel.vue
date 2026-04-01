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
    <h3 class="text-sm font-semibold text-[var(--color-text-primary)]">Test Send</h3>
    <p class="text-xs text-[var(--color-text-tertiary)]">
      Send a test email using the current template and sample data to verify rendering.
    </p>

    <div>
      <label class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Test Recipient Email</label>
      <input
        v-model="recipientEmail"
        type="email"
        class="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-bg-input)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-muted)]"
        placeholder="you@example.com"
      />
    </div>

    <div>
      <label class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Client ID</label>
      <input
        v-model.number="clientId"
        type="number"
        class="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-bg-input)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-muted)]"
        placeholder="123"
      />
    </div>

    <div v-if="Object.keys(sampleData).length > 0" class="p-3 bg-[var(--color-bg-subtle)] rounded-lg">
      <p class="text-[11px] font-medium text-[var(--color-text-tertiary)] mb-1">Template parameters from sample data:</p>
      <p class="text-[11px] text-[var(--color-text-muted)] font-mono truncate">
        {{ Object.keys(sampleData).slice(0, 6).join(', ') }}{{ Object.keys(sampleData).length > 6 ? '...' : '' }}
      </p>
    </div>

    <div v-if="error" class="text-sm text-[var(--color-error-text)] bg-[var(--color-error-bg)] border border-[var(--color-error-border)] px-4 py-3 rounded-lg">
      {{ error }}
    </div>

    <div v-if="result" class="bg-[var(--color-success-bg)] border border-[var(--color-success-border)] px-4 py-3 rounded-lg">
      <p class="text-xs font-medium text-[var(--color-success-text)] mb-1">Test sent successfully</p>
      <pre class="text-[11px] text-[var(--color-success-text)] font-mono whitespace-pre-wrap">{{ result }}</pre>
    </div>

    <button
      @click="handleSend"
      :disabled="sending || !props.templateKey.trim()"
      class="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
    >
      <PaperAirplaneIcon class="h-4 w-4" />
      {{ sending ? 'Sending...' : 'Send Test Email' }}
    </button>
  </div>
</template>
