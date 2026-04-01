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
  'bg-[#020288]',
  'bg-[#0d35d7]',
  'bg-[#0099db]',
  'bg-[#50C8ED]',
  'bg-cyan-300',
]
</script>

<template>
  <div class="space-y-3">
    <div v-for="(stage, i) in stages" :key="stage.name" class="flex items-center gap-4">
      <div class="w-32 text-sm font-medium text-[var(--color-text-secondary)] text-right shrink-0">
        {{ stage.name }}
      </div>
      <div class="flex-1">
        <div
          :class="[colors[i % colors.length], 'h-10 rounded-lg flex items-center px-3 transition-all duration-500 shadow-sm']"
          :style="{ width: widthPercent(i) + '%' }"
        >
          <span class="text-white text-sm font-semibold whitespace-nowrap drop-shadow-sm">
            {{ stage.count.toLocaleString() }}
          </span>
        </div>
      </div>
      <div class="w-16 text-right text-sm font-medium text-[var(--color-text-tertiary)] shrink-0">
        {{ stage.conversion_rate.toFixed(1) }}%
      </div>
    </div>
  </div>
</template>
