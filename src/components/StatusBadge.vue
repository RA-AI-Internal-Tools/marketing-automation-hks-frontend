<script setup lang="ts">
defineProps<{ status: string }>()

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-800',
  expired: 'bg-yellow-100 text-yellow-800',
  sent: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  skipped: 'bg-gray-100 text-gray-600',
  frequency_capped: 'bg-yellow-100 text-yellow-800',
  no_consent: 'bg-orange-100 text-orange-800',
  condition_not_met: 'bg-gray-100 text-gray-600',
  up: 'bg-green-100 text-green-800',
  down: 'bg-red-100 text-red-800',
  inactive: 'bg-gray-100 text-gray-600',
  ok: 'bg-green-100 text-green-800',
  disabled: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-800',
}
</script>

<template>
  <span
    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    :class="statusColors[status] || 'bg-gray-100 text-gray-800'"
  >
    {{ status.replace(/_/g, ' ') }}
  </span>
</template>
