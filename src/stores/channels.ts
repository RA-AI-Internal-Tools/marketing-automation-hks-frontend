import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChannelStats } from '@/api/types'
import { fetchChannelStats } from '@/api/dashboard'

export const useChannelsStore = defineStore('channels', () => {
  const stats = ref<ChannelStats[]>([])
  const loading = ref(false)

  async function load(since?: string) {
    loading.value = true
    try {
      stats.value = await fetchChannelStats(since)
    } finally {
      loading.value = false
    }
  }

  return { stats, loading, load }
})
