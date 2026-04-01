<template>
  <div class="min-h-screen bg-[var(--color-bg-page)] flex items-center justify-center px-4">
    <div class="text-center">
      <h1 class="text-6xl font-bold text-[var(--color-text-muted)] mb-4">404</h1>
      <p class="text-lg text-[var(--color-text-secondary)] mb-6">Page not found</p>
      <router-link
        to="/overview"
        class="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors"
      >
        Go to Overview
      </router-link>
    </div>
  </div>
</template>
