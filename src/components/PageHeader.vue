<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps<{
  title: string
  description?: string
  kicker?: string
}>()

const route = useRoute()

// Default kicker falls back to the section label (same mapping as AppHeader
// breadcrumb) so every page gets a meaningful editorial kicker without having
// to pass the prop by hand. Callers can still override.
const resolvedKicker = computed(() => {
  if (props.kicker) return props.kicker
  const path = route.path
  if (/^\/(overview|campaigns|templates)/.test(path)) return 'Engage'
  if (/^\/(enrollments|segments|consents|push-audience)/.test(path)) return 'Audience'
  if (/^\/analytics\/reports/.test(path) || /^\/campaign-funnel/.test(path)) return 'Reports'
  if (/^\/analytics/.test(path)) return 'Intelligence'
  if (/^\/(settings|integrations|channels|health|logs|audit-logs|users)/.test(path)) return 'System'
  return 'AR-PAY'
})
</script>

<template>
  <div class="page-header">
    <div class="page-header-text">
      <div class="rule-dot">{{ resolvedKicker }}</div>
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

.page-header-text { max-width: 680px; min-width: 0; }

.page-header-title {
  margin-top: 12px;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: clamp(24px, 3.2vw, 40px);
  line-height: 1.05;
  letter-spacing: -0.025em;
  color: var(--color-text-primary);
  font-feature-settings: 'ss01' 1, 'ss02' 1;
  font-variation-settings: 'opsz' 96, 'SOFT' 30;
  word-break: break-word;
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
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .page-header { margin-bottom: 24px; gap: 16px; }
  .page-header-title { font-size: 24px; margin-top: 8px; }
  .page-header-desc { font-size: 13px; }
  .page-header-slot { width: 100%; }
}
</style>
