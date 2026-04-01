<script setup lang="ts">
import { ref } from 'vue'
import { useEnvironmentStore, type EnvironmentMode } from '@/stores/environment'

const env = useEnvironmentStore()
const showConfirm = ref(false)
const pendingMode = ref<EnvironmentMode>('sandbox')

function handleSwitch(mode: EnvironmentMode) {
  if (mode === env.mode) return
  if (mode === 'production') {
    pendingMode.value = mode
    showConfirm.value = true
    return
  }
  env.switchMode(mode)
}

function confirmSwitch() {
  env.switchMode(pendingMode.value)
  showConfirm.value = false
}
</script>

<template>
  <div class="relative">
    <div class="flex items-center bg-[var(--color-bg-subtle)] rounded-lg p-0.5 border border-[var(--color-border)]">
      <button
        @click="handleSwitch('sandbox')"
        :class="[
          'px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150',
          env.isSandbox
            ? 'bg-[var(--env-sandbox-badge-bg)] text-[var(--env-sandbox-badge-text)] shadow-sm'
            : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]',
        ]"
      >
        Sandbox
      </button>
      <button
        @click="handleSwitch('production')"
        :class="[
          'px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150',
          env.isProduction
            ? 'bg-[var(--env-production-badge-bg)] text-[var(--env-production-badge-text)] shadow-sm'
            : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]',
        ]"
      >
        Production
      </button>
    </div>

    <!-- Production confirmation dialog -->
    <Teleport to="body">
      <Transition
        enter-active-class="duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="showConfirm" class="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
          <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="showConfirm = false" />
          <div class="relative bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-xl p-6 max-w-sm w-full">
            <div class="flex items-center gap-3 mb-4">
              <div class="flex items-center justify-center h-10 w-10 rounded-full bg-[var(--env-production-bg)] border border-[var(--env-production-border)]">
                <svg class="h-5 w-5 text-[var(--env-production-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 class="text-sm font-semibold text-[var(--color-text-primary)]">Switch to Production</h3>
                <p class="text-xs text-[var(--color-text-tertiary)]">You are about to enter production mode</p>
              </div>
            </div>
            <p class="text-sm text-[var(--color-text-secondary)] mb-6">
              In production mode, all actions will affect live data and real integrations. Proceed with caution.
            </p>
            <div class="flex gap-3 justify-end">
              <button
                @click="showConfirm = false"
                class="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-subtle)] rounded-lg hover:bg-[var(--color-bg-muted)] transition-colors"
              >
                Cancel
              </button>
              <button
                @click="confirmSwitch"
                class="px-4 py-2 text-sm font-medium text-white bg-[var(--env-production-accent)] rounded-lg hover:opacity-90 transition-colors"
              >
                Switch to Production
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
