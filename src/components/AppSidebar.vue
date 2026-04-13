<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useEnvironmentStore } from '@/stores/environment'
import ThemeToggle from './ThemeToggle.vue'
import EnvironmentBadge from './EnvironmentBadge.vue'
import {
  ChartBarIcon,
  RocketLaunchIcon,
  UsersIcon,
  DocumentDuplicateIcon,
  MegaphoneIcon,
  ShieldCheckIcon,
  HeartIcon,
  Cog6ToothIcon,
  XMarkIcon,
  ArrowRightStartOnRectangleIcon,
  PresentationChartBarIcon,
  GlobeAltIcon,
  FunnelIcon,
  UserGroupIcon,
  CubeIcon,
  CreditCardIcon,
  ShoppingCartIcon,
  ArrowPathIcon,
  ServerStackIcon,
  DocumentChartBarIcon,
  ChevronDownIcon,
  UserPlusIcon,
  LinkIcon,
  DocumentTextIcon,
  BellAlertIcon,
  ExclamationTriangleIcon,
  MapIcon,
  AdjustmentsHorizontalIcon,
  BoltIcon,
  SparklesIcon,
} from '@heroicons/vue/24/outline'

const props = defineProps<{
  collapsed: boolean
  mobileOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-sidebar'): void
  (e: 'close-mobile'): void
  (e: 'logout'): void
}>()

const route = useRoute()
const auth = useAuthStore()
const env = useEnvironmentStore()

interface NavItem {
  name: string
  to: string
  icon: any
  adminOnly?: boolean
}

interface NavSection {
  label: string
  items: NavItem[]
  defaultOpen?: boolean
  adminOnly?: boolean
}

const allSections: NavSection[] = [
  {
    label: 'Engage',
    defaultOpen: true,
    items: [
      { name: 'Overview', to: '/overview', icon: ChartBarIcon },
      { name: 'Campaigns', to: '/campaigns', icon: RocketLaunchIcon },
      { name: 'Broadcasts', to: '/broadcasts', icon: MegaphoneIcon },
      { name: 'Templates', to: '/templates', icon: DocumentDuplicateIcon },
      { name: 'Template library', to: '/template-library', icon: SparklesIcon },
      { name: 'Catalog', to: '/catalog', icon: CubeIcon },
    ],
  },
  {
    label: 'Audience',
    defaultOpen: true,
    items: [
      { name: 'Enrollments', to: '/enrollments', icon: UsersIcon },
      { name: 'Segments', to: '/segments', icon: AdjustmentsHorizontalIcon },
      { name: 'Consents', to: '/consents', icon: ShieldCheckIcon },
      { name: 'Push audience', to: '/push-audience', icon: BellAlertIcon },
    ],
  },
  {
    label: 'Intelligence',
    defaultOpen: false,
    items: [
      { name: 'Executive', to: '/analytics/executive', icon: PresentationChartBarIcon },
      { name: 'Cart activity', to: '/cart-activity', icon: ShoppingCartIcon },
      { name: 'Acquisition', to: '/analytics/acquisition', icon: GlobeAltIcon },
      { name: 'Funnel', to: '/analytics/funnel', icon: FunnelIcon },
      { name: 'Users', to: '/analytics/users', icon: UserGroupIcon },
      { name: 'Products', to: '/analytics/products', icon: CubeIcon },
      { name: 'Payments', to: '/analytics/payments', icon: CreditCardIcon },
      { name: 'Orders', to: '/analytics/orders', icon: ShoppingCartIcon },
      { name: 'Retention', to: '/analytics/retention', icon: ArrowPathIcon },
      { name: 'Data health', to: '/analytics/data-health', icon: ServerStackIcon },
      { name: 'Attribution', to: '/analytics/attribution', icon: LinkIcon },
      { name: 'Churn risk', to: '/analytics/churn', icon: ExclamationTriangleIcon },
      { name: 'Cohorts & LTV', to: '/analytics/cohort', icon: UserGroupIcon },
      { name: 'Journey', to: '/analytics/journey', icon: MapIcon },
    ],
  },
  {
    label: 'Reports',
    defaultOpen: false,
    items: [
      { name: 'Scheduled', to: '/analytics/reports', icon: DocumentChartBarIcon },
      { name: 'Campaign funnel', to: '/campaign-funnel', icon: FunnelIcon },
    ],
  },
  {
    label: 'System',
    defaultOpen: false,
    items: [
      { name: 'Settings', to: '/settings', icon: Cog6ToothIcon },
      { name: 'Integrations', to: '/integrations', icon: LinkIcon },
      { name: 'Outbound webhooks', to: '/outbound-webhooks', icon: BoltIcon, adminOnly: true },
      { name: 'Channels', to: '/channels', icon: MegaphoneIcon },
      { name: 'Health', to: '/health', icon: HeartIcon },
      { name: 'Logs', to: '/logs', icon: DocumentTextIcon },
      { name: 'Audit logs', to: '/audit-logs', icon: ShieldCheckIcon, adminOnly: true },
      { name: 'Users', to: '/users', icon: UserPlusIcon, adminOnly: true },
    ],
  },
]

const sections = computed(() =>
  allSections
    .filter(s => !s.adminOnly || auth.isAdmin)
    .map(s => ({
      ...s,
      items: s.items.filter(i => !i.adminOnly || auth.isAdmin),
    }))
)

const openSections = ref<Record<string, boolean>>(
  Object.fromEntries(sections.value.map((s) => [s.label, s.defaultOpen ?? false])),
)

watchEffect(() => {
  for (const s of sections.value) {
    if (!(s.label in openSections.value)) {
      openSections.value[s.label] = s.defaultOpen ?? false
    }
  }
})

function toggleSection(label: string) {
  openSections.value[label] = !openSections.value[label]
}

function isActiveItem(to: string): boolean {
  return route.path === to || route.path.startsWith(to + '/')
}

function handleNavClick() {
  emit('close-mobile')
}

const roleInitial = computed(() => (auth.name || auth.email || '?').charAt(0).toUpperCase())
</script>

<template>
  <!-- Mobile overlay backdrop -->
  <div
    v-if="mobileOpen"
    class="lg:hidden fixed inset-0 z-[calc(var(--z-sidebar)-1)] bg-black/60 backdrop-blur-sm"
    @click="emit('close-mobile')"
  />

  <!-- Sidebar -->
  <aside
    :class="[
      'ma-sidebar fixed top-0 left-0 z-[var(--z-sidebar)] h-full flex flex-col transition-all duration-300 ease-in-out',
      collapsed && !mobileOpen ? 'w-[var(--sidebar-collapsed-width)]' : 'w-[var(--sidebar-width)]',
      mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
    ]"
  >
    <!-- Brand — typographic wordmark, no PNG -->
    <div class="brand-block" :class="collapsed && !mobileOpen ? 'brand-collapsed' : ''">
      <router-link to="/overview" class="brand-mark" @click="handleNavClick">
        <span v-if="!collapsed || mobileOpen" class="brand-word">
          <span class="brand-word-ar">AR</span><span class="brand-word-sep">·</span><span class="brand-word-pay">PAY</span>
        </span>
        <span v-else class="brand-word-collapsed">A·P</span>
      </router-link>
      <div v-if="!collapsed || mobileOpen" class="brand-meta">
        <span class="brand-sub">Growth engine</span>
        <EnvironmentBadge compact />
      </div>
      <button
        v-if="mobileOpen"
        @click="emit('close-mobile')"
        class="lg:hidden ml-auto text-slate-400 hover:text-white transition-colors"
        aria-label="Close menu"
      >
        <XMarkIcon class="h-5 w-5" />
      </button>
    </div>

    <!-- Navigation -->
    <nav
      class="flex-1 overflow-y-auto sidebar-scroll"
      :class="collapsed && !mobileOpen ? 'px-1 py-2' : 'px-3 py-3'"
    >
      <div v-for="section in sections" :key="section.label" class="nav-section">
        <!-- Section header — small caps kicker -->
        <button
          v-if="!collapsed || mobileOpen"
          @click="toggleSection(section.label)"
          class="nav-section-head"
        >
          <span class="nav-section-head-label">{{ section.label }}</span>
          <ChevronDownIcon
            :class="[
              'h-3 w-3 transition-transform duration-200 opacity-60',
              openSections[section.label] ? 'rotate-0' : '-rotate-90',
            ]"
          />
        </button>

        <!-- Collapsed divider -->
        <div v-if="collapsed && !mobileOpen" class="collapsed-divider" />

        <!-- Items -->
        <div
          v-show="openSections[section.label] || (collapsed && !mobileOpen)"
          :class="collapsed && !mobileOpen ? 'space-y-0' : 'space-y-px mb-3'"
        >
          <RouterLink
            v-for="item in section.items"
            :key="item.name"
            :to="item.to"
            @click="handleNavClick"
            :title="collapsed && !mobileOpen ? item.name : undefined"
            :class="[
              'nav-item',
              collapsed && !mobileOpen ? 'nav-item-collapsed' : '',
              isActiveItem(item.to) ? 'nav-item-active' : '',
            ]"
          >
            <component
              :is="item.icon"
              class="nav-item-icon shrink-0"
              :class="collapsed && !mobileOpen ? 'h-[18px] w-[18px]' : 'h-[16px] w-[16px]'"
            />
            <span v-if="!collapsed || mobileOpen" class="nav-item-label">{{ item.name }}</span>
            <span v-if="!collapsed && !mobileOpen && isActiveItem(item.to)" class="nav-item-dot" />
          </RouterLink>
        </div>
      </div>
    </nav>

    <!-- Footer -->
    <div class="sidebar-footer" :class="collapsed && !mobileOpen ? 'sidebar-footer-collapsed' : ''">
      <ThemeToggle :collapsed="collapsed && !mobileOpen" />

      <div class="user-block" :class="collapsed && !mobileOpen ? 'user-block-collapsed' : ''">
        <div v-if="!collapsed || mobileOpen" class="user-left">
          <div class="user-avatar">{{ roleInitial }}</div>
          <div class="user-meta">
            <div class="user-name">{{ auth.name || auth.email }}</div>
            <div class="user-role">
              <span>{{ auth.role }}</span>
              <span class="user-role-dot" />
              <span class="user-email">{{ auth.email }}</span>
            </div>
          </div>
        </div>
        <button
          @click="emit('logout')"
          class="user-logout"
          :title="`Sign out (${auth.email})`"
          aria-label="Sign out"
        >
          <ArrowRightStartOnRectangleIcon class="h-4 w-4" />
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.ma-sidebar {
  background: var(--sidebar-bg);
  color: var(--sidebar-text);
  border-right: 1px solid rgba(255, 255, 255, 0.04);
  font-family: var(--font-sans);
}

/* ─── Brand ─── */
.brand-block {
  padding: 20px 20px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--sidebar-border);
}
.brand-collapsed { padding: 14px 0; justify-content: center; }

.brand-mark {
  display: flex;
  align-items: center;
  text-decoration: none;
  line-height: 1;
}
.brand-word {
  font-family: var(--font-display);
  font-weight: 500;
  font-variation-settings: 'opsz' 72, 'SOFT' 30;
  font-size: 22px;
  letter-spacing: -0.01em;
  color: #fff;
  display: inline-flex;
  align-items: baseline;
  gap: 0;
}
.brand-word-ar { color: #fff; }
.brand-word-sep {
  color: var(--hks-cyan);
  margin: 0 3px;
  font-weight: 400;
  font-size: 0.75em;
  vertical-align: middle;
  position: relative;
  top: -2px;
}
.brand-word-pay {
  color: var(--hks-cyan-light);
  font-style: italic;
  font-variation-settings: 'opsz' 72, 'SOFT' 60, 'WONK' 1;
  font-weight: 400;
}
.brand-word-collapsed {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 18px;
  color: #fff;
}

.brand-meta {
  margin-left: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
}
.brand-sub {
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
}

/* ─── Section headers ─── */
.nav-section { margin-bottom: 2px; }

.nav-section-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 10px 6px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--sidebar-label);
  background: none;
  border: none;
  cursor: pointer;
  transition: color var(--transition-fast);
}
.nav-section-head:hover { color: rgba(255, 255, 255, 0.6); }

.collapsed-divider {
  height: 1px;
  margin: 8px auto;
  width: 24px;
  background: rgba(255, 255, 255, 0.06);
}

/* ─── Nav items ─── */
.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  font-size: 13px;
  font-weight: 450;
  color: var(--sidebar-text);
  border-radius: var(--radius-md);
  text-decoration: none;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}
.nav-item-collapsed {
  justify-content: center;
  padding: 9px 0;
  margin: 2px 4px;
}
.nav-item:hover {
  background: var(--sidebar-hover);
  color: var(--sidebar-text-hover);
}
.nav-item-icon {
  color: currentColor;
  opacity: 0.8;
  transition: opacity var(--transition-fast);
}
.nav-item:hover .nav-item-icon { opacity: 1; }
.nav-item-label {
  flex: 1;
  letter-spacing: -0.005em;
}

/* Active state — no gaudy border, subtle bg + cyan dot */
.nav-item-active {
  color: var(--sidebar-text-active);
  background: var(--sidebar-active);
}
.nav-item-active .nav-item-icon {
  opacity: 1;
  color: var(--hks-cyan);
}
.nav-item-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--hks-cyan);
  box-shadow: 0 0 0 2px rgba(0, 153, 219, 0.18);
}

/* ─── Footer ─── */
.sidebar-footer {
  padding: 14px 16px;
  border-top: 1px solid var(--sidebar-border);
}
.sidebar-footer-collapsed { padding: 10px 6px; }

.user-block {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.user-block-collapsed { justify-content: center; margin-top: 6px; }

.user-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--hks-cyan), var(--hks-royal-blue));
  color: #fff;
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
}
.user-meta {
  min-width: 0;
  flex: 1;
}
.user-name {
  font-size: 12.5px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.92);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-role {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--sidebar-label);
  min-width: 0;
}
.user-role > :first-child {
  color: var(--hks-cyan-light);
  font-weight: 600;
}
.user-role-dot {
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: var(--sidebar-label);
  flex-shrink: 0;
}
.user-email {
  color: var(--sidebar-label);
  text-transform: none;
  letter-spacing: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.user-logout {
  padding: 6px;
  color: var(--sidebar-label);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast);
}
.user-logout:hover {
  color: var(--color-error);
  background: rgba(180, 40, 30, 0.15);
}
</style>
