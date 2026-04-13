<script setup lang="ts">
// CSS-only tooltip — no JS positioning library, no portal.
//
// Wraps a single trigger child; on hover/focus the .tooltip-content
// span fades in above. Uses aria-describedby on the wrapper so screen
// readers announce the help text without speaking it twice.
//
// Replaces the native `title="..."` attribute on icon-only buttons,
// which (a) doesn't support dark theme colours, (b) varies between
// browsers, (c) takes ~1.5s to appear which feels broken at the
// editorial-app pace.

import { useId } from 'vue'

defineProps<{
  text: string
  /** Position relative to the trigger. Default: top. */
  placement?: 'top' | 'bottom' | 'left' | 'right'
}>()

const id = useId() ?? Math.random().toString(36).slice(2, 10)
</script>

<template>
  <span class="tooltip-wrapper" :aria-describedby="id">
    <slot />
    <span
      :id="id"
      class="tooltip-content"
      :data-placement="placement ?? 'top'"
      role="tooltip"
    >{{ text }}</span>
  </span>
</template>

<style scoped>
.tooltip-wrapper {
  position: relative;
  display: inline-flex;
}

.tooltip-content {
  position: absolute;
  z-index: var(--z-overlay);
  background: var(--color-text-primary);
  color: var(--color-bg-card);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  line-height: 1.3;
  padding: 5px 9px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--transition-fast), transform var(--transition-fast);
  box-shadow: var(--shadow-md);
}

/* Placements */
.tooltip-content[data-placement="top"]    { bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%) translateY(2px); }
.tooltip-content[data-placement="bottom"] { top:    calc(100% + 6px); left: 50%; transform: translateX(-50%) translateY(-2px); }
.tooltip-content[data-placement="left"]   { right:  calc(100% + 6px); top: 50%; transform: translateY(-50%) translateX(2px); }
.tooltip-content[data-placement="right"]  { left:   calc(100% + 6px); top: 50%; transform: translateY(-50%) translateX(-2px); }

.tooltip-wrapper:hover .tooltip-content,
.tooltip-wrapper:focus-within .tooltip-content {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.tooltip-content[data-placement="left"],
.tooltip-content[data-placement="right"] {
  /* Only Y centring on the horizontal placements — keep transform clean */
}
.tooltip-wrapper:hover .tooltip-content[data-placement="left"],
.tooltip-wrapper:focus-within .tooltip-content[data-placement="left"],
.tooltip-wrapper:hover .tooltip-content[data-placement="right"],
.tooltip-wrapper:focus-within .tooltip-content[data-placement="right"] {
  transform: translateY(-50%);
}
</style>
