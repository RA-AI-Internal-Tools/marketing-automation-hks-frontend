import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { OverviewStats, CampaignLog, CampaignEnrollment } from '@/api/types'
import { fetchOverviewStats } from '@/api/dashboard'
import { useSSE, type SSEEvent } from '@/composables/useSSE'
import api from '@/api/client'
import { STORAGE_KEYS } from '@/constants/storage'

export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref<OverviewStats | null>(null)
  const recentLogs = ref<CampaignLog[]>([])
  const recentEnrollments = ref<CampaignEnrollment[]>([])
  const sseConnected = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  let sseCleanup: (() => void) | null = null

  async function loadStats() {
    loading.value = true
    error.value = null
    try {
      stats.value = await fetchOverviewStats()
    } catch (e: any) {
      error.value = e.response?.data?.error || e.message || 'Failed to load stats'
    } finally {
      loading.value = false
    }
  }

  async function startSSE() {
    // Prevent duplicate SSE connections
    if (sseCleanup) return

    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
    if (!token) return

    const MAX_RETRIES = 5
    const BACKOFF_MS = 2000
    let reconnectAttempts = 0
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let currentDisconnect: (() => void) | null = null
    let stopped = false

    function handleSSEError() {
      sseConnected.value = false
      currentDisconnect?.()
      currentDisconnect = null

      if (!stopped && reconnectAttempts < MAX_RETRIES) {
        reconnectAttempts++
        reconnectTimer = setTimeout(connectWithFreshToken, BACKOFF_MS)
      }
    }

    async function connectWithFreshToken() {
      if (stopped) return

      const authToken = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
      if (!authToken) return

      let sseToken: string
      try {
        const { data } = await api.post('/api/sse/token')
        sseToken = data.token
      } catch {
        return
      }

      if (stopped) return

      const baseUrl = import.meta.env.VITE_API_URL || ''
      const { connected, onEvent, disconnect } = useSSE(
        `${baseUrl}/api/sse?token=${encodeURIComponent(sseToken)}`,
        handleSSEError,
      )

      currentDisconnect = disconnect
      sseConnected.value = connected.value

      onEvent((evt: SSEEvent) => {
        reconnectAttempts = 0
        sseConnected.value = true
        if (evt.type === 'log_created') {
          recentLogs.value.unshift(evt.payload)
          if (recentLogs.value.length > 50) recentLogs.value.pop()
        } else if (evt.type === 'enrollment_created' || evt.type === 'enrollment_updated') {
          recentEnrollments.value.unshift(evt.payload)
          if (recentEnrollments.value.length > 50) recentEnrollments.value.pop()
        }
      })
    }

    sseCleanup = () => {
      stopped = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      currentDisconnect?.()
      currentDisconnect = null
    }

    await connectWithFreshToken()
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
    error,
    hasStats,
    loadStats,
    startSSE,
    stopSSE,
    $reset,
  }
})
