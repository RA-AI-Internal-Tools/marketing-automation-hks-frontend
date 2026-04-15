<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { ArrowUturnRightIcon } from '@heroicons/vue/24/outline'

/**
 * Branch / condition node: one incoming, TWO outgoing handles (true/false).
 * Handle IDs are 'true' / 'false' so Vue Flow preserves which branch each
 * edge belongs to when serialising.
 */
defineProps<{
  id: string
  data: {
    condition: string
    selected?: boolean
  }
}>()
</script>

<template>
  <div
    class="vf-node vf-node-condition rounded-lg border-2 bg-sky-50 dark:bg-sky-950/40 shadow-sm"
    :class="data.selected ? 'border-sky-500 ring-2 ring-sky-300' : 'border-sky-400'"
    style="width: 260px; min-height: 88px;"
  >
    <Handle type="target" :position="Position.Top" class="!bg-neutral-500" />

    <div class="flex items-start gap-2 p-3">
      <div class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-white shadow-sm dark:bg-neutral-800">
        <ArrowUturnRightIcon class="h-4 w-4 text-sky-700" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-200">If</span>
        </div>
        <div class="mt-1 break-words font-mono text-xs text-neutral-700 dark:text-neutral-300">
          {{ data.condition || 'always_true' }}
        </div>
        <div class="mt-1 flex items-center justify-between text-[10px] font-medium">
          <span class="text-[var(--color-success-text)] dark:text-emerald-400">true ↓</span>
          <span class="text-[var(--color-error-text)] dark:text-rose-400">↓ false</span>
        </div>
      </div>
    </div>

    <Handle id="true"  type="source" :position="Position.Bottom" style="left: 30%;" class="!bg-[var(--color-success-soft)]0 !h-3 !w-3" />
    <Handle id="false" type="source" :position="Position.Bottom" style="left: 70%;" class="!bg-[var(--color-error-soft)]0 !h-3 !w-3" />
  </div>
</template>
