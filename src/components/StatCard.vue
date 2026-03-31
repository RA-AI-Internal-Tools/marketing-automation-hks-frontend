<script setup lang="ts">
defineProps<{
  title: string
  value: string | number
  subtitle?: string
  color?: 'indigo' | 'green' | 'yellow' | 'red' | 'blue'
}>()

const colorClasses: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-700',
  green: 'bg-green-50 text-green-700',
  yellow: 'bg-yellow-50 text-yellow-700',
  red: 'bg-red-50 text-red-700',
  blue: 'bg-blue-50 text-blue-700',
}
</script>

<template>
  <div class="bg-white rounded-xl border border-gray-200 p-6">
    <p class="text-sm font-medium text-gray-500">{{ title }}</p>
    <p class="mt-2 text-3xl font-bold text-gray-900">{{ value }}</p>
    <p v-if="subtitle" class="mt-1 text-sm" :class="colorClasses[color || 'indigo']">
      {{ subtitle }}
    </p>
  </div>
</template>
