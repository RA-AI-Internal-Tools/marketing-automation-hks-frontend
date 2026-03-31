<script setup lang="ts">
import type { FunnelStage } from '@/api/types'

const props = defineProps<{
  stages: FunnelStage[]
}>()

function widthPercent(index: number): number {
  if (!props.stages.length) return 0
  const max = props.stages[0]?.count || 1
  return Math.max(((props.stages[index]?.count || 0) / max) * 100, 8)
}

const colors = [
  'bg-indigo-600',
  'bg-indigo-500',
  'bg-blue-500',
  'bg-blue-400',
  'bg-cyan-400',
]
</script>

<template>
  <div class="space-y-3">
    <div v-for="(stage, i) in stages" :key="stage.name" class="flex items-center gap-4">
      <div class="w-32 text-sm font-medium text-gray-700 text-right shrink-0">
        {{ stage.name }}
      </div>
      <div class="flex-1">
        <div
          :class="[colors[i % colors.length], 'h-10 rounded-lg flex items-center px-3 transition-all duration-500']"
          :style="{ width: widthPercent(i) + '%' }"
        >
          <span class="text-white text-sm font-semibold whitespace-nowrap">
            {{ stage.count.toLocaleString() }}
          </span>
        </div>
      </div>
      <div class="w-16 text-right text-sm text-gray-500 shrink-0">
        {{ stage.conversion_rate.toFixed(1) }}%
      </div>
    </div>
  </div>
</template>
