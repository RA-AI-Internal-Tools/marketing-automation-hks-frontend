<script setup lang="ts">
defineProps<{
  title: string
  value: string | number
  subtitle?: string
  color?: 'indigo' | 'green' | 'yellow' | 'red' | 'blue'
}>()

const accentColors: Record<string, string> = {
  indigo: 'bg-[var(--color-primary)]',
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-[var(--color-accent)]',
}

const subtitleColors: Record<string, string> = {
  indigo: 'text-[var(--color-primary)]',
  green: 'text-emerald-600',
  yellow: 'text-amber-600',
  red: 'text-red-600',
  blue: 'text-[var(--color-accent)]',
}
</script>

<template>
  <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm card-interactive overflow-hidden">
    <div class="h-1" :class="accentColors[color || 'indigo']"></div>
    <div class="p-5">
      <p class="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">{{ title }}</p>
      <p class="mt-2 text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">{{ value }}</p>
      <p v-if="subtitle" class="mt-1.5 text-xs font-medium" :class="subtitleColors[color || 'indigo']">
        {{ subtitle }}
      </p>
    </div>
  </div>
</template>
