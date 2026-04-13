// Spec for the campaigns store. We mock @/api/dashboard so the store
// exercises its full state-machine — populate, insert-on-create,
// in-place-update, filter-on-remove, patch-on-toggle — without network.
//
// Each API method the store calls is a discrete spy we can assert on:
// it's not enough to verify state after the fact, we also want to know
// *which* API method fired (and with what args) so regressions in the
// store→api contract fail loudly.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { CampaignDefinition, CampaignRequest } from '@/api/types'

vi.mock('@/api/dashboard', () => ({
  fetchCampaigns: vi.fn(),
  fetchCampaign: vi.fn(),
  createCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
  toggleCampaign: vi.fn(),
}))

import {
  fetchCampaigns,
  fetchCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  toggleCampaign,
} from '@/api/dashboard'
import { useCampaignsStore } from '../campaigns'

const sample = (id: number, name = `C${id}`, active = true): CampaignDefinition => ({
  id,
  name,
  slug: `c-${id}`,
  trigger_event: 'user-signed-up',
  is_active: active,
  steps: [],
  segment_filter: '',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} as unknown as CampaignDefinition)

describe('campaigns store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('load() populates campaigns and toggles loading flag', async () => {
    ;(fetchCampaigns as any).mockResolvedValue([sample(1), sample(2)])
    const store = useCampaignsStore()

    expect(store.loading).toBe(false)
    const p = store.load()
    // loading flips to true synchronously — before the awaited promise resolves.
    expect(store.loading).toBe(true)
    await p

    expect(store.loading).toBe(false)
    expect(store.campaigns).toHaveLength(2)
    expect(store.campaigns[0].id).toBe(1)
    expect(store.error).toBeNull()
  })

  it('load() surfaces axios-style error message into error state', async () => {
    ;(fetchCampaigns as any).mockRejectedValue({
      response: { data: { error: 'server on fire' } },
    })
    const store = useCampaignsStore()
    await store.load()

    expect(store.error).toBe('server on fire')
    expect(store.campaigns).toEqual([])
  })

  it('load() falls back to e.message when response.data.error is absent', async () => {
    ;(fetchCampaigns as any).mockRejectedValue(new Error('network failure'))
    const store = useCampaignsStore()
    await store.load()
    expect(store.error).toBe('network failure')
  })

  it('create() unshifts new campaign at the head of the list', async () => {
    ;(fetchCampaigns as any).mockResolvedValue([sample(2)])
    const created = sample(9, 'Fresh')
    ;(createCampaign as any).mockResolvedValue(created)

    const store = useCampaignsStore()
    await store.load()
    const req = { name: 'Fresh' } as CampaignRequest
    const result = await store.create(req)

    expect(createCampaign).toHaveBeenCalledWith(req)
    expect(result).toBe(created)
    expect(store.campaigns.map((c) => c.id)).toEqual([9, 2])
  })

  it('create() rejects and sets error state on failure without mutating list', async () => {
    ;(fetchCampaigns as any).mockResolvedValue([sample(1)])
    ;(createCampaign as any).mockRejectedValue({ response: { data: { error: 'duplicate slug' } } })

    const store = useCampaignsStore()
    await store.load()
    await expect(store.create({ name: 'x' } as CampaignRequest)).rejects.toBeTruthy()

    expect(store.error).toBe('duplicate slug')
    expect(store.campaigns).toHaveLength(1) // unchanged
  })

  it('update() replaces the matching row in place', async () => {
    ;(fetchCampaigns as any).mockResolvedValue([sample(1, 'old'), sample(2, 'unrelated')])
    const updated = sample(1, 'new')
    ;(updateCampaign as any).mockResolvedValue(updated)

    const store = useCampaignsStore()
    await store.load()
    await store.update(1, { name: 'new' } as CampaignRequest)

    expect(store.campaigns[0].name).toBe('new')
    expect(store.campaigns[1].name).toBe('unrelated')
  })

  it('update() noop when id is not in the list (store created out-of-band)', async () => {
    ;(fetchCampaigns as any).mockResolvedValue([sample(1)])
    const updated = sample(42, 'stranger')
    ;(updateCampaign as any).mockResolvedValue(updated)

    const store = useCampaignsStore()
    await store.load()
    await store.update(42, { name: 'stranger' } as CampaignRequest)

    // Still only the originally loaded row — update is in-place only, doesn't
    // push new rows. That behaviour is correct (other tabs load() themselves)
    // but worth pinning so nobody "fixes" it by also pushing.
    expect(store.campaigns).toHaveLength(1)
    expect(store.campaigns[0].id).toBe(1)
  })

  it('remove() filters the row out on success', async () => {
    ;(fetchCampaigns as any).mockResolvedValue([sample(1), sample(2), sample(3)])
    ;(deleteCampaign as any).mockResolvedValue(undefined)

    const store = useCampaignsStore()
    await store.load()
    await store.remove(2)

    expect(deleteCampaign).toHaveBeenCalledWith(2)
    expect(store.campaigns.map((c) => c.id)).toEqual([1, 3])
  })

  it('remove() leaves list intact when API rejects', async () => {
    ;(fetchCampaigns as any).mockResolvedValue([sample(1)])
    ;(deleteCampaign as any).mockRejectedValue(new Error('permission denied'))

    const store = useCampaignsStore()
    await store.load()
    await expect(store.remove(1)).rejects.toBeTruthy()

    expect(store.campaigns).toHaveLength(1)
    expect(store.error).toBe('permission denied')
  })

  it('toggle() patches is_active on the matching row', async () => {
    ;(fetchCampaigns as any).mockResolvedValue([sample(1, 'C', true)])
    ;(toggleCampaign as any).mockResolvedValue({ is_active: false })

    const store = useCampaignsStore()
    await store.load()
    const result = await store.toggle(1)

    expect(result).toEqual({ is_active: false })
    expect(store.campaigns[0].is_active).toBe(false)
  })

  it('get() returns single fetched campaign and does not mutate list', async () => {
    ;(fetchCampaign as any).mockResolvedValue(sample(7, 'detail'))
    const store = useCampaignsStore()
    const result = await store.get(7)

    expect(fetchCampaign).toHaveBeenCalledWith(7)
    expect(result.id).toBe(7)
    expect(store.campaigns).toEqual([]) // get() is read-through, never writes state
  })

  it('$reset() clears list + flags for logout / test isolation', async () => {
    ;(fetchCampaigns as any).mockResolvedValue([sample(1), sample(2)])
    const store = useCampaignsStore()
    await store.load()
    expect(store.campaigns).toHaveLength(2)

    store.$reset()
    expect(store.campaigns).toEqual([])
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })
})
