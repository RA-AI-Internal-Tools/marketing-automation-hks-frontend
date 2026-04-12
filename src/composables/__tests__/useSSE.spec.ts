import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSSE } from '../useSSE'

/**
 * Vitest's happy-dom environment doesn't ship EventSource. We mock the
 * minimum surface the composable touches (onopen, onmessage, onerror,
 * close) and expose the mock instance so individual tests can drive it.
 */
class MockEventSource {
  static last: MockEventSource | null = null
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  url: string
  constructor(url: string) {
    this.url = url
    MockEventSource.last = this
  }
  close() { this.closed = true }
  _open()     { this.onopen?.() }
  _message(d: any) { this.onmessage?.({ data: JSON.stringify(d) }) }
  _error()    { this.onerror?.() }
}

beforeEach(() => {
  vi.stubGlobal('EventSource', MockEventSource)
  MockEventSource.last = null
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useSSE', () => {
  it('opens connection on mount and flips connected true on onopen', () => {
    const sse = useSSE('/api/sse?token=abc')
    expect(sse.connected.value).toBe(false)
    expect(MockEventSource.last?.url).toBe('/api/sse?token=abc')
    MockEventSource.last!._open()
    expect(sse.connected.value).toBe(true)
  })

  it('parses JSON messages and fans out to registered listeners', () => {
    const sse = useSSE('/api/sse')
    const received: any[] = []
    sse.onEvent((e) => received.push(e))
    MockEventSource.last!._message({ type: 'log_created', payload: { id: 1 } })
    expect(received).toEqual([{ type: 'log_created', payload: { id: 1 } }])
    expect(sse.lastEvent.value).toEqual({ type: 'log_created', payload: { id: 1 } })
  })

  it('swallows parse errors on malformed data', () => {
    const sse = useSSE('/api/sse')
    const received: any[] = []
    sse.onEvent((e) => received.push(e))
    // simulate a bad payload by calling onmessage directly with non-JSON
    MockEventSource.last!.onmessage?.({ data: 'not{valid' } as any)
    expect(received).toEqual([])  // listener never invoked
  })

  it('reconnects with exponential backoff on error (default path)', () => {
    useSSE('/api/sse')
    const first = MockEventSource.last
    first!._error()

    // First retry window: 1s * [0.75, 1.25] → advance 1300ms to be safe.
    vi.advanceTimersByTime(1_300)
    const second = MockEventSource.last
    expect(second).not.toBe(first)  // new EventSource instance
    expect(first!.closed).toBe(true)
  })

  it('backoff grows between consecutive failures', () => {
    useSSE('/api/sse')
    const attempts: MockEventSource[] = []

    // 3 consecutive failures without any successful onopen in between.
    for (let i = 0; i < 3; i++) {
      const current = MockEventSource.last!
      attempts.push(current)
      current._error()
      // Advance way past the expected backoff upper bound for this attempt.
      vi.advanceTimersByTime(40_000)
    }
    // 3 distinct instances = 3 reconnects actually fired.
    expect(new Set(attempts).size).toBe(3)
  })

  it('disconnect() stops further reconnects', () => {
    const sse = useSSE('/api/sse')
    const first = MockEventSource.last!
    sse.disconnect()
    expect(first.closed).toBe(true)
    first._error()  // error after disconnect — should NOT spawn a new ES
    vi.advanceTimersByTime(40_000)
    expect(MockEventSource.last).toBe(first)  // unchanged
  })
})
