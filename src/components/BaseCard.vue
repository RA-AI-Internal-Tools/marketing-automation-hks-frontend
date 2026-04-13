<script setup lang="ts">
// Single-source surface card. Replaces the per-page `.chart-card`,
// `.tpl-card`, `.camp-card`, inline `bg-[var(--color-bg-card)] rounded-xl
// border ...` Tailwind soup that drifted in padding + radius across the
// app.
//
// Variants:
//   default   — standard 20px padding, rounded-lg, hairline border
//   flush     — no padding (tables that handle their own; embedded media)
//   interactive — adds .card-interactive hover (border tightens, lift)

withDefaults(defineProps<{
  flush?: boolean
  interactive?: boolean
}>(), {
  flush: false,
  interactive: false,
})
</script>

<template>
  <div :class="[
    'base-card',
    { 'base-card--flush': flush, 'card-interactive': interactive },
  ]">
    <slot />
  </div>
</template>

<style scoped>
.base-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}
.base-card--flush {
  padding: 0;
}
/* .card-interactive hover defined globally in design-system.css */
</style>
