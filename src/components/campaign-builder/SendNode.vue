<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { PaperAirplaneIcon } from '@heroicons/vue/24/outline'

/**
 * Send step: dispatches a message on one channel using one template.
 * Two handles: top (incoming, single) and bottom (outgoing, single "next").
 * Branching lives on ConditionNode; mixing concerns here makes the UI
 * harder to read.
 */
const props = defineProps<{
  id: string
  data: {
    channel: string
    template_key: string
    delay_minutes: number
    selected?: boolean
  }
}>()

const channelColors: Record<string, string> = {
  email:    'bg-[var(--color-info-soft)] text-[var(--color-info-text)] dark:bg-blue-900/50 dark:text-blue-200',
  sms:      'bg-[var(--color-success-soft)] text-[var(--color-success-text)] dark:bg-green-900/50 dark:text-green-200',
  whatsapp: 'bg-[var(--color-success-soft)] text-[var(--color-success-text)] dark:bg-emerald-900/50 dark:text-emerald-200',
  push:     'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200',
  onsite:   'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/50 dark:text-fuchsia-200',
}
</script>

<template>
  <div
    class="vf-node vf-node-send rounded-lg border-2 bg-[var(--color-success-soft)] dark:bg-emerald-950/40 shadow-sm"
    :class="data.selected ? 'border-emerald-500 ring-2 ring-emerald-300' : 'border-emerald-400'"
    style="width: 240px; min-height: 76px;"
  >
    <Handle type="target" :position="Position.Top" class="!bg-neutral-500" />

    <div class="flex items-start gap-2 p-3">
      <div class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-white shadow-sm dark:bg-neutral-800">
        <PaperAirplaneIcon class="h-4 w-4 text-[var(--color-success-text)]" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-success-text)] dark:text-emerald-200">Send</span>
          <span v-if="data.channel" class="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase"
                :class="channelColors[data.channel] || 'bg-neutral-200 text-neutral-700'">{{ data.channel }}</span>
          <span v-if="data.delay_minutes > 0" class="rounded bg-[var(--color-warning-soft)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-warning-text)] dark:bg-amber-900/40 dark:text-amber-200">+{{ data.delay_minutes }}m</span>
        </div>
        <div class="mt-1 truncate font-mono text-xs text-neutral-700 dark:text-neutral-300">
          {{ data.template_key || 'no template' }}
        </div>
      </div>
    </div>

    <Handle type="source" :position="Position.Bottom" class="!bg-neutral-500" />
  </div>
</template>
