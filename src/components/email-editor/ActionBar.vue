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
  <div class="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
    <div class="flex items-center gap-2">
      <!-- Cancel / Back -->
      <button
        @click="emit('cancel')"
        class="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <ArrowLeftIcon class="h-3.5 w-3.5" />
        <span class="hidden sm:inline">Cancel</span>
      </button>

      <!-- Save -->
      <button
        @click="emit('save')"
        :disabled="props.saving || props.hasErrors"
        :title="props.hasErrors ? 'Fix validation errors before saving' : undefined"
        class="px-5 py-2 bg-[#020288] text-white text-sm font-medium rounded-lg hover:bg-[#0d35d7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        {{ props.saving ? 'Saving...' : props.isEdit ? 'Update Template' : 'Create Template' }}
      </button>

      <!-- Dirty indicator -->
      <span v-if="isDirty" class="text-xs text-amber-500 font-medium flex items-center gap-1">
        <span class="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></span>
        <span class="hidden sm:inline">Unsaved changes</span>
      </span>
    </div>

    <div class="flex items-center gap-1.5">
      <!-- Export HTML -->
      <button
        @click="emit('exportHtml')"
        class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        title="Export HTML file"
      >
        <ArrowDownTrayIcon class="h-3.5 w-3.5" />
        <span class="hidden sm:inline">Export</span>
      </button>

      <!-- Import HTML -->
      <button
        @click="triggerImport"
        class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
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
        class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        title="Duplicate template"
      >
        <DocumentDuplicateIcon class="h-3.5 w-3.5" />
        <span class="hidden sm:inline">Duplicate</span>
      </button>
    </div>
  </div>
</template>
