<script setup lang="ts">
import { ref, watch } from 'vue'
import { getDefaultSampleData } from '@/utils/email-template'
import { ArrowPathIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
  modelValue: Record<string, any>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, any>]
}>()

const jsonText = ref(JSON.stringify(props.modelValue, null, 2))
const parseError = ref('')
const expanded = ref(false)

watch(() => props.modelValue, (val) => {
  try {
    const current = JSON.parse(jsonText.value)
    if (JSON.stringify(current) !== JSON.stringify(val)) {
      jsonText.value = JSON.stringify(val, null, 2)
    }
  } catch {
    jsonText.value = JSON.stringify(val, null, 2)
  }
}, { deep: true })

function handleInput(value: string) {
  jsonText.value = value
  parseError.value = ''
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed === 'object' && parsed !== null) {
      emit('update:modelValue', parsed)
    } else {
      parseError.value = 'Must be a JSON object'
    }
  } catch (e: any) {
    parseError.value = e.message || 'Invalid JSON'
  }
}

function resetToDefaults() {
  const defaults = getDefaultSampleData()
  jsonText.value = JSON.stringify(defaults, null, 2)
  parseError.value = ''
  emit('update:modelValue', defaults)
}
</script>

<template>
  <div class="px-3 py-2">
    <div class="flex items-center justify-between">
      <button
        @click="expanded = !expanded"
        class="flex items-center gap-1 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider hover:text-[var(--color-text-secondary)] transition-colors"
      >
        <ChevronDownIcon v-if="expanded" class="h-3 w-3" />
        <ChevronRightIcon v-else class="h-3 w-3" />
        Sample Data
      </button>
      <button
        v-if="expanded"
        @click="resetToDefaults"
        class="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] transition-colors"
        title="Reset to default sample values"
      >
        <ArrowPathIcon class="h-3 w-3" />
        Reset
      </button>
    </div>
    <div v-if="expanded" class="mt-2">
      <textarea
        :value="jsonText"
        @input="handleInput(($event.target as HTMLTextAreaElement).value)"
        rows="5"
        class="w-full px-3 py-2 text-xs font-mono border rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] resize-y placeholder:text-[var(--color-text-muted)]"
        :class="parseError ? 'border-red-300' : 'border-[var(--color-border)]'"
        placeholder='{"first_name": "John", ...}'
      ></textarea>
      <p v-if="parseError" class="text-[11px] text-[var(--color-error-text)] mt-1">{{ parseError }}</p>
      <p v-else class="text-[11px] text-[var(--color-text-muted)] mt-1">
        Variables in preview will be replaced with these values
      </p>
    </div>
  </div>
</template>
