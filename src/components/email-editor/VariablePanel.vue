<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  VARIABLE_CATEGORIES,
  type VariableCategory,
} from '@/utils/email-template'
import {
  MagnifyingGlassIcon,
  ClipboardDocumentIcon,
  PlusCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline'

function wrapToken(name: string) {
  return `\u007B\u007B${name}\u007D\u007D`
}

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
    <div class="px-3 py-3 border-b border-[var(--color-border)]">
      <h3 class="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">Variables</h3>
      <div class="relative">
        <MagnifyingGlassIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-text-muted)]" />
        <input
          v-model="search"
          type="text"
          placeholder="Search variables..."
          class="w-full pl-8 pr-3 py-1.5 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-muted)]"
        />
      </div>
    </div>

    <!-- Unknown variables warning -->
    <div v-if="unknownVariables.length > 0" class="px-3 py-2 bg-[var(--color-warning-soft)] border-b border-amber-100">
      <div class="flex items-start gap-1.5">
        <ExclamationTriangleIcon class="h-3.5 w-3.5 text-[var(--color-warning-text)] mt-0.5 shrink-0" />
        <div>
          <p class="text-[11px] font-medium text-[var(--color-warning-text)]">Unknown variables</p>
          <div class="flex flex-wrap gap-1 mt-1">
            <span
              v-for="v in unknownVariables"
              :key="v"
              class="inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-[var(--color-warning-soft)] text-[var(--color-warning-text)] rounded"
            >
              <span v-text="wrapToken(v)"></span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div v-for="cat in filteredCategories" :key="cat.key" class="border-b border-[var(--color-border-muted)] last:border-0">
        <button
          @click="toggleCategory(cat.key)"
          class="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
        >
          <ChevronDownIcon
            v-if="expandedCategories.has(cat.key)"
            class="h-3 w-3 text-[var(--color-text-muted)]"
          />
          <ChevronRightIcon v-else class="h-3 w-3 text-[var(--color-text-muted)]" />
          {{ cat.label }}
          <span class="text-[10px] text-[var(--color-text-muted)] font-normal ml-auto">{{ cat.variables.length }}</span>
        </button>

        <div v-if="expandedCategories.has(cat.key)" class="pb-1">
          <div
            v-for="v in cat.variables"
            :key="v.name"
            class="group mx-2 mb-1 p-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5 min-w-0">
                <span
                  :class="[
                    'h-1.5 w-1.5 rounded-full shrink-0',
                    props.usedVariables.has(v.name) ? 'bg-[var(--color-success-soft)]0' : 'bg-[var(--color-text-muted)]',
                  ]"
                ></span>
                <span class="text-xs font-medium text-[var(--color-text-primary)] truncate">{{ v.label }}</span>
                <span v-if="v.required" class="text-[9px] font-bold text-[var(--color-error-text)] uppercase">req</span>
              </div>
              <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  @click="copyToken(v.token)"
                  class="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-info-bg)]"
                  :title="copiedToken === v.token ? 'Copied!' : 'Copy token'"
                >
                  <ClipboardDocumentIcon class="h-3.5 w-3.5" />
                </button>
                <button
                  @click="emit('insert', v.token)"
                  class="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-info-bg)]"
                  title="Insert at cursor"
                >
                  <PlusCircleIcon class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div class="mt-0.5 ml-3">
              <code class="text-[10px] font-mono text-[var(--color-accent)] bg-[var(--color-info-bg)] px-1 py-0.5 rounded">{{ v.token }}</code>
            </div>
            <p class="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 ml-3">{{ v.description }}</p>
            <p class="text-[10px] text-[var(--color-text-muted)] mt-0.5 ml-3">
              Sample: <span class="font-mono">{{ v.sampleValue }}</span>
            </p>
          </div>
        </div>
      </div>

      <div v-if="filteredCategories.length === 0" class="px-3 py-6 text-center">
        <p class="text-xs text-[var(--color-text-muted)]">No variables match "{{ search }}"</p>
      </div>
    </div>
  </div>
</template>
