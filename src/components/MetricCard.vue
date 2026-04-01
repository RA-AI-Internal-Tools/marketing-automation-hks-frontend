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

const accentColors: Record<string, string> = {
  indigo: 'bg-[#020288]',
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-[#0099db]',
}
</script>

<template>
  <div class="bg-white rounded-xl border border-gray-200/80 shadow-sm card-interactive overflow-hidden">
    <div class="h-1" :class="accentColors[color || 'indigo']"></div>
    <div class="p-5">
      <p class="text-xs font-medium text-slate-500 uppercase tracking-wide">{{ title }}</p>
      <p class="mt-2 text-2xl font-bold text-gray-900 tracking-tight">{{ value }}</p>
      <div v-if="delta !== undefined" class="mt-2 flex items-center gap-1.5">
        <span
          :class="[
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
            delta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          ]"
        >
          <ArrowTrendingUpIcon v-if="delta >= 0" class="h-3.5 w-3.5" />
          <ArrowTrendingDownIcon v-else class="h-3.5 w-3.5" />
          {{ delta >= 0 ? '+' : '' }}{{ delta.toFixed(1) }}%
        </span>
        <span v-if="deltaLabel" class="text-xs text-slate-400">{{ deltaLabel }}</span>
      </div>
    </div>
  </div>
</template>
