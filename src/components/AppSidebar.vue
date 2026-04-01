<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useEnvironmentStore } from '@/stores/environment'
import ThemeToggle from './ThemeToggle.vue'
import EnvironmentBadge from './EnvironmentBadge.vue'
import hksLogo from '@/assets/hks-logo.svg'
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
    label: 'Main',
    defaultOpen: true,
    items: [
      { name: 'Dashboard', to: '/overview', icon: ChartBarIcon },
      { name: 'Campaigns', to: '/campaigns', icon: RocketLaunchIcon },
      { name: 'Templates', to: '/templates', icon: DocumentDuplicateIcon },
    ],
  },
  {
    label: 'Audience',
    defaultOpen: true,
    items: [
      { name: 'Enrollments', to: '/enrollments', icon: UsersIcon },
      { name: 'Consents', to: '/consents', icon: ShieldCheckIcon },
    ],
  },
  {
    label: 'Analytics',
    defaultOpen: false,
    items: [
      { name: 'Executive', to: '/analytics/executive', icon: PresentationChartBarIcon },
      { name: 'Acquisition', to: '/analytics/acquisition', icon: GlobeAltIcon },
      { name: 'Funnel', to: '/analytics/funnel', icon: FunnelIcon },
      { name: 'Users', to: '/analytics/users', icon: UserGroupIcon },
      { name: 'Products', to: '/analytics/products', icon: CubeIcon },
      { name: 'Payments', to: '/analytics/payments', icon: CreditCardIcon },
      { name: 'Orders', to: '/analytics/orders', icon: ShoppingCartIcon },
      { name: 'Retention', to: '/analytics/retention', icon: ArrowPathIcon },
      { name: 'Data Health', to: '/analytics/data-health', icon: ServerStackIcon },
    ],
  },
  {
    label: 'Reports',
    defaultOpen: false,
    items: [
      { name: 'Automated Reports', to: '/analytics/reports', icon: DocumentChartBarIcon },
      { name: 'Campaign Funnel', to: '/campaign-funnel', icon: FunnelIcon },
    ],
  },
  {
    label: 'System',
    defaultOpen: false,
    items: [
      { name: 'Settings', to: '/settings', icon: Cog6ToothIcon },
      { name: 'Integrations', to: '/integrations', icon: LinkIcon },
      { name: 'Channels', to: '/channels', icon: MegaphoneIcon },
      { name: 'Health', to: '/health', icon: HeartIcon },
      { name: 'Logs', to: '/logs', icon: DocumentTextIcon },
      { name: 'Audit Logs', to: '/audit-logs', icon: ShieldCheckIcon, adminOnly: true },
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
      'fixed top-0 left-0 z-[var(--z-sidebar)] h-full bg-[var(--sidebar-bg)] flex flex-col transition-all duration-300 ease-in-out',
      collapsed && !mobileOpen ? 'w-[var(--sidebar-collapsed-width)]' : 'w-[var(--sidebar-width)]',
      mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
    ]"
  >
    <!-- Brand section -->
    <div class="p-4 border-b border-[var(--sidebar-border)] flex items-center" :class="collapsed && !mobileOpen ? 'justify-center' : 'gap-3'">
      <img :src="hksLogo" alt="HKS Global" class="h-7 shrink-0" />
      <template v-if="!collapsed || mobileOpen">
        <div class="flex-1 min-w-0">
          <p class="text-[11px] font-medium text-[var(--color-accent)] tracking-wider uppercase">Growth Engine</p>
        </div>
        <EnvironmentBadge compact />
      </template>
      <!-- Mobile close button -->
      <button
        v-if="mobileOpen"
        @click="emit('close-mobile')"
        class="lg:hidden text-slate-400 hover:text-white transition-colors ml-auto"
      >
        <XMarkIcon class="h-5 w-5" />
      </button>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto sidebar-scroll" :class="collapsed && !mobileOpen ? 'p-1.5' : 'p-3 space-y-1'">
      <div v-for="section in sections" :key="section.label">
        <!-- Section header (expanded mode) -->
        <button
          v-if="!collapsed || mobileOpen"
          @click="toggleSection(section.label)"
          class="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] hover:text-slate-400 transition-colors"
        >
          {{ section.label }}
          <ChevronDownIcon
            :class="[
              'h-3 w-3 transition-transform duration-200',
              openSections[section.label] ? 'rotate-0' : '-rotate-90',
            ]"
          />
        </button>

        <!-- Collapsed divider -->
        <div v-if="collapsed && !mobileOpen" class="mx-2 my-2 border-t border-[var(--sidebar-border)]" />

        <!-- Nav items -->
        <div v-show="openSections[section.label] || (collapsed && !mobileOpen)" :class="collapsed && !mobileOpen ? 'space-y-0.5' : 'space-y-0.5 mb-3'">
          <RouterLink
            v-for="item in section.items"
            :key="item.name"
            :to="item.to"
            @click="handleNavClick"
            :title="collapsed && !mobileOpen ? item.name : undefined"
            :class="[
              'flex items-center rounded-lg text-[13px] font-medium transition-all duration-150',
              collapsed && !mobileOpen ? 'justify-center p-2' : 'gap-3 px-3 py-2',
              isActiveItem(item.to)
                ? 'bg-[var(--sidebar-active)] text-white shadow-sm shadow-black/10'
                : 'text-slate-400 hover:bg-[var(--sidebar-hover)] hover:text-slate-200',
              isActiveItem(item.to) && !collapsed ? 'border-l-2 border-[var(--color-accent)] -ml-[2px]' : '',
            ]"
          >
            <component :is="item.icon" :class="collapsed && !mobileOpen ? 'h-5 w-5' : 'h-[18px] w-[18px]'" class="shrink-0" />
            <span v-if="!collapsed || mobileOpen">{{ item.name }}</span>
          </RouterLink>
        </div>
      </div>
    </nav>

    <!-- Sidebar footer -->
    <div class="border-t border-[var(--sidebar-border)]" :class="collapsed && !mobileOpen ? 'p-2' : 'p-4'">
      <!-- Theme toggle -->
      <ThemeToggle :collapsed="collapsed && !mobileOpen" />

      <!-- User info -->
      <div class="mt-2" :class="collapsed && !mobileOpen ? 'flex justify-center' : 'flex items-center justify-between'">
        <div v-if="!collapsed || mobileOpen" class="min-w-0 flex-1">
          <div class="text-sm font-medium text-white/90 truncate">{{ auth.name || auth.email }}</div>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="text-[11px] text-slate-500 truncate">{{ auth.email }}</span>
            <span
              :class="[
                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize',
                auth.role === 'admin' ? 'bg-red-500/20 text-red-300' :
                auth.role === 'editor' ? 'bg-blue-500/20 text-blue-300' :
                'bg-white/10 text-slate-400'
              ]"
            >{{ auth.role }}</span>
          </div>
        </div>
        <button
          @click="emit('logout')"
          class="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
          :class="collapsed && !mobileOpen ? '' : 'ml-2'"
          title="Logout"
        >
          <ArrowRightStartOnRectangleIcon class="h-5 w-5" />
        </button>
      </div>
    </div>
  </aside>
</template>
