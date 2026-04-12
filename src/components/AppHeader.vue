<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Bars3Icon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '@heroicons/vue/24/outline'
import EnvironmentSwitcher from './EnvironmentSwitcher.vue'
import EnvironmentBadge from './EnvironmentBadge.vue'

defineProps<{
  sidebarCollapsed: boolean
  sidebarOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-sidebar'): void
  (e: 'toggle-mobile'): void
}>()

const route = useRoute()

// Crumbs: show the section label first, then the page title if they differ.
// e.g. "Engage  ·  Templates" — gives navigational context without duplicating
// the giant Fraunces page title right below.
const breadcrumbs = computed<{ section: string | null; title: string }>(() => {
  const title = (route.meta?.title as string) || ''
  const path = route.path
  // Simple path-to-section map
  if (/^\/(overview|campaigns|templates)/.test(path))              return { section: 'Engage', title }
  if (/^\/(enrollments|segments|consents|push-audience)/.test(path)) return { section: 'Audience', title }
  if (/^\/analytics\/(reports|funnel|journey|campaign-funnel)/.test(path)) return { section: 'Reports', title }
  if (/^\/analytics/.test(path))                                   return { section: 'Intelligence', title }
  if (/^\/(settings|integrations|channels|health|logs|audit-logs|users)/.test(path)) return { section: 'System', title }
  return { section: null, title }
})
</script>

<template>
  <!-- Desktop header — shown ≥ lg (1024px), hidden below -->
  <header
    class="ma-header layout-transition hidden lg:flex"
    :style="{ left: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)' }"
  >
    <div class="ma-header-left">
      <button
        @click="emit('toggle-sidebar')"
        class="ma-header-toggle"
        :title="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        :aria-label="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      >
        <ChevronDoubleRightIcon v-if="sidebarCollapsed" class="h-4 w-4" />
        <ChevronDoubleLeftIcon v-else class="h-4 w-4" />
      </button>

      <!-- Breadcrumb: section › title in light, typographic trail. No big heading — the page owns that. -->
      <nav class="ma-crumbs" aria-label="Breadcrumb">
        <span v-if="breadcrumbs.section" class="ma-crumb-section">{{ breadcrumbs.section }}</span>
        <span v-if="breadcrumbs.section && breadcrumbs.title" class="ma-crumb-sep">›</span>
        <span class="ma-crumb-title">{{ breadcrumbs.title }}</span>
      </nav>
    </div>
    <div class="ma-header-right">
      <EnvironmentSwitcher />
      <EnvironmentBadge />
    </div>
  </header>

  <!-- Mobile header — shown < lg, hidden ≥ lg -->
  <header class="ma-header-mobile flex lg:hidden">
    <div class="flex items-center gap-3">
      <button @click="emit('toggle-mobile')" class="ma-header-toggle" aria-label="Open menu">
        <Bars3Icon class="h-5 w-5" />
      </button>
      <span class="ma-mobile-brand">
        <span class="ma-mobile-ar">AR</span><span class="ma-mobile-sep">·</span><span class="ma-mobile-pay">PAY</span>
      </span>
    </div>
    <div class="flex items-center gap-2">
      <EnvironmentBadge compact />
    </div>
  </header>
</template>

<style scoped>
.ma-header {
  position: fixed;
  top: 0;
  right: 0;
  z-index: var(--z-header);
  height: 52px;
  padding: 0 24px;
  background: rgba(250, 248, 244, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-divider);
  align-items: center;
  justify-content: space-between;
  transition: left var(--transition-slow), background var(--transition-fast);
  /* display is owned by Tailwind's `hidden lg:flex` on the element — do
     not set `display: flex` here, or scoped specificity wins over the
     utility and the header renders at every viewport width. */
}
[data-theme="dark"] .ma-header {
  background: rgba(12, 15, 24, 0.85);
}

.ma-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.ma-header-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.ma-header-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--color-text-tertiary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast);
}
.ma-header-toggle:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-subtle);
  border-color: var(--color-border);
}

/* ─── Breadcrumb ─── */
.ma-crumbs {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-sans);
  font-size: 11px;
  letter-spacing: 0.04em;
}
.ma-crumb-section {
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
}
.ma-crumb-sep {
  color: var(--color-text-muted);
  font-weight: 300;
  font-size: 13px;
}
.ma-crumb-title {
  font-family: var(--font-sans);
  font-weight: 500;
  font-size: 12.5px;
  color: var(--color-text-secondary);
  letter-spacing: -0.005em;
}

/* ─── Mobile ─── */
.ma-header-mobile {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: var(--z-header);
  padding: 12px 16px;
  background: rgba(250, 248, 244, 0.92);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--color-divider);
  align-items: center;
  justify-content: space-between;
  /* display owned by Tailwind's `lg:hidden` utility — see note above. */
}
[data-theme="dark"] .ma-header-mobile {
  background: rgba(12, 15, 24, 0.92);
}

.ma-mobile-brand {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 18px;
  letter-spacing: -0.01em;
  color: var(--color-text-primary);
}
.ma-mobile-ar { color: var(--color-text-primary); }
.ma-mobile-sep { color: var(--hks-cyan); margin: 0 3px; font-size: 0.7em; vertical-align: middle; }
.ma-mobile-pay {
  font-style: italic;
  color: var(--hks-deep-blue);
  font-variation-settings: 'opsz' 72, 'SOFT' 60, 'WONK' 1;
}
[data-theme="dark"] .ma-mobile-pay { color: var(--hks-cyan-light); }
</style>
