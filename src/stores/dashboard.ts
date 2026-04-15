import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { OverviewStats, CampaignLog, CampaignEnrollment } from '@/api/types'
import { fetchOverviewStats } from '@/api/dashboard'
import { useSSE, type SSEEvent } from '@/composables/useSSE'
import { useNotificationsStore } from '@/stores/notifications'
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

    // Presence check — JWT moved to HTTP-only cookie, so we gate on the
    // non-sensitive email marker that mirrors login state in localStorage.
    if (!localStorage.getItem(STORAGE_KEYS.AUTH_EMAIL)) return

    // Reconnect forever with exponential backoff capped at 30s. Giving up
    // (old code: after 5 tries) leaves the dashboard permanently "offline"
    // the first time someone closes their laptop lid over lunch. The cost
    // of polling every 30s is trivial; the cost of thinking the dashboard
    // is broken isn't.
    const BACKOFF_INITIAL_MS = 1000
    const BACKOFF_MAX_MS     = 30_000
    let reconnectAttempts = 0
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let currentDisconnect: (() => void) | null = null
    let stopCurrentWatch: (() => void) | null = null
    let stopped = false

    function nextBackoff(): number {
      const exp = BACKOFF_INITIAL_MS * 2 ** Math.min(reconnectAttempts, 5)
      const capped = Math.min(exp, BACKOFF_MAX_MS)
      // ±20% jitter to stop a herd of clients hammering after a deploy
      return Math.max(250, capped * (0.8 + Math.random() * 0.4))
    }

    function handleSSEError() {
      sseConnected.value = false
      currentDisconnect?.()
      currentDisconnect = null

      if (!stopped) {
        reconnectAttempts++
        reconnectTimer = setTimeout(connectWithFreshToken, nextBackoff())
      }
    }

    async function connectWithFreshToken() {
      if (stopped) return

      if (!localStorage.getItem(STORAGE_KEYS.AUTH_EMAIL)) return

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

      stopCurrentWatch?.()
      stopCurrentWatch = watch(connected, (val) => {
        sseConnected.value = val
      }, { immediate: true })

      const notifications = useNotificationsStore()

      onEvent((evt: SSEEvent) => {
        reconnectAttempts = 0
        if (evt.type === 'log_created') {
          recentLogs.value.unshift(evt.payload)
          if (recentLogs.value.length > 50) recentLogs.value.pop()
        } else if (evt.type === 'enrollment_created' || evt.type === 'enrollment_updated') {
          recentEnrollments.value.unshift(evt.payload)
          if (recentEnrollments.value.length > 50) recentEnrollments.value.pop()
        }
        // Fan-out: forward every event to the notifications store. Its
        // mapper internally filters to {notification, campaign_completed,
        // broadcast_completed, error_alert}; other types are ignored.
        notifications.ingestSseEvent(evt)
      })
    }

    sseCleanup = () => {
      stopped = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      stopCurrentWatch?.()
      stopCurrentWatch = null
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
