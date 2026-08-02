// Spec for the reports store.
//
// The load() path previously used a bare try/finally with no catch, so a
// rejected fetch escaped as an unhandled promise rejection and left
// `reports` empty — which ReportsPage rendered as "No report schedules
// configured". These tests pin the distinction that matters: a failed load
// must set `error`, and must not be mistakable for an empty result.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { ReportSchedule } from '@/api/types'

vi.mock('@/api/reports', () => ({
  fetchReports: vi.fn(),
  createReport: vi.fn(),
  updateReport: vi.fn(),
  deleteReport: vi.fn(),
}))

import { fetchReports, createReport, deleteReport } from '@/api/reports'
import { useReportsStore } from '../reports'

const sample = (id: number, name = `R${id}`): ReportSchedule => ({
  id,
  name,
  schedule: 'daily',
  modules: ['executive'],
  recipients: ['ops@example.com'],
  format: 'email',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
})

describe('reports store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('load() populates reports and toggles loading flag', async () => {
    ;(fetchReports as any).mockResolvedValue([sample(1), sample(2)])
    const store = useReportsStore()

    expect(store.loading).toBe(false)
    const p = store.load()
    expect(store.loading).toBe(true)
    await p

    expect(store.loading).toBe(false)
    expect(store.reports).toHaveLength(2)
    expect(store.error).toBeNull()
  })

  it('load() does NOT reject when the API fails — it captures the error', async () => {
    // The regression: with try/finally and no catch this rejected, producing
    // an unhandled rejection at every call site (onMounted has no .catch).
    ;(fetchReports as any).mockRejectedValue({
      response: { data: { error: 'reports service unavailable' } },
    })
    const store = useReportsStore()

    await expect(store.load()).resolves.toBeUndefined()
    expect(store.error).toBe('reports service unavailable')
    expect(store.loading).toBe(false)
  })

  it('load() falls back to e.message when response.data.error is absent', async () => {
    ;(fetchReports as any).mockRejectedValue(new Error('network down'))
    const store = useReportsStore()
    await store.load()
    expect(store.error).toBe('network down')
  })

  it('load() falls back to a generic message when the rejection is opaque', async () => {
    ;(fetchReports as any).mockRejectedValue({})
    const store = useReportsStore()
    await store.load()
    expect(store.error).toBe('Failed to load reports')
  })

  it('a failed load is distinguishable from an empty result', async () => {
    // Both leave `reports` empty. Only `error` tells them apart, and that is
    // exactly what the page needs to avoid rendering "No report schedules
    // configured" when the backend is simply unreachable.
    ;(fetchReports as any).mockResolvedValue([])
    const okStore = useReportsStore()
    await okStore.load()
    expect(okStore.reports).toEqual([])
    expect(okStore.error).toBeNull()

    setActivePinia(createPinia())
    ;(fetchReports as any).mockRejectedValue(new Error('boom'))
    const failStore = useReportsStore()
    await failStore.load()
    expect(failStore.reports).toEqual([])
    expect(failStore.error).toBe('boom')
  })

  it('load() clears a stale error on a subsequent successful load', async () => {
    ;(fetchReports as any).mockRejectedValue(new Error('transient'))
    const store = useReportsStore()
    await store.load()
    expect(store.error).toBe('transient')

    ;(fetchReports as any).mockResolvedValue([sample(1)])
    await store.load()
    expect(store.error).toBeNull()
    expect(store.reports).toHaveLength(1)
  })

  it('create() unshifts the new report at the head of the list', async () => {
    ;(fetchReports as any).mockResolvedValue([sample(2)])
    const created = sample(9, 'Fresh')
    ;(createReport as any).mockResolvedValue(created)

    const store = useReportsStore()
    await store.load()
    const result = await store.create({ name: 'Fresh' } as any)

    expect(result).toBe(created)
    expect(store.reports.map((r) => r.id)).toEqual([9, 2])
  })

  it('remove() filters the row out on success', async () => {
    ;(fetchReports as any).mockResolvedValue([sample(1), sample(2)])
    ;(deleteReport as any).mockResolvedValue(undefined)

    const store = useReportsStore()
    await store.load()
    await store.remove(1)

    expect(deleteReport).toHaveBeenCalledWith(1)
    expect(store.reports.map((r) => r.id)).toEqual([2])
  })

  it('$reset() clears list + flags + error', async () => {
    ;(fetchReports as any).mockRejectedValue(new Error('boom'))
    const store = useReportsStore()
    await store.load()
    expect(store.error).toBe('boom')

    store.$reset()
    expect(store.reports).toEqual([])
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })
})
