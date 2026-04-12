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

const confirmBtn = ref<HTMLButtonElement | null>(null)

function onKey(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') emit('cancel')
  if (e.key === 'Enter') emit('confirm')
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

watch(() => props.open, async (v) => {
  if (v) { await nextTick(); confirmBtn.value?.focus() }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="'confirm-title'"
        @click.self="emit('cancel')"
      >
        <div class="bg-[var(--color-bg-card)] w-full max-w-md rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden">
          <div class="p-5 flex items-start gap-4">
            <div
              v-if="variant === 'danger'"
              class="shrink-0 h-10 w-10 rounded-full bg-red-50 flex items-center justify-center"
            >
              <ExclamationTriangleIcon class="h-5 w-5 text-red-600" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 id="confirm-title" class="text-base font-semibold text-[var(--color-text-primary)]">{{ title }}</h3>
              <p class="mt-1 text-sm text-[var(--color-text-secondary)] whitespace-pre-line">{{ message }}</p>
            </div>
            <button
              type="button"
              class="p-1 -m-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              :aria-label="cancelText"
              @click="emit('cancel')"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <div class="px-5 pb-5 pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-page)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-hover)]"
              @click="emit('cancel')"
            >
              {{ cancelText }}
            </button>
            <button
              ref="confirmBtn"
              type="button"
              :class="[
                'px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-[var(--color-bg-card)]',
                variant === 'danger'
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                  : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:ring-[var(--color-accent)]',
              ]"
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
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
