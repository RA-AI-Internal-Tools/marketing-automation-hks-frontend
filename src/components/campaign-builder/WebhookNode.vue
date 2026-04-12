<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { BoltIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
  id: string
  data: {
    webhook_url: string
    webhook_method: string
    selected?: boolean
  }
}>()

const host = computed(() => {
  try { return new URL(props.data.webhook_url).hostname }
  catch { return props.data.webhook_url || '—' }
})
</script>

<template>
  <div
    class="vf-node vf-node-webhook rounded-lg border-2 bg-violet-50 dark:bg-violet-950/40 shadow-sm"
    :class="data.selected ? 'border-violet-500 ring-2 ring-violet-300' : 'border-violet-400'"
    style="width: 240px; min-height: 76px;"
  >
    <Handle type="target" :position="Position.Top" class="!bg-neutral-500" />

    <div class="flex items-start gap-2 p-3">
      <div class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-white shadow-sm dark:bg-neutral-800">
        <BoltIcon class="h-4 w-4 text-violet-700" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] font-semibold uppercase tracking-wide text-violet-900 dark:text-violet-200">Webhook</span>
          <span class="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-mono text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300">
            {{ (data.webhook_method || 'POST').toUpperCase() }}
          </span>
        </div>
        <div class="mt-1 truncate font-mono text-xs text-neutral-700 dark:text-neutral-300">
          {{ host }}
        </div>
      </div>
    </div>

    <Handle type="source" :position="Position.Bottom" class="!bg-neutral-500" />
  </div>
</template>
