<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

defineProps<{
  collapsed?: boolean
}>()

const { theme, toggleTheme } = useTheme()

const themeLabel: Record<string, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}
</script>

<template>
  <button
    class="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-white/[0.04]"
    :class="{ 'justify-center': collapsed }"
    @click="toggleTheme"
    :title="collapsed ? `Theme: ${themeLabel[theme]}` : undefined"
    :aria-label="`Switch theme (current: ${themeLabel[theme]})`"
  >
    <!-- Sun icon — light mode -->
    <svg v-if="theme === 'light'" class="h-[18px] w-[18px] shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <!-- Moon icon — dark mode -->
    <svg v-else-if="theme === 'dark'" class="h-[18px] w-[18px] shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13.5 9.5a5.5 5.5 0 01-7-7A5.5 5.5 0 108 14a5.5 5.5 0 005.5-4.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <!-- Monitor icon — system mode -->
    <svg v-else class="h-[18px] w-[18px] shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5.5 14h5M8 11.5V14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <span v-if="!collapsed">{{ themeLabel[theme] }}</span>
  </button>
</template>
