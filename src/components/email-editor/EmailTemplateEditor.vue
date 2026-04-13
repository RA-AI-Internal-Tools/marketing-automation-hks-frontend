<script setup lang="ts">
import { ref, computed, onMounted, nextTick, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import { useTemplatesStore } from '@/stores/templates'
import { useVariableParser } from '@/composables/useVariableParser'
import { useEmailValidation } from '@/composables/useEmailValidation'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import { useToast } from '@/composables/useToast'
import {
  getDefaultSampleData,
  DEFAULT_EMAIL_HTML,
  extractVariablesFromMultiple,
} from '@/utils/email-template'
import type { MessageTemplate, EmailTemplateRequest } from '@/api/types'

import EditorTabs from './EditorTabs.vue'
import CodeEditor from './CodeEditor.vue'
import EmailPreview from './EmailPreview.vue'
// Visual editor is lazy so the ~400KB GrapesJS + MJML bundle only loads
// when someone actually opens the Visual tab.
const VisualEditor = defineAsyncComponent(() => import('./VisualEditor.vue'))
import VariablePanel from './VariablePanel.vue'
import SettingsPanel from './SettingsPanel.vue'
import ValidationPanel from './ValidationPanel.vue'
import SampleDataEditor from './SampleDataEditor.vue'
import TestSendPanel from './TestSendPanel.vue'
import ActionBar from './ActionBar.vue'
import { Bars3Icon, XMarkIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
  templateId?: number
  initialTemplate?: MessageTemplate | null
}>()

const router = useRouter()
const store = useTemplatesStore()
const { showToast } = useToast()

const isEdit = computed(() => props.templateId != null)

// Form state
const name = ref('')
const templateKey = ref('')
const subject = ref('')
const preheader = ref('')
const body = ref('')
const fromName = ref('')
const fromEmail = ref('')
const replyTo = ref('')
const category = ref('')
const language = ref('')
const tags = ref<string[]>([])
// mjmlSource is the author-side MJML persisted alongside the compiled
// HTML body. Populated by the Visual tab's <VisualEditor>; left empty
// for templates authored purely in Code mode.
const mjmlSource = ref('')
const isActive = ref(true)
const sampleData = ref<Record<string, any>>(getDefaultSampleData())

// UI state
const activeTab = ref('code')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const sidebarOpen = ref(false)

// Fingerprint for unsaved changes detection
const fingerprint = computed(() =>
  JSON.stringify({ name: name.value, templateKey: templateKey.value, subject: subject.value, preheader: preheader.value, body: body.value, fromName: fromName.value, fromEmail: fromEmail.value, replyTo: replyTo.value, category: category.value, language: language.value, tags: tags.value, isActive: isActive.value }),
)
const { isDirty, markClean } = useUnsavedChanges(fingerprint)

// Variable parser
const { usedVariableNames, unknownVariables, usedSet } = useVariableParser(subject, preheader, body)

// Validation
const { errors, warnings, hasErrors, errorCount, warningCount } = useEmailValidation({
  name,
  templateKey,
  subject,
  preheader,
  body,
  category,
  unknownVariables: computed(() => unknownVariables.value),
})

// Code editor ref for variable insertion
const codeEditorRef = ref<InstanceType<typeof CodeEditor>>()

function populateFromTemplate(tmpl: MessageTemplate) {
  name.value = tmpl.name
  templateKey.value = tmpl.template_key
  subject.value = tmpl.subject || ''
  body.value = tmpl.body || ''
  isActive.value = tmpl.is_active

  // Extended fields (may not exist on older templates)
  const ext = tmpl as any
  mjmlSource.value = ext.mjml_source || ''
  preheader.value = ext.preheader || ''
  fromName.value = ext.from_name || ''
  fromEmail.value = ext.from_email || ''
  replyTo.value = ext.reply_to || ''
  category.value = ext.category || ''
  language.value = ext.language || ''
  tags.value = ext.tags || []
  if (ext.sample_payload) {
    sampleData.value = ext.sample_payload
  }
}

// Load template
onMounted(async () => {
  if (isEdit.value && props.templateId) {
    // Use pre-loaded data if available (avoids double API call)
    if (props.initialTemplate) {
      populateFromTemplate(props.initialTemplate)
      await nextTick()
      markClean()
    } else {
      loading.value = true
      try {
        const tmpl = await store.get(props.templateId)
        populateFromTemplate(tmpl)
        await nextTick()
        markClean()
      } catch {
        error.value = 'Failed to load template'
      } finally {
        loading.value = false
      }
    }
  } else {
    // New template — set starter HTML
    body.value = DEFAULT_EMAIL_HTML
    await nextTick()
    markClean()
  }
})

// Save handler
async function handleSave() {
  error.value = ''

  if (hasErrors.value) {
    activeTab.value = 'settings'
    showToast('Please fix validation errors before saving', 'error')
    return
  }

  saving.value = true
  try {
    const variables = extractVariablesFromMultiple(subject.value, preheader.value, body.value)

    const req: EmailTemplateRequest = {
      template_key: templateKey.value,
      channel: 'email',
      name: name.value,
      subject: subject.value || null,
      body: body.value,
      mjml_source: mjmlSource.value || undefined,
      variables: variables.length > 0 ? variables : undefined,
      is_active: isActive.value,
      preheader: preheader.value || null,
      from_name: fromName.value || null,
      from_email: fromEmail.value || null,
      reply_to: replyTo.value || null,
      category: category.value || null,
      language: language.value || null,
      tags: tags.value.length > 0 ? tags.value : undefined,
      sample_payload: Object.keys(sampleData.value).length > 0 ? sampleData.value : null,
      editor_mode: 'code',
    }

    if (isEdit.value && props.templateId) {
      await store.update(props.templateId, req)
      showToast('Template updated successfully', 'success')
    } else {
      await store.create(req)
      showToast('Template created successfully', 'success')
    }
    markClean()
    router.push('/templates')
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to save template'
    showToast(error.value, 'error')
  } finally {
    saving.value = false
  }
}

// Variable insertion from panel
function handleInsertVariable(token: string) {
  if (activeTab.value !== 'code') {
    activeTab.value = 'code'
  }
  setTimeout(() => {
    codeEditorRef.value?.insertAtCursor(token)
  }, 50)
}

// Export HTML
function handleExportHtml() {
  const blob = new Blob([body.value], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${templateKey.value || 'template'}.html`
  a.click()
  URL.revokeObjectURL(url)
  showToast('HTML exported', 'success')
}

// Import HTML
function handleImportHtml(content: string) {
  body.value = content
  activeTab.value = 'code'
  showToast('HTML imported', 'success')
}

// Duplicate
async function handleDuplicate() {
  if (!isEdit.value || !props.templateId) return
  try {
    const variables = extractVariablesFromMultiple(subject.value, preheader.value, body.value)
    const req: EmailTemplateRequest = {
      template_key: templateKey.value + '_copy',
      channel: 'email',
      name: name.value + ' (Copy)',
      subject: subject.value || null,
      body: body.value,
      variables: variables.length > 0 ? variables : undefined,
      is_active: false,
      preheader: preheader.value || null,
      from_name: fromName.value || null,
      from_email: fromEmail.value || null,
      reply_to: replyTo.value || null,
      category: category.value || null,
      language: language.value || null,
      tags: tags.value.length > 0 ? tags.value : undefined,
      sample_payload: Object.keys(sampleData.value).length > 0 ? sampleData.value : null,
      editor_mode: 'code',
    }
    const created = await store.create(req)
    showToast('Template duplicated', 'success')
    router.push(`/templates/${created.id}/edit`)
  } catch (e: any) {
    showToast(e.response?.data?.error || 'Failed to duplicate', 'error')
  }
}

// Cancel / navigate back
function handleCancel() {
  if (isDirty.value) {
    if (!window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
      return
    }
  }
  markClean()
  router.push('/templates')
}

// Go to field handler from validation panel
function handleGoToField(field: string) {
  if (field === 'body') {
    activeTab.value = 'code'
  } else {
    activeTab.value = 'settings'
  }
}

// Dismiss error
function dismissError() {
  error.value = ''
}

// Keyboard shortcut: Ctrl+S to save
function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    handleSave()
  }
}
</script>

<template>
  <div
    class="flex flex-col h-[calc(100vh-80px)] bg-gray-50 rounded-xl overflow-hidden border border-gray-200/80 shadow-sm"
    @keydown="handleKeydown"
  >
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center h-full">
      <div class="text-center">
        <div class="skeleton h-6 w-48 mx-auto mb-3"></div>
        <div class="skeleton h-4 w-32 mx-auto"></div>
      </div>
    </div>

    <template v-else>
      <!-- Top bar: tabs + channel indicator + sidebar toggle -->
      <div class="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200">
        <div class="flex items-center gap-3">
          <EditorTabs
            v-model:activeTab="activeTab"
            :error-count="errorCount"
            :warning-count="warningCount"
          />
          <span class="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded-full uppercase tracking-wide">
            Email
          </span>
        </div>
        <button
          @click="sidebarOpen = !sidebarOpen"
          class="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          title="Toggle sidebar"
        >
          <XMarkIcon v-if="sidebarOpen" class="h-5 w-5" />
          <Bars3Icon v-else class="h-5 w-5" />
        </button>
      </div>

      <!-- Error banner (dismissible) -->
      <div v-if="error" class="flex items-center justify-between px-4 py-2 bg-red-50 border-b border-red-100">
        <span class="text-sm text-red-600">{{ error }}</span>
        <button @click="dismissError" class="text-red-400 hover:text-red-600 p-1 rounded transition-colors">
          <XMarkIcon class="h-4 w-4" />
        </button>
      </div>

      <!-- Main content area -->
      <div class="flex flex-1 min-h-0">
        <!-- Left: Editor / Preview / Settings -->
        <div class="flex-1 flex flex-col min-w-0">
          <!-- Visual Tab — GrapesJS + MJML drag-and-drop. v-model is
               mjmlSource; @update-html syncs the compiled HTML into
               body so the runtime renderer keeps using the same field.
               v-if (not v-show) so the editor only initialises when
               the tab is actually active — GrapesJS is heavy. -->
          <div v-if="activeTab === 'visual'" class="flex-1 flex flex-col min-h-0">
            <VisualEditor
              v-model="mjmlSource"
              :initial-html="body"
              @update-html="(html) => (body = html)"
            />
          </div>

          <!-- Code Tab -->
          <div v-show="activeTab === 'code'" class="flex-1 p-4 overflow-auto">
            <CodeEditor
              ref="codeEditorRef"
              v-model="body"
              placeholder="Write your HTML email template here..."
            />
          </div>

          <!-- Preview Tab -->
          <div v-show="activeTab === 'preview'" class="flex-1 flex flex-col">
            <EmailPreview
              :html="body"
              :subject="subject"
              :preheader="preheader"
              :sample-data="sampleData"
            />
          </div>

          <!-- Settings Tab -->
          <div v-show="activeTab === 'settings'" class="flex-1 overflow-auto bg-white">
            <SettingsPanel
              v-model:name="name"
              v-model:templateKey="templateKey"
              v-model:subject="subject"
              v-model:preheader="preheader"
              v-model:fromName="fromName"
              v-model:fromEmail="fromEmail"
              v-model:replyTo="replyTo"
              v-model:category="category"
              v-model:language="language"
              v-model:tags="tags"
              v-model:isActive="isActive"
            />
          </div>

          <!-- Test Send Tab -->
          <div v-show="activeTab === 'test'" class="flex-1 overflow-auto bg-white">
            <TestSendPanel
              :template-key="templateKey"
              :sample-data="sampleData"
            />
          </div>
        </div>

        <!-- Right Sidebar (Desktop: always visible; Mobile: overlay) -->
        <div
          :class="[
            'border-l border-gray-200 bg-white flex flex-col w-[320px] shrink-0 transition-transform duration-200',
            'max-lg:fixed max-lg:right-0 max-lg:top-0 max-lg:bottom-0 max-lg:z-40 max-lg:shadow-xl',
            sidebarOpen ? 'max-lg:translate-x-0' : 'max-lg:translate-x-full',
          ]"
        >
          <!-- Variable panel -->
          <div class="flex-1 min-h-0 overflow-y-auto">
            <VariablePanel
              :used-variables="usedSet"
              :unknown-variables="unknownVariables"
              @insert="handleInsertVariable"
            />
          </div>

          <!-- Sample data -->
          <div class="border-t border-gray-200">
            <SampleDataEditor v-model="sampleData" />
          </div>

          <!-- Validation -->
          <div class="border-t border-gray-200">
            <ValidationPanel
              :errors="errors"
              :warnings="warnings"
              @go-to-field="handleGoToField"
            />
          </div>
        </div>

        <!-- Sidebar overlay backdrop (mobile) -->
        <div
          v-if="sidebarOpen"
          class="lg:hidden fixed inset-0 z-[35] bg-black/40"
          @click="sidebarOpen = false"
        ></div>
      </div>

      <!-- Bottom action bar -->
      <ActionBar
        :saving="saving"
        :is-dirty="isDirty"
        :is-edit="isEdit"
        :has-errors="hasErrors"
        @save="handleSave"
        @cancel="handleCancel"
        @export-html="handleExportHtml"
        @import-html="handleImportHtml"
        @duplicate="handleDuplicate"
      />
    </template>
  </div>
</template>
