import { ref, onUnmounted } from 'vue'

export interface SSEEvent {
  type: string
  payload: any
}

export function useSSE(url: string, onError?: () => void) {
  const connected = ref(false)
  const lastEvent = ref<SSEEvent | null>(null)
  let eventSource: EventSource | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  const listeners: Array<(evt: SSEEvent) => void> = []

  function connect() {
    if (eventSource) {
      eventSource.close()
    }

    eventSource = new EventSource(url)

    eventSource.onopen = () => {
      connected.value = true
    }

    eventSource.onmessage = (event) => {
      try {
        const parsed: SSEEvent = JSON.parse(event.data)
        lastEvent.value = parsed
        listeners.forEach((fn) => fn(parsed))
      } catch {
        // ignore parse errors
      }
    }

    eventSource.onerror = () => {
      connected.value = false
      eventSource?.close()
      if (onError) {
        onError()
      } else {
        // Default auto-reconnect after 5 seconds
        reconnectTimer = setTimeout(connect, 5000)
      }
    }
  }

  function onEvent(fn: (evt: SSEEvent) => void) {
    listeners.push(fn)
  }

  function disconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    eventSource?.close()
    eventSource = null
    connected.value = false
  }

  onUnmounted(disconnect)

  // Start connection
  connect()

  return { connected, lastEvent, onEvent, disconnect }
}
