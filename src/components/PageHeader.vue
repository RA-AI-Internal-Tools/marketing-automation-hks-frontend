<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="mb-6 flex items-center justify-between page-enter">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">{{ title }}</h1>
      <p v-if="description" class="mt-1 text-sm text-[var(--color-text-tertiary)]">{{ description }}</p>
    </div>
    <slot />
  </div>
</template>
