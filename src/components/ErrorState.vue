<script setup lang="ts">
// Standardised error display for data-driven views. Replaces the
// inconsistent "red box with text" pattern across analytics pages —
// some had no retry button, some used different colours, some swallowed
// the actual error message into a generic "Failed to load".
//
// Usage:
//   <ErrorState
//     message="Couldn't load attribution data."
//     :retryable="true"
//     @retry="reload"
//   />

import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/vue/24/outline'

withDefaults(defineProps<{
  message: string
  /** Show the Try again button + emit @retry. */
  retryable?: boolean
}>(), {
  retryable: false,
})

defineEmits<{ (e: 'retry'): void }>()
</script>

<template>
  <div class="error-state" role="alert">
    <ExclamationTriangleIcon class="error-state-icon" aria-hidden="true" />
    <p class="error-state-message">{{ message }}</p>
    <button
      v-if="retryable"
      type="button"
      class="btn btn-ghost error-state-retry"
      @click="$emit('retry')"
    >
      <ArrowPathIcon class="h-4 w-4" /> Try again
    </button>
  </div>
</template>

<style scoped>
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 36px 24px;
  background: var(--color-error-bg);
  border: 1px solid var(--color-error-border);
  border-radius: var(--radius-lg);
  color: var(--color-error-text);
}
.error-state-icon {
  width: 32px;
  height: 32px;
  color: var(--color-error);
  margin-bottom: 10px;
  opacity: 0.85;
}
.error-state-message {
  font-size: 13.5px;
  line-height: 1.5;
  max-width: 440px;
}
.error-state-retry {
  margin-top: 14px;
}
/* `.btn` is sized for a mouse and lands at ~37px tall, which is under the 44px
   touch floor. That is tolerable on an operator dashboard and not tolerable on
   the public preference centre, which renders this component to a customer on a
   phone in a mail client — "Try again" is their only way out of a failed
   unsubscribe. Widen the target on small viewports only, so no desktop layout
   moves. */
@media (max-width: 640px) {
  .error-state-retry {
    min-height: 44px;
    padding-inline: 18px;
  }
}
</style>
