<script setup lang="ts">
import type { ValidationItem } from '@/composables/useEmailValidation'
import {
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/vue/24/outline'

defineProps<{
  errors: ValidationItem[]
  warnings: ValidationItem[]
}>()

const emit = defineEmits<{
  goToField: [field: string]
}>()
</script>

<template>
  <div class="px-3 py-3">
    <h3 class="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">Validation</h3>

    <!-- All good -->
    <div
      v-if="errors.length === 0 && warnings.length === 0"
      class="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
    >
      <CheckCircleIcon class="h-4 w-4 shrink-0" />
      <span class="text-xs font-medium">All checks passed</span>
    </div>

    <!-- Errors -->
    <div v-if="errors.length > 0" class="mb-3">
      <p class="text-[11px] font-semibold text-[var(--color-error-text)] mb-1.5">Errors ({{ errors.length }})</p>
      <div class="space-y-1.5">
        <div
          v-for="item in errors"
          :key="item.id"
          class="flex items-start gap-2 p-2 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error-text)]"
        >
          <ExclamationCircleIcon class="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0">
            <p class="text-xs">{{ item.message }}</p>
            <button
              v-if="item.field"
              @click="emit('goToField', item.field)"
              class="text-[10px] text-[var(--color-error)] hover:text-[var(--color-error-text)] underline mt-0.5"
            >
              Go to field
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Warnings -->
    <div v-if="warnings.length > 0">
      <p class="text-[11px] font-semibold text-[var(--color-warning-text)] mb-1.5">Warnings ({{ warnings.length }})</p>
      <div class="space-y-1.5">
        <div
          v-for="item in warnings"
          :key="item.id"
          class="flex items-start gap-2 p-2 rounded-lg bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]"
        >
          <ExclamationTriangleIcon class="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0">
            <p class="text-xs">{{ item.message }}</p>
            <button
              v-if="item.field"
              @click="emit('goToField', item.field)"
              class="text-[10px] text-[var(--color-warning)] hover:text-[var(--color-warning-text)] underline mt-0.5"
            >
              Go to field
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
