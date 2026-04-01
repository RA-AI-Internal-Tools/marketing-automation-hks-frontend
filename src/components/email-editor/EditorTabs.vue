<script setup lang="ts">
import {
  CodeBracketIcon,
  EyeIcon,
  Cog6ToothIcon,
  BeakerIcon,
} from '@heroicons/vue/24/outline'

defineProps<{
  activeTab: string
  errorCount?: number
  warningCount?: number
}>()

const emit = defineEmits<{
  'update:activeTab': [tab: string]
}>()

const tabs = [
  { key: 'code', label: 'Code', icon: CodeBracketIcon },
  { key: 'preview', label: 'Preview', icon: EyeIcon },
  { key: 'settings', label: 'Settings', icon: Cog6ToothIcon },
  { key: 'test', label: 'Test Send', icon: BeakerIcon },
]
</script>

<template>
  <div class="flex items-center gap-1 px-1 py-1.5 bg-gray-100 rounded-xl">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      @click="emit('update:activeTab', tab.key)"
      :class="[
        'flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-all duration-150',
        activeTab === tab.key
          ? 'bg-white text-[#020288] shadow-sm'
          : 'text-gray-500 hover:text-gray-700 hover:bg-white/50',
      ]"
    >
      <component :is="tab.icon" class="h-4 w-4" />
      <span class="hidden sm:inline">{{ tab.label }}</span>
      <span
        v-if="tab.key === 'settings' && (errorCount || 0) > 0"
        class="ml-0.5 inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full"
      >
        {{ errorCount }}
      </span>
      <span
        v-else-if="tab.key === 'settings' && (warningCount || 0) > 0"
        class="ml-0.5 inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full"
      >
        {{ warningCount }}
      </span>
    </button>
  </div>
</template>
