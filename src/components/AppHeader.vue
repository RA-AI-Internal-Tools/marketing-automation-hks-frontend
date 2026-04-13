<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Bars3Icon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
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
// e.g. "Engage  ›  Templates" — gives navigational context without duplicating
// the giant Fraunces page title right below. Keep this map aligned with the
// sidebar sections in AppSidebar.vue.
// Section label → first page in that section, used to make the breadcrumb
// clickable ("Engage" → /overview, "Audience" → /enrollments, etc.)
const SECTION_FIRST: Record<string, string> = {
  Engage: '/overview',
  Audience: '/enrollments',
  Intelligence: '/analytics/executive',
  Reports: '/analytics/reports',
  System: '/settings',
}

// Maps the section's "list" route to a label users will recognise. The
// breadcrumb walks: section → list page → contextual leaf (Edit, New,
// detail). Without this, /campaigns/42/edit reads as "Engage › Edit
// Campaign" with no link back to the list view, which buries navigation.
const LIST_ROUTES: Record<string, { label: string; href: string }> = {
  '/campaigns':  { label: 'Campaigns',  href: '/campaigns' },
  '/templates':  { label: 'Templates',  href: '/templates' },
  '/segments':   { label: 'Segments',   href: '/segments' },
  '/broadcasts': { label: 'Broadcasts', href: '/broadcasts' },
  '/clients':    { label: 'Clients',    href: '/enrollments' }, // no /clients list yet
}

interface Crumb { label: string; href?: string }
interface Breadcrumbs {
  section: string | null
  sectionHref: string | null
  // Mid-level crumb pointing at the containing list view, when we're
  // on a detail/edit/new page. Null on top-level pages.
  parent: Crumb | null
  title: string
}

const breadcrumbs = computed<Breadcrumbs>(() => {
  const title = (route.meta?.title as string) || ''
  const path = route.path

  let section: string | null = null
  if (/^\/(overview|campaigns|templates|broadcasts|template-library)/.test(path)) section = 'Engage'
  else if (/^\/(enrollments|segments|consents|push-audience|clients)/.test(path)) section = 'Audience'
  else if (/^\/analytics\/reports/.test(path) || /^\/campaign-funnel/.test(path)) section = 'Reports'
  else if (/^\/analytics/.test(path)) section = 'Intelligence'
  else if (/^\/(settings|integrations|channels|health|logs|audit-logs|users|outbound-webhooks|catalog|cart-activity)/.test(path)) section = 'System'

  // Detect detail/edit/new pages and resolve the parent list crumb.
  // Pattern: /<resource>/[anything beyond] indicates a sub-route.
  let parent: Crumb | null = null
  const segments = path.split('/').filter(Boolean)
  if (segments.length >= 2) {
    const listKey = '/' + segments[0]
    const listInfo = LIST_ROUTES[listKey]
    if (listInfo && '/' + segments[0] !== path) {
      parent = { label: listInfo.label, href: listInfo.href }
    }
  }

  return {
    section,
    sectionHref: section ? SECTION_FIRST[section] || null : null,
    parent,
    title,
  }
})

const macMeta = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
function openPalette() {
  // Fire a synthetic ⌘K so CommandPalette's own handler opens the modal.
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: macMeta, ctrlKey: !macMeta, bubbles: true }))
}
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

      <!-- Breadcrumb: section › [parent list] › title. -->
      <nav class="ma-crumbs" aria-label="Breadcrumb">
        <router-link
          v-if="breadcrumbs.sectionHref"
          :to="breadcrumbs.sectionHref"
          class="ma-crumb-section ma-crumb-section-link"
        >{{ breadcrumbs.section }}</router-link>
        <span v-else-if="breadcrumbs.section" class="ma-crumb-section">{{ breadcrumbs.section }}</span>

        <template v-if="breadcrumbs.parent">
          <span class="ma-crumb-sep">›</span>
          <router-link
            :to="breadcrumbs.parent.href!"
            class="ma-crumb-parent"
          >{{ breadcrumbs.parent.label }}</router-link>
        </template>

        <span v-if="(breadcrumbs.section || breadcrumbs.parent) && breadcrumbs.title" class="ma-crumb-sep">›</span>
        <span class="ma-crumb-title">{{ breadcrumbs.title }}</span>
      </nav>
    </div>
    <div class="ma-header-right">
      <button
        type="button"
        class="ma-search-hint"
        @click="openPalette"
        :title="`Command palette (${macMeta ? '⌘K' : 'Ctrl+K'})`"
      >
        <MagnifyingGlassIcon class="h-3.5 w-3.5" />
        <span class="ma-search-hint-label">Search</span>
        <kbd class="ma-search-hint-kbd">{{ macMeta ? '⌘K' : 'Ctrl K' }}</kbd>
      </button>
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
  text-decoration: none;
}
.ma-crumb-section-link {
  cursor: pointer;
  transition: color var(--transition-fast);
}
.ma-crumb-section-link:hover { color: var(--hks-cyan); }

.ma-crumb-parent {
  font-family: var(--font-sans);
  font-weight: 500;
  font-size: 12px;
  color: var(--color-text-tertiary);
  text-decoration: none;
  letter-spacing: -0.005em;
  transition: color var(--transition-fast);
}
.ma-crumb-parent:hover { color: var(--hks-cyan); }

/* ─── Search hint / palette opener ─── */
.ma-search-hint {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 4px 10px;
  font-family: var(--font-sans);
  font-size: 11.5px;
  color: var(--color-text-tertiary);
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
}
.ma-search-hint:hover {
  color: var(--color-text-primary);
  border-color: var(--color-border-strong);
  background: var(--color-bg-card);
}
.ma-search-hint-label {
  font-weight: 450;
  letter-spacing: -0.005em;
}
.ma-search-hint-kbd {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  padding: 1px 5px;
  color: var(--color-text-muted);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  margin-left: 2px;
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
