<script setup lang="ts">
// Mirrors the visual rhythm of a MetricCard / StatCard while data loads.
// Use when the page would otherwise render an empty card frame and a
// single page-level spinner — the eye fixates on the spinner instead of
// understanding the layout.

withDefaults(defineProps<{
  /** Extra utility classes for outer card (e.g. responsive col-span). */
  cardClass?: string
}>(), {
  cardClass: '',
})
</script>

<template>
  <div class="skel-card" :class="cardClass">
    <div class="skeleton skel-card-label" />
    <div class="skeleton skel-card-value" />
    <div class="skeleton skel-card-trend" />
  </div>
</template>

<style scoped>
.skel-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 20px 22px;
}
.skel-card-label  { height: 10px; width: 60%;  margin-bottom: 14px; border-radius: 3px; }
.skel-card-value  { height: 32px; width: 50%;  margin-bottom: 10px; border-radius: 4px; }
.skel-card-trend  { height: 10px; width: 30%;                       border-radius: 3px; }
</style>
