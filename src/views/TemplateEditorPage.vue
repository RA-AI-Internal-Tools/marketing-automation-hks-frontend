<script setup lang="ts">
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
// Lazy-load the email editor — its transitive deps (codemirror, grapesjs via
// VisualEditor) are large and only needed when editing email templates.
const EmailTemplateEditor = defineAsyncComponent(
  () => import('@/components/email-editor/EmailTemplateEditor.vue'),
)
import { useTemplatesStore } from '@/stores/templates'
import type { MessageTemplate, TemplateRequest } from '@/api/types'
import { TEMPLATE_LANGUAGES, buildLocalizedTemplateKey } from '@/utils/email-template'

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
// Locale-variant composer helper (not persisted for non-email channels — it
// drives the template_key naming convention the MA executor resolves at send
// time). WhatsApp is a special case: language is handled on Meta's side, so
// we keep the base key unchanged.
const language = ref('')
const localizedKey = computed(() =>
  buildLocalizedTemplateKey(templateKey.value, language.value),
)
const needsLocaleSuffix = computed(() =>
  !!language.value && !!templateKey.value && localizedKey.value !== templateKey.value,
)
function applyLocaleSuffix() {
  if (needsLocaleSuffix.value) templateKey.value = localizedKey.value
}

// In-app inbox-only fields
const ctaUrl = ref('')
const ctaLabel = ref('')
const inboxType = ref<'info' | 'success' | 'warning' | 'danger' | 'promo'>('info')
const inboxTypes = ['info', 'success', 'warning', 'danger', 'promo'] as const

const saving = ref(false)
const error = ref('')
const loading = ref(false)

const channels = ['email', 'sms', 'whatsapp', 'push', 'inbox']

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
        ctaUrl.value = tmpl.cta_url || ''
        ctaLabel.value = tmpl.cta_label || ''
        inboxType.value = tmpl.inbox_type || 'info'
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

    const isInbox = channel.value === 'inbox'
    const req: TemplateRequest = {
      template_key: templateKey.value,
      channel: channel.value,
      name: name.value,
      subject: channel.value === 'email' || isInbox ? subject.value || null : null,
      body: body.value,
      variables: variables.length > 0 ? variables : undefined,
      is_active: isActive.value,
      ...(isInbox && {
        cta_url: ctaUrl.value || null,
        cta_label: ctaLabel.value || null,
        inbox_type: inboxType.value,
      }),
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

const inputClass = 'w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-focus-ring)] transition-shadow'
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
            <label class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Name <span class="text-[var(--color-error-text)]">*</span></label>
            <input v-model="name" required :class="inputClass" placeholder="Template name" />
          </div>
          <div>
            <label class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Template Key <span class="text-[var(--color-error-text)]">*</span></label>
            <input v-model="templateKey" required :class="inputClass" placeholder="e.g. welcome_sms" />
          </div>
        </div>

        <div v-if="channelLocked" class="flex items-center gap-2">
          <span class="text-xs font-medium text-[var(--color-text-secondary)]">Channel:</span>
          <span class="px-2.5 py-0.5 text-xs font-medium rounded-full capitalize"
            :class="{
              'bg-purple-100 text-purple-800': channel === 'sms',
              'bg-[var(--color-success-soft)] text-[var(--color-success-text)]': channel === 'whatsapp',
              'bg-orange-100 text-orange-800': channel === 'push',
              'bg-blue-100 text-blue-800': channel === 'inbox',
            }"
          >
            {{ channel }}
          </span>
        </div>

        <div v-if="channel === 'inbox'">
          <label class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Subject <span class="text-red-500">*</span></label>
          <input v-model="subject" required :class="inputClass" placeholder="Notification subject line" maxlength="255" />
        </div>

        <!-- Language / locale-variant helper -->
        <div>
          <label class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Language</label>
          <select v-model="language" :class="inputClass">
            <option value="">— Select —</option>
            <option v-for="l in TEMPLATE_LANGUAGES" :key="l.value" :value="l.value">{{ l.label }}</option>
          </select>

          <!-- WhatsApp: Meta owns language selection; don't suffix the key -->
          <p v-if="channel === 'whatsapp' && language" class="text-[11px] mt-1 text-[var(--color-text-muted)]">
            WhatsApp templates are resolved by Meta using <code class="px-1 py-[1px] rounded bg-[var(--color-bg-muted)]">(template_name, language_code)</code>.
            Keep the template key as the <strong>base name</strong> and register each language version on Meta Business Console.
            The recipient's locale is passed automatically at send time.
          </p>

          <!-- SMS / Push: same key.locale convention as email -->
          <p v-else-if="language && templateKey" class="text-[11px] mt-1 text-[var(--color-text-muted)]">
            Sends as
            <code class="px-1 py-[1px] rounded bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]">{{ localizedKey }}</code>
            — recipients with matching locale get this variant; others fall back to the base key.
            <button
              v-if="needsLocaleSuffix"
              type="button"
              @click="applyLocaleSuffix"
              class="ml-1 underline text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
            >
              Apply to key
            </button>
          </p>
        </div>

        <div>
          <label class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Body <span class="text-[var(--color-error-text)]">*</span></label>
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

        <div v-if="channel === 'inbox'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Type</label>
            <select v-model="inboxType" :class="inputClass">
              <option v-for="t in inboxTypes" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">CTA URL</label>
            <input v-model="ctaUrl" :class="inputClass" placeholder="https://ar-pay.store/..." />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">CTA Label</label>
            <input
              v-model="ctaLabel"
              :class="inputClass"
              placeholder="e.g. View order"
              :disabled="!ctaUrl"
              maxlength="64"
            />
          </div>
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
