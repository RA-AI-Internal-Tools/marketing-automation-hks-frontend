import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type DatePreset = 'last7days' | 'last30days' | 'last90days' | 'custom'

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

export const useAnalyticsStore = defineStore('analytics', () => {
  const preset = ref<DatePreset>('last30days')
  const since = ref<string>(daysAgo(30))
  const until = ref<string>(new Date().toISOString())

  function setPreset(p: DatePreset) {
    preset.value = p
    until.value = new Date().toISOString()
    switch (p) {
      case 'last7days':
        since.value = daysAgo(7)
        break
      case 'last30days':
        since.value = daysAgo(30)
        break
      case 'last90days':
        since.value = daysAgo(90)
        break
    }
  }

  function setCustomRange(newSince: string, newUntil: string) {
    preset.value = 'custom'
    since.value = newSince
    until.value = newUntil
  }

  const queryParams = computed(() => ({
    since: since.value,
    until: until.value,
  }))

  return {
    preset,
    since,
    until,
    setPreset,
    setCustomRange,
    queryParams,
  }
})
