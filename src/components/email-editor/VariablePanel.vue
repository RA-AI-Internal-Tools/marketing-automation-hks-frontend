<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  VARIABLE_CATEGORIES,
  type VariableCategory,
} from '@/utils/email-template'

function wrapToken(name: string) {
  return `\u007B\u007B${name}\u007D\u007D`
}
import {
  MagnifyingGlassIcon,
  ClipboardDocumentIcon,
  PlusCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline'

const props = defineProps<{
  usedVariables: Set<string>
  unknownVariables: string[]
}>()

const emit = defineEmits<{
  insert: [token: string]
}>()

const search = ref('')
const expandedCategories = ref<Set<string>>(new Set(VARIABLE_CATEGORIES.map((c) => c.key)))
const copiedToken = ref<string | null>(null)

const filteredCategories = computed<VariableCategory[]>(() => {
  if (!search.value.trim()) return VARIABLE_CATEGORIES
  const q = search.value.toLowerCase()
  return VARIABLE_CATEGORIES
    .map((cat) => ({
      ...cat,
      variables: cat.variables.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.label.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q),
      ),
    }))
    .filter((cat) => cat.variables.length > 0)
})

function toggleCategory(key: string) {
  if (expandedCategories.value.has(key)) {
    expandedCategories.value.delete(key)
  } else {
    expandedCategories.value.add(key)
  }
}

async function copyToken(token: string) {
  try {
    await navigator.clipboard.writeText(token)
    copiedToken.value = token
    setTimeout(() => (copiedToken.value = null), 1500)
  } catch {
    // clipboard may not be available
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-3 py-3 border-b border-gray-200">
      <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Variables</h3>
      <div class="relative">
        <MagnifyingGlassIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          v-model="search"
          type="text"
          placeholder="Search variables..."
          class="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0099db]/30 focus:border-[#0099db]"
        />
      </div>
    </div>

    <!-- Unknown variables warning -->
    <div v-if="unknownVariables.length > 0" class="px-3 py-2 bg-amber-50 border-b border-amber-100">
      <div class="flex items-start gap-1.5">
        <ExclamationTriangleIcon class="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p class="text-[11px] font-medium text-amber-700">Unknown variables</p>
          <div class="flex flex-wrap gap-1 mt-1">
            <span
              v-for="v in unknownVariables"
              :key="v"
              class="inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-amber-100 text-amber-800 rounded"
            >
              <span v-text="wrapToken(v)"></span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div v-for="cat in filteredCategories" :key="cat.key" class="border-b border-gray-100 last:border-0">
        <button
          @click="toggleCategory(cat.key)"
          class="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <ChevronDownIcon
            v-if="expandedCategories.has(cat.key)"
            class="h-3 w-3 text-gray-400"
          />
          <ChevronRightIcon v-else class="h-3 w-3 text-gray-400" />
          {{ cat.label }}
          <span class="text-[10px] text-gray-400 font-normal ml-auto">{{ cat.variables.length }}</span>
        </button>

        <div v-if="expandedCategories.has(cat.key)" class="pb-1">
          <div
            v-for="v in cat.variables"
            :key="v.name"
            class="group mx-2 mb-1 p-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5 min-w-0">
                <span
                  :class="[
                    'h-1.5 w-1.5 rounded-full shrink-0',
                    props.usedVariables.has(v.name) ? 'bg-emerald-500' : 'bg-gray-300',
                  ]"
                ></span>
                <span class="text-xs font-medium text-gray-800 truncate">{{ v.label }}</span>
                <span v-if="v.required" class="text-[9px] font-bold text-red-500 uppercase">req</span>
              </div>
              <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  @click="copyToken(v.token)"
                  class="p-1 rounded text-gray-400 hover:text-[#0099db] hover:bg-blue-50"
                  :title="copiedToken === v.token ? 'Copied!' : 'Copy token'"
                >
                  <ClipboardDocumentIcon class="h-3.5 w-3.5" />
                </button>
                <button
                  @click="emit('insert', v.token)"
                  class="p-1 rounded text-gray-400 hover:text-[#020288] hover:bg-blue-50"
                  title="Insert at cursor"
                >
                  <PlusCircleIcon class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div class="mt-0.5 ml-3">
              <code class="text-[10px] font-mono text-[#0099db] bg-blue-50 px-1 py-0.5 rounded">{{ v.token }}</code>
            </div>
            <p class="text-[11px] text-gray-500 mt-0.5 ml-3">{{ v.description }}</p>
            <p class="text-[10px] text-gray-400 mt-0.5 ml-3">
              Sample: <span class="font-mono">{{ v.sampleValue }}</span>
            </p>
          </div>
        </div>
      </div>

      <div v-if="filteredCategories.length === 0" class="px-3 py-6 text-center">
        <p class="text-xs text-gray-400">No variables match "{{ search }}"</p>
      </div>
    </div>
  </div>
</template>
