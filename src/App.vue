<script setup lang="ts">
import { ref } from 'vue'
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
} from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const sidebarOpen = ref(false)

const navigation = [
  { name: 'Overview', to: '/overview', icon: ChartBarIcon },
  { name: 'Campaigns', to: '/campaigns', icon: RocketLaunchIcon },
  { name: 'Templates', to: '/templates', icon: DocumentDuplicateIcon },
  { name: 'Enrollments', to: '/enrollments', icon: UsersIcon },
  { name: 'Logs', to: '/logs', icon: DocumentTextIcon },
  { name: 'Channels', to: '/channels', icon: MegaphoneIcon },
  { name: 'Consents', to: '/consents', icon: ShieldCheckIcon },
  { name: 'Health', to: '/health', icon: HeartIcon },
  { name: 'Settings', to: '/settings', icon: Cog6ToothIcon },
]

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <!-- Login page: no sidebar -->
  <RouterView v-if="route.name === 'login'" />

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
      <nav class="p-4 space-y-1 flex-1">
        <RouterLink
          v-for="item in navigation"
          :key="item.name"
          :to="item.to"
          @click="sidebarOpen = false"
          :class="[
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            route.path === item.to
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
          ]"
        >
          <component :is="item.icon" class="h-5 w-5 shrink-0" />
          {{ item.name }}
        </RouterLink>
      </nav>

      <!-- Sidebar footer: user + logout -->
      <div class="p-4 border-t border-gray-200">
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-500 truncate">{{ auth.email }}</span>
          <button
            @click="handleLogout"
            class="text-gray-400 hover:text-red-600 transition-colors"
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
