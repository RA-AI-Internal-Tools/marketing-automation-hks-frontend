import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCachedFetch, clearAllCache } from '../useCache'

describe('useCachedFetch', () => {
  beforeEach(() => {
    clearAllCache()
    vi.useRealTimers()
  })

  it('fetches on first load, then serves cached value', async () => {
    const fetcher = vi.fn(() => Promise.resolve({ n: 42 }))
    const { data, load } = useCachedFetch('test:a', fetcher, 60_000)

    await load()
    expect(data.value).toEqual({ n: 42 })
    expect(fetcher).toHaveBeenCalledTimes(1)

    await load()  // cached
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('force=true bypasses cache', async () => {
    const fetcher = vi.fn(() => Promise.resolve('x'))
    const { load } = useCachedFetch('test:b', fetcher, 60_000)
    await load()
    await load(true)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('coalesces concurrent loads into a single fetch', async () => {
    let resolveFn!: (v: string) => void
    const fetcher = vi.fn(() => new Promise<string>(r => { resolveFn = r }))
    const a = useCachedFetch('test:c', fetcher, 60_000)
    const b = useCachedFetch('test:c', fetcher, 60_000)

    const p1 = a.load()
    const p2 = b.load()  // must piggyback, not fire a second fetch
    resolveFn('shared')
    await Promise.all([p1, p2])

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(a.data.value).toBe('shared')
    expect(b.data.value).toBe('shared')
  })

  it('invalidate() forces next load to refetch', async () => {
    const fetcher = vi.fn(() => Promise.resolve('v1'))
    const { load, invalidate } = useCachedFetch('test:d', fetcher, 60_000)
    await load()
    invalidate()
    await load()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('TTL expiry triggers refetch', async () => {
    const fetcher = vi.fn(() => Promise.resolve('v'))
    const { load } = useCachedFetch('test:e', fetcher, 10)
    await load()
    await new Promise(r => setTimeout(r, 15))
    await load()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('does not cache a rejected fetch', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue('ok')
    const { load, data, error } = useCachedFetch('test:f', fetcher, 60_000)

    await load()
    expect(error.value).toBe('boom')
    expect(data.value).toBeNull()

    // Second load must actually call fetcher again (not return cached failure).
    await load()
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(data.value).toBe('ok')
  })

  it('sets loading true during fetch, false after', async () => {
    let resolveFn!: (v: string) => void
    const fetcher = vi.fn(() => new Promise<string>(r => { resolveFn = r }))
    const { load, loading } = useCachedFetch('test:g', fetcher, 60_000)

    expect(loading.value).toBe(false)
    const p = load()
    expect(loading.value).toBe(true)
    resolveFn('done')
    await p
    expect(loading.value).toBe(false)
  })
})
