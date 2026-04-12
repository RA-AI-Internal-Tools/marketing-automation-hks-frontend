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
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import ProductionGuard from '@/components/ProductionGuard.vue'

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
    <div class="ma-toast-stack">
      <Transition
        v-for="toast in toasts"
        :key="toast.id"
        appear
        enter-active-class="duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-2 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0 translate-x-4"
      >
        <div class="ma-toast" :data-type="toast.type">
          <span class="ma-toast-accent" />
          <span class="ma-toast-kicker">
            {{ toast.type === 'success' ? 'Done' : toast.type === 'error' ? 'Error' : toast.type === 'warning' ? 'Heads up' : 'Note' }}
          </span>
          <span class="ma-toast-body">{{ toast.message }}</span>
          <button @click="removeToast(toast.id)" class="ma-toast-close" aria-label="Dismiss">×</button>
        </div>
      </Transition>
    </div>
  </Teleport>

  <!-- Global production guard (store-driven, for router-level protection) -->
  <ProductionGuard />

  <ErrorBoundary>
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
  </ErrorBoundary>
</template>

<style>
/* Editorial toast chrome — hairline border, small-caps kicker, left rule accent */
.ma-toast-stack {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}
.ma-toast {
  position: relative;
  pointer-events: auto;
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  align-items: center;
  gap: 10px;
  min-width: 280px;
  max-width: 420px;
  padding: 12px 14px 12px 18px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 12px 36px rgba(15, 23, 42, 0.18);
  font-family: var(--font-sans);
  overflow: hidden;
}
.ma-toast-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--color-text-muted);
}
.ma-toast[data-type="success"] .ma-toast-accent { background: var(--color-success); }
.ma-toast[data-type="error"]   .ma-toast-accent { background: var(--color-error); }
.ma-toast[data-type="warning"] .ma-toast-accent { background: var(--color-warning); }
.ma-toast[data-type="info"]    .ma-toast-accent { background: var(--hks-cyan); }

.ma-toast-kicker {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  padding-right: 10px;
  border-right: 1px solid var(--color-border);
}
.ma-toast[data-type="success"] .ma-toast-kicker { color: var(--color-success); }
.ma-toast[data-type="error"]   .ma-toast-kicker { color: var(--color-error); }
.ma-toast[data-type="warning"] .ma-toast-kicker { color: var(--color-warning); }

.ma-toast-body {
  font-size: 13px;
  color: var(--color-text-primary);
  font-weight: 450;
  line-height: 1.4;
}
.ma-toast-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 16px;
  line-height: 1;
  color: var(--color-text-muted);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast);
}
.ma-toast-close:hover { color: var(--color-text-primary); background: var(--color-bg-muted); }
</style>

