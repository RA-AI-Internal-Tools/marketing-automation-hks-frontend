<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  kicker?: string
}>()
</script>

<template>
  <div class="page-header">
    <div class="page-header-text">
      <div class="rule-dot">{{ kicker || 'AR-PAY' }}</div>
      <h1 class="page-header-title">{{ title }}</h1>
      <p v-if="description" class="page-header-desc">{{ description }}</p>
    </div>
    <div class="page-header-slot"><slot /></div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.page-header-text { max-width: 680px; }

.page-header-title {
  margin-top: 12px;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: clamp(28px, 3.2vw, 40px);
  line-height: 1.05;
  letter-spacing: -0.025em;
  color: var(--color-text-primary);
  font-feature-settings: 'ss01' 1, 'ss02' 1;
  font-variation-settings: 'opsz' 96, 'SOFT' 30;
}

.page-header-desc {
  margin-top: 10px;
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.55;
  color: var(--color-text-tertiary);
  max-width: 60ch;
}

.page-header-slot {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 640px) {
  .page-header { margin-bottom: 24px; }
  .page-header-title { font-size: 26px; }
}
</style>
