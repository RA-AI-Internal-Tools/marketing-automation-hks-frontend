<script setup lang="ts">
import DateRangePicker from './DateRangePicker.vue'
import PageHeader from './PageHeader.vue'

defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="page-enter">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <PageHeader :title="title" :description="description" />
      <DateRangePicker />
    </div>
    <slot />
  </div>
</template>
