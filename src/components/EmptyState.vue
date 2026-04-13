<script setup lang="ts">
// Standardised empty-state pattern. Replaces the inconsistent "No data"
// text + tiny icon variants scattered across CampaignsPage, BroadcastsPage,
// TemplatesPage etc. Centralising means CTA placement, icon size and
// muted-text colour can't drift from page to page.
//
// Usage:
//   <EmptyState
//     :icon="RocketLaunchIcon"
//     title="No campaigns yet."
//     description="Start from a blueprint or compose your own."
//   >
//     <template #action>
//       <button class="btn btn-primary" @click="...">New campaign</button>
//     </template>
//   </EmptyState>

import type { FunctionalComponent, SVGAttributes } from 'vue'

defineProps<{
  icon?: FunctionalComponent<SVGAttributes>
  title: string
  description?: string
}>()
</script>

<template>
  <div class="empty-state">
    <component v-if="icon" :is="icon" class="empty-state-icon" aria-hidden="true" />
    <h3 class="empty-state-title">{{ title }}</h3>
    <p v-if="description" class="empty-state-description">{{ description }}</p>
    <div v-if="$slots.action" class="empty-state-action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  padding: 96px 24px;
  text-align: center;
  background: var(--color-bg-card);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-lg);
}
.empty-state-icon {
  width: 42px;
  height: 42px;
  color: var(--color-text-muted);
  margin: 0 auto 16px;
  opacity: 0.6;
}
.empty-state-title {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 400;
  color: var(--color-text-secondary);
  letter-spacing: -0.01em;
  font-variation-settings: 'opsz' 72;
}
.empty-state-description {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--color-text-muted);
  max-width: 480px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.55;
}
.empty-state-action {
  margin-top: 18px;
  display: inline-flex;
  gap: 10px;
  justify-content: center;
}
</style>
