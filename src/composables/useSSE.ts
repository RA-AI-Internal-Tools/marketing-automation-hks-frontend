import { ref, onUnmounted, getCurrentInstance } from 'vue'

export interface SSEEvent {
  type: string
  payload: any
}

export function useSSE(url: string, onError?: () => void) {
  const connected = ref(false)
  const lastEvent = ref<SSEEvent | null>(null)
  let eventSource: EventSource | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let disposed = false
  const listeners: Array<(evt: SSEEvent) => void> = []

  // Exponential backoff with ±25% jitter. Fixed 5s was OK for a single
  // client, but mass-reconnect after a deploy would thunder-herd the
  // /api/sse/token endpoint. Resets to 1s on every successful onopen so
  // a brief transient doesn't poison the backoff for the whole session.
  const INITIAL_MS = 1_000
  const MAX_MS = 30_000
  let attempt = 0

  function nextBackoffMs(): number {
    const base = Math.min(INITIAL_MS * 2 ** attempt, MAX_MS)
    const jitter = base * (0.75 + Math.random() * 0.5) // [0.75×, 1.25×]
    attempt++
    return Math.round(jitter)
  }

  function connect() {
    if (eventSource) {
      eventSource.close()
    }

    eventSource = new EventSource(url)

    eventSource.onopen = () => {
      connected.value = true
      attempt = 0 // successful connect — reset backoff for next disconnect
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
      // Don't reconnect if the caller already tore us down — disconnect()
      // closing the EventSource fires one last onerror, which would
      // otherwise schedule a zombie reconnect.
      if (disposed) return
      if (onError) {
        onError()
      } else {
        // Default auto-reconnect with exponential backoff + jitter.
        reconnectTimer = setTimeout(connect, nextBackoffMs())
      }
    }
  }

  function onEvent(fn: (evt: SSEEvent) => void) {
    listeners.push(fn)
  }

  function disconnect() {
    disposed = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    eventSource?.close()
    eventSource = null
    connected.value = false
  }

  // Only register the lifecycle hook when we're inside a component setup.
  // useSSE can be invoked from a Pinia action where no component instance
  // exists; calling onUnmounted there logs a noisy Vue warning.
  if (getCurrentInstance()) {
    onUnmounted(disconnect)
  }

  // Start connection
  connect()

  return { connected, lastEvent, onEvent, disconnect }
}
