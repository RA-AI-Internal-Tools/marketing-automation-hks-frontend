<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
    <div class="text-center">
      <h1 class="text-6xl font-bold text-gray-300 mb-4">404</h1>
      <p class="text-lg text-gray-600 mb-6">Page not found</p>
      <router-link
        to="/overview"
        class="px-4 py-2 bg-[#020288] text-white text-sm font-medium rounded-lg hover:bg-[#0d35d7] transition-colors"
      >
        Go to Overview
      </router-link>
    </div>
  </div>
</template>
