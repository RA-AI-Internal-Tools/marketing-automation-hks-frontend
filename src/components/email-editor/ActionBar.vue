<script setup lang="ts">
import { ref } from 'vue'
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  DocumentDuplicateIcon,
  ArrowLeftIcon,
} from '@heroicons/vue/24/outline'

const props = defineProps<{
  saving: boolean
  isDirty: boolean
  isEdit: boolean
  hasErrors: boolean
}>()

const emit = defineEmits<{
  save: []
  cancel: []
  exportHtml: []
  importHtml: [content: string]
  duplicate: []
}>()

const fileInput = ref<HTMLInputElement>()

function triggerImport() {
  fileInput.value?.click()
}

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      emit('importHtml', reader.result)
    }
  }
  reader.readAsText(file)
  input.value = ''
}
</script>

<template>
  <div class="flex items-center justify-between px-4 py-3 bg-[var(--color-bg-card)] border-t border-[var(--color-border)] shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
    <div class="flex items-center gap-2">
      <!-- Cancel / Back -->
      <button
        @click="emit('cancel')"
        class="btn btn-ghost btn-sm"
      >
        <ArrowLeftIcon class="h-3.5 w-3.5" />
        <span class="hidden sm:inline">Cancel</span>
      </button>

      <!-- Save -->
      <button
        @click="emit('save')"
        :disabled="props.saving || props.hasErrors"
        :title="props.hasErrors ? 'Fix validation errors before saving' : undefined"
        class="btn btn-primary"
      >
        {{ props.saving ? 'Saving...' : props.isEdit ? 'Update Template' : 'Create Template' }}
      </button>

      <!-- Dirty indicator -->
      <span v-if="isDirty" class="text-xs text-[var(--color-warning-text)] font-medium flex items-center gap-1">
        <span class="h-1.5 w-1.5 rounded-full bg-[var(--color-warning)] animate-pulse"></span>
        <span class="hidden sm:inline">Unsaved changes</span>
      </span>
    </div>

    <div class="flex items-center gap-1.5">
      <!-- Export HTML -->
      <button
        @click="emit('exportHtml')"
        class="btn btn-ghost btn-sm"
        title="Export HTML file"
      >
        <ArrowDownTrayIcon class="h-3.5 w-3.5" />
        <span class="hidden sm:inline">Export</span>
      </button>

      <!-- Import HTML -->
      <button
        @click="triggerImport"
        class="btn btn-ghost btn-sm"
        title="Import HTML file"
      >
        <ArrowUpTrayIcon class="h-3.5 w-3.5" />
        <span class="hidden sm:inline">Import</span>
      </button>
      <input
        ref="fileInput"
        type="file"
        accept=".html,.htm"
        class="hidden"
        @change="handleFileChange"
      />

      <!-- Duplicate -->
      <button
        v-if="props.isEdit"
        @click="emit('duplicate')"
        class="btn btn-ghost btn-sm"
        title="Duplicate template"
      >
        <DocumentDuplicateIcon class="h-3.5 w-3.5" />
        <span class="hidden sm:inline">Duplicate</span>
      </button>
    </div>
  </div>
</template>
