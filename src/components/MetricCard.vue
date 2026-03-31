<script setup lang="ts">
import { computed } from 'vue'
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
  title: string
  value: string | number
  delta?: number
  deltaLabel?: string
  color?: 'indigo' | 'green' | 'yellow' | 'red' | 'blue'
}>()

const borderClass = computed(() => {
  switch (props.color) {
    case 'green': return 'border-l-4 border-l-green-500'
    case 'red': return 'border-l-4 border-l-red-500'
    case 'yellow': return 'border-l-4 border-l-amber-500'
    case 'blue': return 'border-l-4 border-l-blue-500'
    case 'indigo': return 'border-l-4 border-l-indigo-500'
    default: return ''
  }
})
</script>

<template>
  <div :class="['bg-white rounded-xl border border-gray-200 p-6', borderClass]">
    <p class="text-sm font-medium text-gray-500">{{ title }}</p>
    <p class="mt-2 text-3xl font-bold text-gray-900">{{ value }}</p>
    <div v-if="delta !== undefined" class="mt-1 flex items-center gap-1 text-sm">
      <ArrowTrendingUpIcon v-if="delta >= 0" class="h-4 w-4 text-green-600" />
      <ArrowTrendingDownIcon v-else class="h-4 w-4 text-red-600" />
      <span :class="delta >= 0 ? 'text-green-600' : 'text-red-600'">
        {{ delta >= 0 ? '+' : '' }}{{ delta.toFixed(1) }}%
      </span>
      <span v-if="deltaLabel" class="text-gray-400">{{ deltaLabel }}</span>
    </div>
  </div>
</template>
