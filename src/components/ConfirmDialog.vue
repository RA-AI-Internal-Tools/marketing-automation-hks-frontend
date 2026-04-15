<script setup lang="ts">
import { watch, onMounted, onBeforeUnmount, ref, nextTick } from 'vue'
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
}>(), {
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  variant: 'default',
})

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const dialogRoot = ref<HTMLDivElement | null>(null)
const confirmBtn = ref<HTMLButtonElement | null>(null)
const previouslyFocused = ref<HTMLElement | null>(null)

function onKey(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') { emit('cancel'); return }
  if (e.key === 'Enter') { emit('confirm'); return }
  // Tab focus trap — keep keyboard navigation inside the dialog so the
  // user can't tab into background page content while a confirm modal
  // (often deletion) is open.
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

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

watch(() => props.open, async (v) => {
  if (v) {
    // Remember caller focus so we can restore it on close — without this,
    // closing the modal lands focus on <body>, which screen readers
    // announce confusingly.
    previouslyFocused.value = document.activeElement as HTMLElement | null
    await nextTick()
    confirmBtn.value?.focus()
  } else if (previouslyFocused.value) {
    previouslyFocused.value.focus()
    previouslyFocused.value = null
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div
        v-if="open"
        ref="dialogRoot"
        class="dialog-scrim"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="'confirm-title'"
        :aria-describedby="'confirm-message'"
        @click.self="emit('cancel')"
      >
        <div class="dialog-card">
          <div class="dialog-head">
            <div
              v-if="variant === 'danger'"
              class="dialog-icon dialog-icon--danger"
              aria-hidden="true"
            >
              <ExclamationTriangleIcon class="h-5 w-5" />
            </div>
            <div class="dialog-body">
              <h3 id="confirm-title" class="dialog-title">{{ title }}</h3>
              <p id="confirm-message" class="dialog-message">{{ message }}</p>
            </div>
            <button
              type="button"
              class="dialog-close"
              :aria-label="cancelText"
              @click="emit('cancel')"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <div class="dialog-footer">
            <button
              type="button"
              class="btn btn-ghost"
              @click="emit('cancel')"
            >
              {{ cancelText }}
            </button>
            <button
              ref="confirmBtn"
              type="button"
              :class="['btn', variant === 'danger' ? 'btn-danger' : 'btn-primary']"
              @click="emit('confirm')"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-scrim {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(10, 13, 24, 0.5);
  backdrop-filter: blur(4px);
}

.dialog-card {
  width: 100%;
  max-width: 460px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}

.dialog-head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 22px 22px 14px;
}
.dialog-body { flex: 1; min-width: 0; }
.dialog-title {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 20px;
  letter-spacing: -0.015em;
  color: var(--color-text-primary);
  font-variation-settings: 'opsz' 72;
}
.dialog-message {
  margin-top: 6px;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--color-text-secondary);
  white-space: pre-line;
}

.dialog-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.dialog-icon--danger {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.dialog-close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast);
}
.dialog-close:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-subtle);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 22px 20px;
  border-top: 1px solid var(--color-divider);
  background: var(--color-bg-page);
}

/* Reusable danger button — extends design-system .btn token. */
:global(.btn-danger) {
  background: var(--color-error);
  color: var(--color-on-brand);
  border: 1px solid var(--color-error);
}
:global(.btn-danger:hover) {
  background: var(--color-error-text);
  border-color: var(--color-error-text);
}

/* Scale + fade transition — feels intentional, not flashy. */
.dialog-enter-active, .dialog-leave-active {
  transition: opacity 0.18s ease;
}
.dialog-enter-active .dialog-card, .dialog-leave-active .dialog-card {
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.dialog-enter-from, .dialog-leave-to { opacity: 0; }
.dialog-enter-from .dialog-card, .dialog-leave-to .dialog-card {
  transform: scale(0.96);
}
</style>
