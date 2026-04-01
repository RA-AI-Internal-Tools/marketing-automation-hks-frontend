<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'
import { useEnvironmentStore } from '@/stores/environment'
import type { Integration, IntegrationRequest, ProviderType, IntegrationStatus } from '@/api/types'

const props = defineProps<{
  visible: boolean
  integration?: Integration | null
  saving?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', req: IntegrationRequest, id?: number): void
}>()

const env = useEnvironmentStore()

const name = ref('')
const providerType = ref<ProviderType>('email')
const endpointUrl = ref('')
const apiKey = ref('')
const status = ref<IntegrationStatus>('not_configured')
const error = ref('')

const isEdit = computed(() => !!props.integration)
const title = computed(() => isEdit.value ? 'Edit Integration' : 'Add Integration')

const providerTypes: { value: ProviderType; label: string }[] = [
  { value: 'email', label: 'Email Provider' },
  { value: 'sms', label: 'SMS Provider' },
  { value: 'push', label: 'Push Provider' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'crm', label: 'CRM / External API' },
  { value: 'analytics', label: 'Analytics' },
]

watch(() => props.visible, (v) => {
  if (v && props.integration) {
    name.value = props.integration.name
    providerType.value = props.integration.provider_type
    endpointUrl.value = props.integration.endpoint_url || ''
    apiKey.value = ''
    status.value = props.integration.status
  } else if (v) {
    name.value = ''
    providerType.value = 'email'
    endpointUrl.value = ''
    apiKey.value = ''
    status.value = 'not_configured'
  }
  error.value = ''
})

function handleSubmit() {
  error.value = ''
  if (!name.value.trim()) {
    error.value = 'Provider name is required'
    return
  }

  const req: IntegrationRequest = {
    name: name.value.trim(),
    provider_type: providerType.value,
    endpoint_url: endpointUrl.value.trim() || undefined,
    api_key: apiKey.value.trim() || undefined,
    status: status.value,
  }
  emit('save', req, props.integration?.id)
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
      <div v-if="visible" class="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center p-4 pt-20">
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')" />
        <div class="relative bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
            <h2 class="text-base font-semibold text-[var(--color-text-primary)]">{{ title }}</h2>
            <button @click="emit('close')" class="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <!-- Production warning -->
          <div v-if="env.isProduction" class="mx-6 mt-4 px-4 py-3 rounded-lg bg-[var(--env-production-bg)] border border-[var(--env-production-border)] text-[var(--env-production-text)] text-xs font-medium">
            You are editing a production integration. Changes will affect live services.
          </div>

          <!-- Form -->
          <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
            <!-- Environment indicator -->
            <div class="text-xs text-[var(--color-text-tertiary)]">
              Environment: <span class="font-semibold capitalize">{{ env.mode }}</span> (auto-assigned)
            </div>

            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Provider Name</label>
              <input
                v-model="name"
                type="text"
                required
                placeholder="e.g. SendGrid, Twilio, Slack Webhook"
                class="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 placeholder:text-[var(--color-text-muted)]"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Provider Type</label>
              <select
                v-model="providerType"
                class="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
              >
                <option v-for="pt in providerTypes" :key="pt.value" :value="pt.value">{{ pt.label }}</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Endpoint URL</label>
              <input
                v-model="endpointUrl"
                type="url"
                placeholder="https://api.example.com/v1"
                class="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 placeholder:text-[var(--color-text-muted)]"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                API Key / Secret
                <span v-if="isEdit && integration?.api_key_configured" class="text-[var(--color-text-muted)] font-normal">(leave blank to keep current)</span>
              </label>
              <input
                v-model="apiKey"
                type="password"
                :placeholder="isEdit && integration?.api_key_configured ? '••••••••' : 'Enter API key or secret'"
                class="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 placeholder:text-[var(--color-text-muted)]"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Status</label>
              <select
                v-model="status"
                class="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
              >
                <option value="not_configured">Not Configured</option>
                <option value="connected">Connected</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>

            <!-- Error -->
            <div v-if="error" class="text-sm text-[var(--color-error-text)] bg-[var(--color-error-bg)] px-3 py-2 rounded-lg">
              {{ error }}
            </div>

            <!-- Actions -->
            <div class="flex gap-3 justify-end pt-2">
              <button
                type="button"
                @click="emit('close')"
                class="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-subtle)] rounded-lg hover:bg-[var(--color-bg-muted)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="saving"
                class="px-6 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
              >
                {{ saving ? 'Saving...' : isEdit ? 'Update Integration' : 'Add Integration' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
