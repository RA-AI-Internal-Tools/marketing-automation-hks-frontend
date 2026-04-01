<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useDashboardStore } from '@/stores/dashboard'
import { useCampaignsStore } from '@/stores/campaigns'
import { useTemplatesStore } from '@/stores/templates'
import { useReportsStore } from '@/stores/reports'
import { useEnvironmentStore } from '@/stores/environment'
import { useIntegrationsStore } from '@/stores/integrations'
import AppSidebar from '@/components/AppSidebar.vue'
import AppHeader from '@/components/AppHeader.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// Sidebar state
const SIDEBAR_KEY = 'ma_sidebar_collapsed'
const sidebarCollapsed = ref(localStorage.getItem(SIDEBAR_KEY) === 'true')
const sidebarMobileOpen = ref(false)

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  try { localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed.value)) } catch {}
}

function toggleMobile() {
  sidebarMobileOpen.value = !sidebarMobileOpen.value
}

function closeMobile() {
  sidebarMobileOpen.value = false
}

// Main content margin
const mainMarginClass = computed(() =>
  sidebarCollapsed.value ? 'lg:ml-[var(--sidebar-collapsed-width)]' : 'lg:ml-[var(--sidebar-width)]',
)

const { toasts, removeToast } = useToast()

function handleLogout() {
  useDashboardStore().$reset()
  useCampaignsStore().$reset()
  useTemplatesStore().$reset()
  useReportsStore().$reset()
  useEnvironmentStore().$reset()
  useIntegrationsStore().$reset()
  sidebarCollapsed.value = false
  sidebarMobileOpen.value = false
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <!-- Toast notifications -->
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[var(--z-toast)] flex flex-col gap-2 pointer-events-none">
      <Transition
        v-for="toast in toasts"
        :key="toast.id"
        appear
        enter-active-class="duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-2 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0 translate-x-8"
      >
        <div
          :class="[
            'pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium backdrop-blur-md max-w-sm',
            toast.type === 'success' ? 'bg-emerald-600 text-white' :
            toast.type === 'error' ? 'bg-red-600 text-white' :
            toast.type === 'warning' ? 'bg-amber-500 text-white' :
            'bg-gray-800 text-white'
          ]"
        >
          <span class="flex-1">{{ toast.message }}</span>
          <button @click="removeToast(toast.id)" class="opacity-70 hover:opacity-100 text-lg leading-none">&times;</button>
        </div>
      </Transition>
    </div>
  </Teleport>

  <!-- Public pages: no sidebar -->
  <RouterView v-if="route.meta.public" />

  <!-- Authenticated layout -->
  <div v-else class="min-h-screen bg-[var(--color-bg-page)]">
    <!-- Sidebar -->
    <AppSidebar
      :collapsed="sidebarCollapsed"
      :mobile-open="sidebarMobileOpen"
      @toggle-sidebar="toggleSidebar"
      @close-mobile="closeMobile"
      @logout="handleLogout"
    />

    <!-- Header -->
    <AppHeader
      :sidebar-collapsed="sidebarCollapsed"
      :sidebar-open="sidebarMobileOpen"
      @toggle-sidebar="toggleSidebar"
      @toggle-mobile="toggleMobile"
    />

    <!-- Main content -->
    <main
      class="layout-transition pt-14"
      :class="mainMarginClass"
    >
      <div class="p-4 sm:p-6 lg:p-8">
        <RouterView />
      </div>
    </main>
  </div>
</template>
