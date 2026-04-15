<script setup lang="ts">
// Dropdown panel rendered by AppHeader's bell button. Shows up to 50 recent
// notifications; clicking a row marks it read and (if href) navigates.
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BellIcon } from '@heroicons/vue/24/outline'
import EmptyState from './EmptyState.vue'
import { useNotificationsStore, type Notification } from '@/stores/notifications'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const store = useNotificationsStore()
const router = useRouter()
const panelRoot = ref<HTMLDivElement | null>(null)

const items = computed(() => store.recent(50))

function onClickOutside(e: MouseEvent) {
  if (!props.open) return
  // The bell button sits outside the panel; if the click lands on it we
  // let the parent's toggle fire — so ignore clicks on anything with the
  // data-bell attr. Otherwise any click outside closes.
  const target = e.target as HTMLElement | null
  if (target?.closest('[data-notification-bell]')) return
  if (panelRoot.value && !panelRoot.value.contains(target)) emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside)
  document.removeEventListener('keydown', onKey)
})

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function onRowClick(n: Notification) {
  store.markRead(n.id)
  if (n.href) {
    router.push(n.href).catch(() => { /* swallow nav-duplicate errors */ })
    emit('close')
  }
}

function markAll() {
  store.markAllRead()
}
</script>

<template>
  <div v-if="open" ref="panelRoot" class="np-panel" role="dialog" aria-label="Notifications">
    <header class="np-head">
      <h3 class="np-title">Notifications</h3>
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        :disabled="store.unreadCount === 0"
        @click="markAll"
      >Mark all read</button>
    </header>
    <div class="np-list">
      <template v-if="items.length">
        <button
          v-for="n in items"
          :key="n.id"
          type="button"
          :class="['np-row', `np-row--${n.type}`, !n.read ? 'np-row--unread' : '']"
          @click="onRowClick(n)"
        >
          <span class="np-accent" :data-type="n.type" aria-hidden="true" />
          <span class="np-content">
            <span class="np-row-title">{{ n.title }}</span>
            <span v-if="n.body" class="np-row-body">{{ n.body }}</span>
            <span class="np-row-time">{{ relativeTime(n.createdAt) }}</span>
          </span>
        </button>
      </template>
      <EmptyState v-else :icon="BellIcon" title="No notifications" description="You're all caught up." />
    </div>
  </div>
</template>

<style scoped>
.np-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 360px;
  max-height: 480px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  z-index: var(--z-modal);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.np-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-divider);
}
.np-title {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin: 0;
}
.np-list { overflow-y: auto; flex: 1; padding: 4px; }

.np-row {
  width: 100%;
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.np-row:hover { background: var(--color-bg-subtle); }
.np-row--unread { background: var(--color-bg-subtle); }

.np-accent {
  width: 3px;
  flex-shrink: 0;
  border-radius: 2px;
  align-self: stretch;
}
.np-accent[data-type="success"] { background: var(--color-success); }
.np-accent[data-type="warning"] { background: var(--color-warning); }
.np-accent[data-type="error"]   { background: var(--color-error); }
.np-accent[data-type="info"]    { background: var(--color-info, var(--hks-cyan)); }

.np-content { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.np-row-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}
.np-row-body {
  font-size: 12.5px;
  color: var(--color-text-secondary);
  line-height: 1.4;
}
.np-row-time {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}
</style>
