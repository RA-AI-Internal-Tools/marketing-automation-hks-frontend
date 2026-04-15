import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useNotificationsStore } from '../notifications'

describe('notifications store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('push adds a notification and increments unreadCount', () => {
    const s = useNotificationsStore()
    expect(s.unreadCount).toBe(0)
    s.push({ type: 'info', title: 'Hello' })
    expect(s.items.length).toBe(1)
    expect(s.unreadCount).toBe(1)
    expect(s.items[0].id).toBeTruthy()
    expect(s.items[0].read).toBe(false)
  })

  it('markRead flips only the matching item', () => {
    const s = useNotificationsStore()
    const a = s.push({ type: 'info', title: 'A' })
    const b = s.push({ type: 'warning', title: 'B' })
    s.markRead(a.id)
    expect(s.unreadCount).toBe(1)
    expect(s.items.find((x) => x.id === a.id)!.read).toBe(true)
    expect(s.items.find((x) => x.id === b.id)!.read).toBe(false)
  })

  it('markAllRead clears unreadCount', () => {
    const s = useNotificationsStore()
    s.push({ type: 'info', title: '1' })
    s.push({ type: 'error', title: '2' })
    s.markAllRead()
    expect(s.unreadCount).toBe(0)
  })

  it('recent() returns most-recent-first, capped at the requested limit', () => {
    const s = useNotificationsStore()
    for (let i = 0; i < 10; i++) s.push({ type: 'info', title: `N${i}` })
    const r = s.recent(5)
    expect(r.length).toBe(5)
    // Newest first — the last push's title should lead.
    expect(r[0].title).toBe('N9')
  })

  it('ingestSseEvent maps campaign_completed to a success notification', () => {
    const s = useNotificationsStore()
    s.ingestSseEvent({ type: 'campaign_completed', payload: { id: 42, name: 'Spring' } })
    expect(s.items[0].type).toBe('success')
    expect(s.items[0].href).toBe('/campaigns/42')
  })
})
