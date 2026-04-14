import { ref, type Ref } from 'vue'

/**
 * useCachedFetch — memo fetcher with TTL + in-flight de-dup.
 *
 * The admin panel's analytics + dashboard pages re-fetch from scratch on
 * every visit. That's correct for staleness but wasteful when the user is
 * bouncing between tabs in under a minute — the same Tracardi query fires
 * repeatedly at 4-5s each. This composable memos by a caller-chosen key,
 * expires after ttlMs, and coalesces concurrent calls while one is in
 * flight (second caller gets the first caller's promise, not a new fetch).
 *
 * Usage:
 *   const { data, loading, load, invalidate } = useCachedFetch(
 *     'analytics:executive',
 *     () => fetchExecutive(),
 *     60_000,
 *   )
 *   onMounted(load)
 *   // on user-initiated refresh:
 *   load(true)    // force bypass cache
 *   // after a mutation that invalidates:
 *   invalidate()
 *
 * Global cache map is module-scoped so two components reading the same key
 * share one entry. Not persisted across page reloads — this is an
 * in-memory hot path, not a service worker. For cross-tab sync, point
 * both tabs at the same useCachedFetch key and invalidate via a shared
 * event (BroadcastChannel, storage event) — out of scope here.
 */

interface CacheEntry<T> {
  data?:     T
  expiry:    number
  inflight?: Promise<T>
}

const cache = new Map<string, CacheEntry<any>>()

export interface UseCachedFetchReturn<T> {
  data:       Ref<T | null>
  loading:    Ref<boolean>
  error:      Ref<string | null>
  load:       (force?: boolean) => Promise<void>
  invalidate: () => void
}

export type CacheKey = string | (() => string)

export function useCachedFetch<T>(
  key: CacheKey,
  fetcher: () => Promise<T>,
  ttlMs = 60_000,
): UseCachedFetchReturn<T> {
  const data    = ref<T | null>(null) as Ref<T | null>
  const loading = ref(false)
  const error   = ref<string | null>(null)

  const resolveKey = (): string => (typeof key === 'function' ? key() : key)

  async function load(force = false): Promise<void> {
    const now = Date.now()
    const k = resolveKey()
    const entry = cache.get(k)

    // Hot path: cached value still fresh.
    if (!force && entry?.data !== undefined && entry.expiry > now) {
      data.value = entry.data
      return
    }

    // Another caller is already fetching — piggyback on their promise.
    // This is the concurrency coalesce; prevents two components mounting
    // at the same time from double-fetching.
    if (!force && entry?.inflight) {
      loading.value = true
      try {
        data.value = await entry.inflight
      } catch (e: any) {
        error.value = e?.response?.data?.error || e?.message || 'Fetch failed'
      } finally {
        loading.value = false
      }
      return
    }

    loading.value = true
    error.value = null
    const inflight = fetcher()
    cache.set(k, { expiry: now + ttlMs, inflight })
    try {
      const result = await inflight
      data.value = result
      cache.set(k, { data: result, expiry: Date.now() + ttlMs })
    } catch (e: any) {
      cache.delete(k) // don't cache a failure
      error.value = e?.response?.data?.error || e?.message || 'Fetch failed'
    } finally {
      loading.value = false
    }
  }

  function invalidate() {
    cache.delete(resolveKey())
  }

  return { data, loading, error, load, invalidate }
}

// Exposed for tests + dev-tools: clear everything.
export function clearAllCache() {
  cache.clear()
}
