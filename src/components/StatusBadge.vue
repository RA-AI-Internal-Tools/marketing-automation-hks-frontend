<script setup lang="ts">
defineProps<{ status: string }>()

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  completed: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  expired: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  sent: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  failed: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  skipped: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  frequency_capped: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  no_consent: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  condition_not_met: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  up: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  down: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  ok: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  disabled: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
}

const fallback = { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' }
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
    :class="[(statusConfig[status] || fallback).bg, (statusConfig[status] || fallback).text]"
  >
    <span class="h-1.5 w-1.5 rounded-full" :class="(statusConfig[status] || fallback).dot"></span>
    {{ status.replace(/_/g, ' ') }}
  </span>
</template>
