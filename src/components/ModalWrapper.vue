<script setup lang="ts">
// Shared shell for center-positioned form modals. Replaces the bespoke
// `<Teleport> + backdrop + card` pattern that lived inside TestSendModal,
// BroadcastsPage's edit modal, SegmentsPage's edit modal, etc. Keep the
// ConfirmDialog separate — it's specialised for yes/no flows.
//
// Slots:
//   #body          (required) main content
//   #footer        (optional) action row, typically right-aligned buttons
//   #header-extra  (optional) chip/action rendered to the right of the title
//
// Behaviour:
//   - Teleport to body so the modal escapes transformed/overflow-hidden parents
//   - Backdrop click (configurable) + Escape (configurable) close
//   - Tab / Shift-Tab focus trap (borrowed from ConfirmDialog)
//   - Restores focus to the previously focused element on close
//   - Locks body scroll while open
//   - Scale(0.96) → scale(1) + opacity transition, matches ConfirmDialog
import { ref, watch, onBeforeUnmount, onMounted, nextTick, computed } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'

interface Props {
  modelValue: boolean
  title: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  danger?: boolean
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  danger: false,
  closeOnBackdrop: true,
  closeOnEscape: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'close'): void
}>()

const dialogRoot = ref<HTMLDivElement | null>(null)
const previouslyFocused = ref<HTMLElement | null>(null)

// Tailwind's JIT won't see dynamic `max-w-${size}`, so we map explicitly.
const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'max-w-sm'
    case 'lg': return 'max-w-2xl'
    case 'xl': return 'max-w-4xl'
    default: return 'max-w-md'
  }
})

function requestClose() {
  emit('update:modelValue', false)
  emit('close')
}

function onKey(e: KeyboardEvent) {
  if (!props.modelValue) return
  if (e.key === 'Escape' && props.closeOnEscape) {
    e.stopPropagation()
    requestClose()
    return
  }
  if (e.key === 'Tab' && dialogRoot.value) {
    const focusables = dialogRoot.value.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    if (focusables.length === 0) return
    const first = focusables[0]!
    const last = focusables[focusables.length - 1]!
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus()
    }
  }
}

function lockScroll(lock: boolean) {
  if (typeof document === 'undefined') return
  document.body.style.overflow = lock ? 'hidden' : ''
}

watch(() => props.modelValue, async (open) => {
  if (open) {
    previouslyFocused.value = (document.activeElement as HTMLElement) || null
    window.addEventListener('keydown', onKey)
    lockScroll(true)
    await nextTick()
    // Focus first focusable inside the panel so keyboard users land inside
    // the modal rather than on <body>.
    const first = dialogRoot.value?.querySelector<HTMLElement>(
      'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])',
    )
    first?.focus()
  } else {
    window.removeEventListener('keydown', onKey)
    lockScroll(false)
    previouslyFocused.value?.focus()
    previouslyFocused.value = null
  }
})

// If the modal mounts already open (parent passes :model-value="true" on
// first render), the watch above never fires — attach the listener + scroll
// lock synchronously so the very first Escape works.
onMounted(() => {
  if (props.modelValue) {
    window.addEventListener('keydown', onKey)
    lockScroll(true)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  lockScroll(false)
})

function onBackdrop() {
  if (props.closeOnBackdrop) requestClose()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-wrapper">
      <div
        v-if="modelValue"
        ref="dialogRoot"
        class="mw-scrim"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="'mw-title'"
        @click.self="onBackdrop"
      >
        <div :class="['mw-card', sizeClass, danger ? 'mw-card--danger' : '']">
          <div class="mw-head">
            <h3 id="mw-title" :class="['mw-title', danger ? 'mw-title--danger' : '']">
              {{ title }}
            </h3>
            <div v-if="$slots['header-extra']" class="mw-head-extra">
              <slot name="header-extra" />
            </div>
            <button
              type="button"
              class="btn-icon mw-close"
              :class="{ 'mw-close--danger': danger }"
              aria-label="Close"
              @click="requestClose"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <div class="mw-body">
            <slot name="body" />
          </div>

          <div v-if="$slots.footer" class="mw-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.mw-scrim {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(10, 13, 24, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.mw-card {
  width: 100%;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 32px);
}
.mw-card--danger { border-color: var(--color-error); }

.mw-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--color-divider);
}
.mw-title {
  flex: 1;
  min-width: 0;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 18px;
  letter-spacing: -0.015em;
  color: var(--color-text-primary);
  font-variation-settings: 'opsz' 72;
  margin: 0;
}
.mw-title--danger { color: var(--color-error-text); }
.mw-head-extra { display: inline-flex; align-items: center; gap: 8px; }
.mw-close--danger { color: var(--color-error); }

.mw-body {
  padding: 18px 20px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.mw-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--color-divider);
  background: var(--color-bg-page);
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .mw-scrim { padding: 8px; }
  .mw-card { max-height: calc(100vh - 16px); }
}

.modal-wrapper-enter-active, .modal-wrapper-leave-active {
  transition: opacity 0.18s ease;
}
.modal-wrapper-enter-active .mw-card, .modal-wrapper-leave-active .mw-card {
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.modal-wrapper-enter-from, .modal-wrapper-leave-to { opacity: 0; }
.modal-wrapper-enter-from .mw-card, .modal-wrapper-leave-to .mw-card {
  transform: scale(0.96);
}
</style>
