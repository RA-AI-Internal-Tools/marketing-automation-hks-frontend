<script setup lang="ts">
// N-row table-shaped shimmer. Replaces the page-level spinner that hides
// the table layout while the first paint loads. Renders inside the same
// surface card the real table will occupy — no layout shift on swap.

withDefaults(defineProps<{
  rows?: number
  columns?: number
}>(), {
  rows: 5,
  columns: 4,
})
</script>

<template>
  <div class="skel-table" role="status" aria-label="Loading rows">
    <div v-for="i in rows" :key="i" class="skel-row">
      <div v-for="j in columns" :key="j" class="skeleton skel-cell" />
    </div>
  </div>
</template>

<style scoped>
.skel-table {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 8px 16px;
}
.skel-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-divider);
}
.skel-row:last-child { border-bottom: 0; }
.skel-cell {
  height: 14px;
  flex: 1;
  border-radius: 3px;
  /* Vary widths slightly per cell so it doesn't look mechanical */
}
.skel-row > .skel-cell:nth-child(1) { flex: 2; }
.skel-row > .skel-cell:nth-child(3) { flex: 0 0 80px; }
.skel-row > .skel-cell:nth-child(4) { flex: 0 0 64px; }
</style>
