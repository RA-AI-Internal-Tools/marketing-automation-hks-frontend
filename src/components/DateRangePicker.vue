<script setup lang="ts">
import { computed } from 'vue'
import { useAnalyticsStore, type DatePreset } from '@/stores/analytics'

const store = useAnalyticsStore()

const presets: { label: string; value: DatePreset }[] = [
  { label: '7 days', value: 'last7days' },
  { label: '30 days', value: 'last30days' },
  { label: '90 days', value: 'last90days' },
]

const sinceDate = computed({
  get: () => store.since.slice(0, 10),
  set: (val: string) => store.setCustomRange(new Date(val).toISOString(), store.until),
})

const untilDate = computed({
  get: () => store.until.slice(0, 10),
  set: (val: string) => store.setCustomRange(store.since, new Date(val + 'T23:59:59').toISOString()),
})
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap">
    <button
      v-for="p in presets"
      :key="p.value"
      @click="store.setPreset(p.value)"
      :class="[
        'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
        store.preset === p.value
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50',
      ]"
    >
      {{ p.label }}
    </button>
    <div class="flex items-center gap-1.5 text-xs text-gray-500">
      <input
        type="date"
        :value="sinceDate"
        @input="sinceDate = ($event.target as HTMLInputElement).value"
        class="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <span>to</span>
      <input
        type="date"
        :value="untilDate"
        @input="untilDate = ($event.target as HTMLInputElement).value"
        class="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  </div>
</template>
