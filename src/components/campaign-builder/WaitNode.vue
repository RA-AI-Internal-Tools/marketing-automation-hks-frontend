<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { PauseIcon } from '@heroicons/vue/24/outline'

defineProps<{
  id: string
  data: {
    wait_for_event: string
    wait_for_event_timeout: number
    delay_minutes: number
    selected?: boolean
  }
}>()
</script>

<template>
  <div
    class="vf-node vf-node-wait rounded-lg border-2 bg-amber-50 dark:bg-amber-950/40 shadow-sm"
    :class="data.selected ? 'border-amber-500 ring-2 ring-amber-300' : 'border-amber-400'"
    style="width: 240px; min-height: 76px;"
  >
    <Handle type="target" :position="Position.Top" class="!bg-neutral-500" />

    <div class="flex items-start gap-2 p-3">
      <div class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-white shadow-sm dark:bg-neutral-800">
        <PauseIcon class="h-4 w-4 text-amber-700" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">Wait</span>
          <span v-if="data.wait_for_event_timeout > 0" class="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-mono text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300">
            timeout {{ data.wait_for_event_timeout }}m
          </span>
        </div>
        <div class="mt-1 truncate font-mono text-xs text-neutral-700 dark:text-neutral-300">
          {{ data.wait_for_event ? `event: ${data.wait_for_event}` : `delay: ${data.delay_minutes || 0}m` }}
        </div>
      </div>
    </div>

    <Handle type="source" :position="Position.Bottom" class="!bg-neutral-500" />
  </div>
</template>
