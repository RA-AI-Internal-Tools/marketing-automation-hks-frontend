<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { TEMPLATE_CATEGORIES, TEMPLATE_LANGUAGES, buildLocalizedTemplateKey } from '@/utils/email-template'
import AISubjectLineModal from '@/components/AISubjectLineModal.vue'
import { fetchAIStatus } from '@/api/ai'
import { SparklesIcon } from '@heroicons/vue/24/outline'

const aiEnabled = ref(false)
const aiSubjectOpen = ref(false)
// One-shot probe — hide the button unless the backend confirms AI is
// configured. Failure treated as disabled (fail-closed).
fetchAIStatus().then(s => { aiEnabled.value = !!s.enabled }).catch(() => {})

// fromName / fromEmail / replyTo / tags used to live here. Nothing consumed
// them — the API never stored them and neither email sender reads them — so
// asking authors to fill them in was worse than not asking. See
// src/api/types.ts EmailTemplateRequest for the per-field rationale.
const props = defineProps<{
  name: string
  templateKey: string
  subject: string
  preheader: string
  category: string
  language: string
  isActive: boolean
}>()

const emit = defineEmits<{
  'update:name': [value: string]
  'update:templateKey': [value: string]
  'update:subject': [value: string]
  'update:preheader': [value: string]
  'update:category': [value: string]
  'update:language': [value: string]
  'update:isActive': [value: boolean]
}>()

// Auto-generate template key from name
const autoKey = ref(true)
watch(() => props.name, (val) => {
  if (autoKey.value && !props.templateKey.trim()) {
    emit('update:templateKey', val.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))
  }
})

function onKeyManualEdit() {
  autoKey.value = false
}

// Locale-variant helper: backend resolver tries key.locale → key.region → key.
// Show the target key and offer a one-click rename to match the convention.
const localizedKey = computed(() =>
  buildLocalizedTemplateKey(props.templateKey, props.language),
)
const needsLocaleSuffix = computed(() =>
  !!props.language && !!props.templateKey && localizedKey.value !== props.templateKey,
)
function applyLocaleSuffix() {
  if (needsLocaleSuffix.value) {
    autoKey.value = false
    emit('update:templateKey', localizedKey.value)
  }
}

const inputClass = 'w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-bg-input)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] transition-shadow placeholder:text-[var(--color-text-muted)]'
const labelClass = 'block text-xs font-medium text-[var(--color-text-secondary)] mb-1'
</script>

<template>
  <div class="p-5 space-y-5">
    <h3 class="text-sm font-semibold text-[var(--color-text-primary)]">Template Settings</h3>

    <!-- Name & Key -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label :class="labelClass">
          Name <span class="text-[var(--color-error-text)]">*</span>
        </label>
        <input
          :value="name"
          @input="emit('update:name', ($event.target as HTMLInputElement).value)"
          :class="inputClass"
          placeholder="e.g. Welcome Email"
          required
        />
      </div>
      <div>
        <label :class="labelClass">
          Template Key <span class="text-[var(--color-error-text)]">*</span>
        </label>
        <input
          :value="templateKey"
          @input="emit('update:templateKey', ($event.target as HTMLInputElement).value); onKeyManualEdit()"
          :class="inputClass"
          placeholder="e.g. welcome_email"
          required
        />
      </div>
    </div>

    <!-- Subject -->
    <div>
      <div class="flex items-center justify-between">
        <label :class="labelClass">
          Subject Line <span class="text-[var(--color-error-text)]">*</span>
        </label>
        <button v-if="aiEnabled" type="button"
                @click="aiSubjectOpen = true"
                class="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1 text-[11px] font-medium hover:bg-[var(--color-bg-page)]"
                :aria-label="'Generate subject line with AI'">
          <SparklesIcon class="h-3.5 w-3.5 text-ma-accent" aria-hidden="true" /> Generate with AI
        </button>
      </div>
      <input
        :value="subject"
        @input="emit('update:subject', ($event.target as HTMLInputElement).value)"
        :class="inputClass"
        placeholder="Email subject line — use {{first_name}} for personalization"
      />
      <p class="text-[11px] mt-1" :class="subject.length > 78 ? 'text-[var(--color-warning-text)]' : 'text-[var(--color-text-muted)]'">
        {{ subject.length }} / 78 characters recommended
      </p>
      <AISubjectLineModal
        :open="aiSubjectOpen"
        @update:open="aiSubjectOpen = $event"
        @pick="(line) => { emit('update:subject', line); aiSubjectOpen = false }"
      />
    </div>

    <!-- Preheader -->
    <div>
      <label :class="labelClass">Preheader Text</label>
      <input
        :value="preheader"
        @input="emit('update:preheader', ($event.target as HTMLInputElement).value)"
        :class="inputClass"
        placeholder="Preview text shown after subject in inbox"
      />
      <p class="text-[11px] mt-1" :class="preheader.length > 0 && (preheader.length < 40 || preheader.length > 130) ? 'text-[var(--color-warning-text)]' : 'text-[var(--color-text-muted)]'">
        {{ preheader.length > 0 ? `${preheader.length} / 40–130 characters recommended` : 'Recommended: 40–130 characters' }}
      </p>
    </div>

    <hr class="border-[var(--color-border-muted)]" />

    <!-- Sender identity is intentionally NOT editable here. Both senders take
         it from configuration, not the template: SES uses SES_FROM_EMAIL /
         SES_FROM_NAME (internal/channel/ses.go NewSES) and Elastic Email
         resolves the sender on its own side. The inputs that used to sit here
         were collected and discarded on every save. -->
    <div class="rounded-lg border border-[var(--color-border-muted)] bg-[var(--color-bg-subtle)] px-3 py-2">
      <p class="text-[11px] text-[var(--color-text-muted)]">
        <span class="font-medium text-[var(--color-text-secondary)]">Sender identity</span>
        is set once per environment, not per template. Ask an administrator to change the
        From name, From address or Reply-To.
      </p>
    </div>

    <hr class="border-[var(--color-border-muted)]" />

    <!-- Classification -->
    <h4 class="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Classification</h4>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label :class="labelClass">Category</label>
        <select
          :value="category"
          @change="emit('update:category', ($event.target as HTMLSelectElement).value)"
          :class="inputClass"
        >
          <option value="">— Select —</option>
          <option v-for="c in TEMPLATE_CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
      </div>
      <div>
        <label :class="labelClass">Language</label>
        <select
          :value="language"
          @change="emit('update:language', ($event.target as HTMLSelectElement).value)"
          :class="inputClass"
        >
          <option value="">— Select —</option>
          <option v-for="l in TEMPLATE_LANGUAGES" :key="l.value" :value="l.value">{{ l.label }}</option>
        </select>
        <p v-if="language && templateKey" class="text-[11px] mt-1 text-[var(--color-text-muted)]">
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
    </div>

    <!-- Active Toggle -->
    <div class="flex items-center justify-between py-2">
      <div>
        <p class="text-sm font-medium text-[var(--color-text-secondary)]">Active</p>
        <p class="text-xs text-[var(--color-text-muted)]">Template is available for sending</p>
      </div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input
          :checked="isActive"
          @change="emit('update:isActive', ($event.target as HTMLInputElement).checked)"
          type="checkbox"
          class="sr-only peer"
        />
        <div class="w-9 h-5 bg-[var(--color-bg-muted)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-accent)]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[var(--color-primary)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
      </label>
    </div>
  </div>
</template>
