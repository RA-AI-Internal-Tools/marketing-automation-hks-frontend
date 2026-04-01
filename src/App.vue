<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDashboardStore } from '@/stores/dashboard'
import { useCampaignsStore } from '@/stores/campaigns'
import { useTemplatesStore } from '@/stores/templates'
import { useReportsStore } from '@/stores/reports'
import hksLogo from '@/assets/hks-logo.svg'
import {
  ChartBarIcon,
  RocketLaunchIcon,
  UsersIcon,
  DocumentTextIcon,
  DocumentDuplicateIcon,
  MegaphoneIcon,
  ShieldCheckIcon,
  HeartIcon,
  Cog6ToothIcon,
  Bars3Icon,
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
} from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const sidebarOpen = ref(false)

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
    label: 'Automation',
    defaultOpen: true,
    items: [
      { name: 'Overview', to: '/overview', icon: ChartBarIcon },
      { name: 'Campaigns', to: '/campaigns', icon: RocketLaunchIcon },
      { name: 'Templates', to: '/templates', icon: DocumentDuplicateIcon },
      { name: 'Enrollments', to: '/enrollments', icon: UsersIcon },
      { name: 'Logs', to: '/logs', icon: DocumentTextIcon },
    ],
  },
  {
    label: 'Analytics',
    defaultOpen: true,
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
      { name: 'Channels', to: '/channels', icon: MegaphoneIcon },
      { name: 'Consents', to: '/consents', icon: ShieldCheckIcon },
      { name: 'Health', to: '/health', icon: HeartIcon },
      { name: 'Settings', to: '/settings', icon: Cog6ToothIcon },
      { name: 'Audit Logs', to: '/audit-logs', icon: ShieldCheckIcon, adminOnly: true },
      { name: 'Users', to: '/users', icon: UserPlusIcon, adminOnly: true },
    ],
  },
]

// Filter nav items based on role
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

// Keep openSections in sync when sections change (e.g. after role changes)
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

function handleLogout() {
  useDashboardStore().$reset()
  useCampaignsStore().$reset()
  useTemplatesStore().$reset()
  useReportsStore().$reset()
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <!-- Public pages: no sidebar -->
  <RouterView v-if="route.meta.public" />

  <!-- Authenticated layout -->
  <div v-else class="min-h-screen bg-gray-50/80">
    <!-- Mobile sidebar toggle -->
    <div class="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200/80 shadow-sm px-4 py-3 flex items-center gap-3">
      <button @click="sidebarOpen = !sidebarOpen" class="text-gray-600 hover:text-gray-900 transition-colors">
        <Bars3Icon v-if="!sidebarOpen" class="h-6 w-6" />
        <XMarkIcon v-else class="h-6 w-6" />
      </button>
      <img :src="hksLogo" alt="HKS" class="h-5" />
      <span class="font-semibold text-gray-900 tracking-tight">Marketing Automation</span>
    </div>

    <!-- Sidebar overlay for mobile -->
    <div
      v-if="sidebarOpen"
      class="lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
      @click="sidebarOpen = false"
    />

    <!-- Sidebar -->
    <aside
      :class="[
        'fixed top-0 left-0 z-30 h-full w-[272px] bg-[#0a0a1a] transition-transform duration-300 ease-in-out flex flex-col',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ]"
    >
      <!-- Brand section -->
      <div class="p-6 border-b border-white/[0.08]">
        <div class="flex items-center gap-3">
          <img :src="hksLogo" alt="HKS Global" class="h-7" />
        </div>
        <p class="text-[11px] font-medium text-[#0099db] mt-2 tracking-wider uppercase">Growth Engine</p>
      </div>

      <!-- Navigation -->
      <nav class="p-3 flex-1 overflow-y-auto sidebar-scroll space-y-1">
        <div v-for="section in sections" :key="section.label">
          <button
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
          <div v-show="openSections[section.label]" class="space-y-0.5 mb-3">
            <RouterLink
              v-for="item in section.items"
              :key="item.name"
              :to="item.to"
              @click="sidebarOpen = false"
              :class="[
                'flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150',
                isActiveItem(item.to)
                  ? 'bg-white/[0.08] text-white shadow-sm shadow-black/10 border-l-2 border-[#0099db] -ml-[2px]'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
              ]"
            >
              <component :is="item.icon" class="h-[18px] w-[18px] shrink-0" />
              {{ item.name }}
            </RouterLink>
          </div>
        </div>
      </nav>

      <!-- Sidebar footer: user + logout -->
      <div class="p-4 border-t border-white/[0.08]">
        <div class="flex items-center justify-between">
          <div class="min-w-0">
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
            @click="handleLogout"
            class="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0 ml-2"
            title="Logout"
          >
            <ArrowRightStartOnRectangleIcon class="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <main class="lg:ml-[272px] pt-14 lg:pt-0">
      <div class="p-6 lg:p-8">
        <RouterView />
      </div>
    </main>
  </div>
</template>
