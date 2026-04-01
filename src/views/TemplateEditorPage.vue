<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import EmailTemplateEditor from '@/components/email-editor/EmailTemplateEditor.vue'
import { useTemplatesStore } from '@/stores/templates'
import type { MessageTemplate, TemplateRequest } from '@/api/types'

const route = useRoute()
const router = useRouter()
const store = useTemplatesStore()

const isEdit = computed(() => !!route.params.id)
const templateId = computed(() => Number(route.params.id))

// Channel selection — determines which editor to show
const channel = ref('email')
const channelLocked = ref(false)

// Loaded template data (shared between parent and email editor)
const loadedTemplate = ref<MessageTemplate | null>(null)

// Simple form state (for non-email channels)
const templateKey = ref('')
const name = ref('')
const subject = ref('')
const body = ref('')
const variablesInput = ref('')
const isActive = ref(true)

const saving = ref(false)
const error = ref('')
const loading = ref(false)

const channels = ['email', 'sms', 'whatsapp', 'push']

onMounted(async () => {
  if (isEdit.value) {
    loading.value = true
    try {
      const tmpl = await store.get(templateId.value)
      channel.value = tmpl.channel
      channelLocked.value = true

      if (tmpl.channel === 'email') {
        // Pass the loaded template directly to EmailTemplateEditor
        loadedTemplate.value = tmpl
      } else {
        // Populate simple form for non-email channels
        templateKey.value = tmpl.template_key
        name.value = tmpl.name
        subject.value = tmpl.subject || ''
        body.value = tmpl.body
        variablesInput.value = tmpl.variables ? tmpl.variables.join(', ') : ''
        isActive.value = tmpl.is_active
      }
    } catch {
      error.value = 'Failed to load template'
    } finally {
      loading.value = false
    }
  }
})

// Simple form submit for non-email channels
async function handleSubmit() {
  error.value = ''
  saving.value = true
  try {
    const variables = variablesInput.value
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0)

    const req: TemplateRequest = {
      template_key: templateKey.value,
      channel: channel.value,
      name: name.value,
      subject: channel.value === 'email' ? subject.value || null : null,
      body: body.value,
      variables: variables.length > 0 ? variables : undefined,
      is_active: isActive.value,
    }

    if (isEdit.value) {
      await store.update(templateId.value, req)
    } else {
      await store.create(req)
    }
    router.push('/templates')
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to save template'
  } finally {
    saving.value = false
  }
}

const inputClass = 'w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[#0099db] transition-shadow'
</script>

<template>
  <div class="page-enter">
    <div class="flex items-center justify-between mb-4">
      <PageHeader
        :title="isEdit ? 'Edit Template' : 'New Template'"
        :description="isEdit ? 'Modify message template' : 'Create a new message template'"
      />
      <button
        v-if="channel !== 'email' || loading"
        @click="router.push('/templates')"
        class="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-page)] transition-colors"
      >
        Back to Templates
      </button>
    </div>

    <!-- Channel selector (only for new templates) -->
    <div v-if="!channelLocked && !loading" class="mb-4">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-[var(--color-text-secondary)]">Channel:</span>
        <div class="flex gap-1.5">
          <button
            v-for="ch in channels"
            :key="ch"
            @click="channel = ch"
            :class="[
              'px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 capitalize',
              channel === ch
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-page)]',
            ]"
          >
            {{ ch }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="text-center py-12 text-[var(--color-text-muted)]">
      <div class="skeleton h-6 w-48 mx-auto mb-3"></div>
      <div class="skeleton h-4 w-32 mx-auto"></div>
    </div>

    <div v-else-if="error && channel !== 'email'" class="text-sm text-[var(--color-error-text)] bg-[var(--color-error-bg)] border border-[var(--color-error-border)] px-4 py-3 rounded-lg">
      {{ error }}
    </div>

    <!-- EMAIL channel → Full email editor -->
    <EmailTemplateEditor
      v-else-if="channel === 'email'"
      :template-id="isEdit ? templateId : undefined"
      :initial-template="loadedTemplate"
    />

    <!-- Non-email channels → Simple form -->
    <form v-else @submit.prevent="handleSubmit" class="space-y-5 max-w-2xl">
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Name <span class="text-red-500">*</span></label>
            <input v-model="name" required :class="inputClass" placeholder="Template name" />
          </div>
          <div>
            <label class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Template Key <span class="text-red-500">*</span></label>
            <input v-model="templateKey" required :class="inputClass" placeholder="e.g. welcome_sms" />
          </div>
        </div>

        <div v-if="channelLocked" class="flex items-center gap-2">
          <span class="text-xs font-medium text-[var(--color-text-secondary)]">Channel:</span>
          <span class="px-2.5 py-0.5 text-xs font-medium rounded-full capitalize"
            :class="{
              'bg-purple-100 text-purple-800': channel === 'sms',
              'bg-green-100 text-green-800': channel === 'whatsapp',
              'bg-orange-100 text-orange-800': channel === 'push',
            }"
          >
            {{ channel }}
          </span>
        </div>

        <div>
          <label class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Body <span class="text-red-500">*</span></label>
          <textarea
            v-model="body"
            required
            rows="8"
            :class="[inputClass, 'font-mono']"
            placeholder="Template body content. Use {{variable_name}} for dynamic content."
          ></textarea>
        </div>

        <div>
          <label class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Variables (comma-separated)</label>
          <input
            v-model="variablesInput"
            :class="inputClass"
            placeholder="e.g. first_name, order_id, amount"
          />
        </div>

        <div class="flex items-center justify-between py-1">
          <span class="text-sm text-[var(--color-text-secondary)]">Active</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input v-model="isActive" type="checkbox" class="sr-only peer" />
            <div class="w-9 h-5 bg-[var(--color-border)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-accent)]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[var(--color-primary)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
          </label>
        </div>
      </div>

      <div v-if="error" class="text-sm text-[var(--color-error-text)] bg-[var(--color-error-bg)] border border-[var(--color-error-border)] px-4 py-3 rounded-lg">{{ error }}</div>

      <div class="flex items-center gap-3">
        <button
          type="submit"
          :disabled="saving"
          class="px-6 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors shadow-sm"
        >
          {{ saving ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template' }}
        </button>
        <button
          type="button"
          @click="router.push('/templates')"
          class="px-6 py-2.5 bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] text-sm font-medium rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-page)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  </div>
</template>
