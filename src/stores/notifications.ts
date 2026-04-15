import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// Session-only notification center. Persists across route changes but not
// across full reloads — we'd rather show nothing than show stale alerts
// from a previous session. Backed by a ref<Notification[]> for simplicity;
// if volume grows past a few hundred we should swap to a bounded ring buffer.

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  body?: string
  href?: string
  createdAt: string
  read: boolean
}

// Crypto-strong enough for DOM keys; these never leave the client.
function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'n_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<Notification[]>([])

  const unreadCount = computed(() => items.value.filter((n) => !n.read).length)

  function recent(limit = 50): Notification[] {
    return items.value.slice(0, limit)
  }

  function push(
    n: Omit<Notification, 'id' | 'createdAt' | 'read'> & { id?: string; createdAt?: string; read?: boolean },
  ): Notification {
    const full: Notification = {
      id: n.id ?? uuid(),
      type: n.type,
      title: n.title,
      body: n.body,
      href: n.href,
      createdAt: n.createdAt ?? new Date().toISOString(),
      read: n.read ?? false,
    }
    items.value.unshift(full)
    // Cap memory: operators almost never scroll past 50; keep a buffer of 100.
    if (items.value.length > 100) items.value.length = 100
    return full
  }

  function markRead(id: string) {
    const n = items.value.find((x) => x.id === id)
    if (n) n.read = true
  }

  function markAllRead() {
    for (const n of items.value) n.read = true
  }

  function clear() {
    items.value = []
  }

  // TODO(sse): subscribe to backend 'notification' events here once the
  // backend emits them. For now callers push directly via useNotifications().
  // grep-tag: NOTIFICATIONS_SSE_WIRING
  function ingestSseEvent(evt: { type: string; payload: any }) {
    if (!evt) return
    switch (evt.type) {
      case 'notification':
        push({
          type: (evt.payload?.type as NotificationType) || 'info',
          title: evt.payload?.title || 'Notification',
          body: evt.payload?.body,
          href: evt.payload?.href,
        })
        break
      case 'campaign_completed':
        push({
          type: 'success',
          title: 'Campaign completed',
          body: evt.payload?.name ? `“${evt.payload.name}” finished.` : undefined,
          href: evt.payload?.id ? `/campaigns/${evt.payload.id}` : undefined,
        })
        break
      case 'broadcast_completed':
        push({
          type: 'success',
          title: 'Broadcast completed',
          body: evt.payload?.name ? `“${evt.payload.name}” finished.` : undefined,
          href: '/broadcasts',
        })
        break
      case 'error_alert':
        push({
          type: 'error',
          title: evt.payload?.title || 'Error',
          body: evt.payload?.message,
        })
        break
    }
  }

  return {
    items,
    unreadCount,
    recent,
    push,
    markRead,
    markAllRead,
    clear,
    ingestSseEvent,
  }
})

// Convenience helper so callers don't need to import the store constructor.
export function useNotifications() {
  return useNotificationsStore()
}
