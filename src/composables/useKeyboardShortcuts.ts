import { onMounted, onBeforeUnmount, reactive } from 'vue'

// Thin wrapper over `keydown` that:
//   - ignores typing inside input/textarea/contenteditable so users keep
//     the ability to type 'n' in a text field without triggering "new"
//   - ignores when any modal (`[role=dialog]`) is visible, except for
//     the global `?` help modal which needs to work everywhere
//   - tracks registrations globally so the cheat sheet can enumerate
//     every active shortcut across mounted pages
//
// Register at `onMounted` inside a page; cleanup on `onBeforeUnmount`
// is handled automatically.

export type Handler = () => void

export interface Shortcut {
  key: string
  handler: Handler
  description: string
  global?: boolean
}

// Registry shared across the app — reactive so ShortcutCheatSheet can
// render it live (e.g. if a user navigates mid-open, the list refreshes).
export const shortcutRegistry = reactive<{ list: Shortcut[] }>({ list: [] })

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

function isModalOpen(): boolean {
  if (typeof document === 'undefined') return false
  // Any role=dialog that isn't the cheat sheet itself. The cheat sheet
  // sets data-shortcut-root so we can tell them apart.
  const dialogs = document.querySelectorAll('[role="dialog"]')
  for (const d of Array.from(dialogs)) {
    if ((d as HTMLElement).dataset.shortcutRoot === 'true') continue
    // visible check — a closed v-if dialog won't be in the DOM at all,
    // but a hidden-via-display one might. Inspect computed style.
    const style = window.getComputedStyle(d as HTMLElement)
    if (style.display !== 'none' && style.visibility !== 'hidden') return true
  }
  return false
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  function handle(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (isEditableTarget(e.target)) return
    for (const s of shortcuts) {
      if (e.key !== s.key) continue
      if (!s.global && isModalOpen()) continue
      e.preventDefault()
      s.handler()
      return
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handle)
    for (const s of shortcuts) shortcutRegistry.list.push(s)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handle)
    for (const s of shortcuts) {
      const i = shortcutRegistry.list.indexOf(s)
      if (i >= 0) shortcutRegistry.list.splice(i, 1)
    }
  })
}
