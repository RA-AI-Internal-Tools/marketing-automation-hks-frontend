<script setup lang="ts">
defineProps<{
  title: string
  value: string | number
  subtitle?: string
  trend?: 'up' | 'down' | 'flat'
  accent?: 'default' | 'emerald' | 'amber' | 'rose' | 'cyan'
}>()

function formatValue(v: string | number): string {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v.toLocaleString()
  }
  return String(v)
}
</script>

<template>
  <div class="stat-card">
    <div class="stat-card-label">
      <span>{{ title }}</span>
      <span v-if="trend === 'up'" class="stat-trend stat-trend-up" aria-hidden="true">↗</span>
      <span v-else-if="trend === 'down'" class="stat-trend stat-trend-down" aria-hidden="true">↘</span>
    </div>

    <div
      class="stat-card-value"
      :data-accent="accent || 'default'"
    >
      {{ formatValue(value) }}
    </div>

    <p v-if="subtitle" class="stat-card-sub" :data-accent="accent || 'default'">{{ subtitle }}</p>

    <!-- Bottom hairline accent -->
    <div class="stat-card-rule" :data-accent="accent || 'default'" />
  </div>
</template>

<style scoped>
.stat-card {
  position: relative;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 20px 22px 22px;
  transition: border-color var(--transition-fast), transform var(--transition-fast);
  overflow: hidden;
}
.stat-card:hover {
  border-color: var(--color-border-strong);
  transform: translateY(-1px);
}

.stat-card-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
}

.stat-trend {
  font-size: 14px;
  line-height: 1;
}
.stat-trend-up { color: var(--color-success); }
.stat-trend-down { color: var(--color-error); }

.stat-card-value {
  margin-top: 16px;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: clamp(32px, 3vw, 44px);
  line-height: 0.95;
  letter-spacing: -0.03em;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums lining-nums;
  font-variation-settings: 'opsz' 144, 'SOFT' 30;
}

/* Accented variants — tint the number only, never the whole card */
.stat-card-value[data-accent="emerald"] { color: var(--color-success); }
.stat-card-value[data-accent="amber"]   { color: var(--color-warning); }
.stat-card-value[data-accent="rose"]    { color: var(--color-error); }
.stat-card-value[data-accent="cyan"]    { color: var(--hks-cyan); }

.stat-card-sub {
  margin-top: 6px;
  font-family: var(--font-sans);
  font-size: 11.5px;
  font-weight: 500;
  color: var(--color-text-tertiary);
  letter-spacing: 0.01em;
}
.stat-card-sub[data-accent="emerald"] { color: var(--color-success); }
.stat-card-sub[data-accent="amber"]   { color: var(--color-warning); }
.stat-card-sub[data-accent="rose"]    { color: var(--color-error); }
.stat-card-sub[data-accent="cyan"]    { color: var(--hks-cyan); }

/* Bottom accent — a hairline that intensifies on hover */
.stat-card-rule {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: var(--color-border);
  transition: background var(--transition-fast), height var(--transition-fast);
}
.stat-card:hover .stat-card-rule { height: 2px; }
.stat-card-rule[data-accent="default"] { background: var(--hks-deep-blue); opacity: 0; }
.stat-card:hover .stat-card-rule[data-accent="default"] { opacity: 1; }
.stat-card-rule[data-accent="emerald"] { background: var(--color-success); opacity: 0.35; }
.stat-card-rule[data-accent="amber"]   { background: var(--color-warning); opacity: 0.35; }
.stat-card-rule[data-accent="rose"]    { background: var(--color-error); opacity: 0.35; }
.stat-card-rule[data-accent="cyan"]    { background: var(--hks-cyan); opacity: 0.35; }
.stat-card:hover .stat-card-rule[data-accent="emerald"],
.stat-card:hover .stat-card-rule[data-accent="amber"],
.stat-card:hover .stat-card-rule[data-accent="rose"],
.stat-card:hover .stat-card-rule[data-accent="cyan"] { opacity: 1; }
</style>
