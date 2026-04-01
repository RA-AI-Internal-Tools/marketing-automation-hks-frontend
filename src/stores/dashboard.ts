import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { OverviewStats, CampaignLog, CampaignEnrollment } from '@/api/types'
import { fetchOverviewStats } from '@/api/dashboard'
import { useSSE, type SSEEvent } from '@/composables/useSSE'

export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref<OverviewStats | null>(null)
  const recentLogs = ref<CampaignLog[]>([])
  const recentEnrollments = ref<CampaignEnrollment[]>([])
  const sseConnected = ref(false)
  const loading = ref(false)

  let sseCleanup: (() => void) | null = null

  async function loadStats() {
    loading.value = true
    try {
      stats.value = await fetchOverviewStats()
    } finally {
      loading.value = false
    }
  }

  function startSSE() {
    // Prevent duplicate SSE connections
    if (sseCleanup) return

    const token = localStorage.getItem('ma_auth_token')
    if (!token) return

    const baseUrl = import.meta.env.VITE_API_URL || ''
    const { connected, onEvent, disconnect } = useSSE(
      `${baseUrl}/api/sse?token=${encodeURIComponent(token)}`,
    )

    sseConnected.value = connected.value

    onEvent((evt: SSEEvent) => {
      sseConnected.value = true
      if (evt.type === 'log_created') {
        recentLogs.value.unshift(evt.payload)
        if (recentLogs.value.length > 50) recentLogs.value.pop()
      } else if (evt.type === 'enrollment_created' || evt.type === 'enrollment_updated') {
        recentEnrollments.value.unshift(evt.payload)
        if (recentEnrollments.value.length > 50) recentEnrollments.value.pop()
      }
    })

    sseCleanup = disconnect
  }

  function stopSSE() {
    sseCleanup?.()
    sseCleanup = null
    sseConnected.value = false
  }

  function $reset() {
    stopSSE()
    stats.value = null
    recentLogs.value = []
    recentEnrollments.value = []
    loading.value = false
  }

  const hasStats = computed(() => stats.value !== null)

  return {
    stats,
    recentLogs,
    recentEnrollments,
    sseConnected,
    loading,
    hasStats,
    loadStats,
    startSSE,
    stopSSE,
    $reset,
  }
})
