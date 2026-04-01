<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
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
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <!-- Public pages: no sidebar -->
  <RouterView v-if="route.meta.public" />

  <!-- Authenticated layout -->
  <div v-else class="min-h-screen bg-gray-50">
    <!-- Mobile sidebar toggle -->
    <div class="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
      <button @click="sidebarOpen = !sidebarOpen" class="text-gray-600 hover:text-gray-900">
        <Bars3Icon v-if="!sidebarOpen" class="h-6 w-6" />
        <XMarkIcon v-else class="h-6 w-6" />
      </button>
      <span class="font-semibold text-gray-900">Marketing Automation</span>
    </div>

    <!-- Sidebar overlay for mobile -->
    <div
      v-if="sidebarOpen"
      class="lg:hidden fixed inset-0 z-30 bg-black/50"
      @click="sidebarOpen = false"
    />

    <!-- Sidebar -->
    <aside
      :class="[
        'fixed top-0 left-0 z-30 h-full w-64 bg-white border-r border-gray-200 transition-transform duration-200 flex flex-col',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ]"
    >
      <div class="p-6 border-b border-gray-200">
        <h1 class="text-lg font-bold text-gray-900">Marketing Automation</h1>
        <p class="text-xs text-gray-500 mt-1">DueGate Campaign Engine</p>
      </div>
      <nav class="p-3 flex-1 overflow-y-auto space-y-1">
        <div v-for="section in sections" :key="section.label">
          <button
            @click="toggleSection(section.label)"
            class="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600"
          >
            {{ section.label }}
            <ChevronDownIcon
              :class="[
                'h-3.5 w-3.5 transition-transform duration-200',
                openSections[section.label] ? 'rotate-0' : '-rotate-90',
              ]"
            />
          </button>
          <div v-show="openSections[section.label]" class="space-y-0.5 mb-2">
            <RouterLink
              v-for="item in section.items"
              :key="item.name"
              :to="item.to"
              @click="sidebarOpen = false"
              :class="[
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActiveItem(item.to)
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              ]"
            >
              <component :is="item.icon" class="h-5 w-5 shrink-0" />
              {{ item.name }}
            </RouterLink>
          </div>
        </div>
      </nav>

      <!-- Sidebar footer: user + logout -->
      <div class="p-4 border-t border-gray-200">
        <div class="flex items-center justify-between">
          <div class="min-w-0">
            <div class="text-sm font-medium text-gray-900 truncate">{{ auth.name || auth.email }}</div>
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-gray-500 truncate">{{ auth.email }}</span>
              <span
                :class="[
                  'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium capitalize',
                  auth.role === 'admin' ? 'bg-red-100 text-red-700' :
                  auth.role === 'editor' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                ]"
              >{{ auth.role }}</span>
            </div>
          </div>
          <button
            @click="handleLogout"
            class="text-gray-400 hover:text-red-600 transition-colors flex-shrink-0 ml-2"
            title="Logout"
          >
            <ArrowRightStartOnRectangleIcon class="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <main class="lg:ml-64 pt-14 lg:pt-0">
      <div class="p-6 lg:p-8">
        <RouterView />
      </div>
    </main>
  </div>
</template>
