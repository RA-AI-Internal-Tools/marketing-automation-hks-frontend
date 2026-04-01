<script setup lang="ts">
import { ref, watch } from 'vue'
import { getDefaultSampleData } from '@/utils/email-template'
import { ArrowPathIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
  modelValue: Record<string, any>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, any>]
}>()

const jsonText = ref(JSON.stringify(props.modelValue, null, 2))
const parseError = ref('')

watch(() => props.modelValue, (val) => {
  // Only update text if external change (avoid overwriting user edits)
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
  <div class="px-3 py-3">
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sample Data</h3>
      <button
        @click="resetToDefaults"
        class="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-[#0099db] transition-colors"
        title="Reset to default sample values"
      >
        <ArrowPathIcon class="h-3 w-3" />
        Reset
      </button>
    </div>
    <textarea
      :value="jsonText"
      @input="handleInput(($event.target as HTMLTextAreaElement).value)"
      rows="8"
      class="w-full px-3 py-2 text-xs font-mono border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0099db]/30 focus:border-[#0099db] resize-y"
      :class="parseError ? 'border-red-300' : 'border-gray-200'"
      placeholder='{"first_name": "John", ...}'
    ></textarea>
    <p v-if="parseError" class="text-[11px] text-red-500 mt-1">{{ parseError }}</p>
    <p v-else class="text-[11px] text-gray-400 mt-1">
      Variables in preview will be replaced with these values
    </p>
  </div>
</template>
