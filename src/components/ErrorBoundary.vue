<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'

const hasError = ref(false)
const errorMessage = ref('')

onErrorCaptured((err) => {
  hasError.value = true
  errorMessage.value = err instanceof Error ? err.message : String(err)
  console.error('[ErrorBoundary]', err)
  return false
})

function reload() {
  window.location.reload()
}
</script>

<template>
  <slot v-if="!hasError" />
  <div v-else class="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
    <div class="max-w-md w-full bg-[var(--color-bg-secondary)] rounded-xl p-8 shadow-lg text-center">
      <div class="text-4xl mb-4">⚠</div>
      <h1 class="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Something went wrong</h1>
      <p class="text-sm text-[var(--color-text-muted)] mb-4">
        {{ errorMessage || 'An unexpected error occurred.' }}
      </p>
      <button
        class="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
        @click="reload"
      >
        Reload page
      </button>
    </div>
  </div>
</template>
