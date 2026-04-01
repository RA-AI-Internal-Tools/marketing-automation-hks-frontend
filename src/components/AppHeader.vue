<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Bars3Icon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '@heroicons/vue/24/outline'
import EnvironmentSwitcher from './EnvironmentSwitcher.vue'
import EnvironmentBadge from './EnvironmentBadge.vue'
import ThemeToggle from './ThemeToggle.vue'
import hksLogo from '@/assets/hks-logo.svg'

const props = defineProps<{
  sidebarCollapsed: boolean
  sidebarOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-sidebar'): void
  (e: 'toggle-mobile'): void
}>()

const route = useRoute()

const pageTitle = computed(() => {
  return (route.meta?.title as string) || route.name?.toString() || ''
})
</script>

<template>
  <!-- Desktop header -->
  <header
    class="hidden lg:flex fixed top-0 right-0 z-[var(--z-header)] h-14 items-center justify-between px-6 border-b border-[var(--color-border)] bg-[var(--color-bg-card)]/95 backdrop-blur-md layout-transition"
    :style="{ left: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)' }"
  >
    <div class="flex items-center gap-3">
      <button
        @click="emit('toggle-sidebar')"
        class="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)] transition-colors"
        :title="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      >
        <ChevronDoubleRightIcon v-if="sidebarCollapsed" class="h-4 w-4" />
        <ChevronDoubleLeftIcon v-else class="h-4 w-4" />
      </button>
      <h1 class="text-sm font-semibold text-[var(--color-text-primary)] tracking-tight">{{ pageTitle }}</h1>
    </div>
    <div class="flex items-center gap-4">
      <EnvironmentSwitcher />
      <EnvironmentBadge />
    </div>
  </header>

  <!-- Mobile header -->
  <header class="lg:hidden fixed top-0 left-0 right-0 z-[var(--z-header)] bg-[var(--color-bg-card)]/95 backdrop-blur-md border-b border-[var(--color-border)] shadow-sm px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <button @click="emit('toggle-mobile')" class="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">
        <Bars3Icon class="h-6 w-6" />
      </button>
      <img :src="hksLogo" alt="HKS" class="h-5" />
      <span class="font-semibold text-[var(--color-text-primary)] tracking-tight text-sm">Marketing Automation</span>
    </div>
    <div class="flex items-center gap-2">
      <EnvironmentBadge compact />
    </div>
  </header>
</template>
