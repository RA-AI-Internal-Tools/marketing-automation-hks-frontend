<script setup lang="ts">
import type { Integration } from '@/api/types'
import {
  LinkIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  BellAlertIcon,
  GlobeAltIcon,
  ChartBarIcon,
  UserGroupIcon,
  ArrowPathIcon,
  PencilSquareIcon,
} from '@heroicons/vue/24/outline'

const props = defineProps<{
  integration: Integration
  testing?: boolean
}>()

const emit = defineEmits<{
  (e: 'edit', id: number): void
  (e: 'test', id: number): void
}>()

const typeIcons: Record<string, any> = {
  email: EnvelopeIcon,
  sms: DevicePhoneMobileIcon,
  push: BellAlertIcon,
  webhook: GlobeAltIcon,
  crm: UserGroupIcon,
  analytics: ChartBarIcon,
}

const statusConfig: Record<string, { label: string; colorClass: string; dotClass: string }> = {
  connected: { label: 'Connected', colorClass: 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)]', dotClass: 'bg-[var(--color-success)]' },
  not_configured: { label: 'Not Configured', colorClass: 'bg-[var(--color-bg-subtle)] text-[var(--color-text-tertiary)] border border-[var(--color-border)]', dotClass: 'bg-[var(--color-text-muted)]' },
  error: { label: 'Error', colorClass: 'bg-[var(--color-error-bg)] text-[var(--color-error-text)] border border-[var(--color-error-border)]', dotClass: 'bg-[var(--color-error)]' },
  disabled: { label: 'Disabled', colorClass: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border border-[var(--color-warning-border)]', dotClass: 'bg-[var(--color-warning)]' },
}

const typeLabels: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  push: 'Push',
  webhook: 'Webhook',
  crm: 'CRM',
  analytics: 'Analytics',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function handleTest() {
  emit('test', props.integration.id)
}
</script>

<template>
  <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-5 card-interactive group">
    <div class="flex items-start justify-between mb-4">
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center h-10 w-10 rounded-lg bg-[var(--color-primary-light)] text-[var(--color-primary)]">
          <component :is="typeIcons[integration.provider_type] || LinkIcon" class="h-5 w-5" />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-[var(--color-text-primary)]">{{ integration.name }}</h3>
          <span class="text-xs text-[var(--color-text-tertiary)]">{{ typeLabels[integration.provider_type] || integration.provider_type }}</span>
        </div>
      </div>
      <button
        @click="emit('edit', integration.id)"
        class="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-all"
        title="Edit integration"
      >
        <PencilSquareIcon class="h-4 w-4" />
      </button>
    </div>

    <!-- Status badge -->
    <div class="flex items-center gap-2 mb-3">
      <span
        :class="['inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium', statusConfig[integration.status]?.colorClass]"
      >
        <span :class="['h-1.5 w-1.5 rounded-full', statusConfig[integration.status]?.dotClass]"></span>
        {{ statusConfig[integration.status]?.label || integration.status }}
      </span>
    </div>

    <!-- Details -->
    <div class="space-y-1.5 text-xs text-[var(--color-text-tertiary)]">
      <div v-if="integration.endpoint_url" class="truncate" :title="integration.endpoint_url">
        {{ integration.endpoint_url }}
      </div>
      <div class="flex items-center justify-between">
        <span>Updated {{ formatDate(integration.updated_at) }}</span>
        <span v-if="integration.last_tested_at" class="flex items-center gap-1">
          <span :class="integration.last_test_success ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'">
            {{ integration.last_test_success ? 'Test passed' : 'Test failed' }}
          </span>
        </span>
      </div>
    </div>

    <!-- Actions -->
    <div class="mt-4 pt-3 border-t border-[var(--color-border-muted)] flex items-center gap-2">
      <button
        @click="handleTest"
        :disabled="testing || integration.status === 'not_configured'"
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary-light)] rounded-lg hover:bg-[var(--color-primary-soft)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ArrowPathIcon :class="['h-3.5 w-3.5', testing ? 'animate-spin' : '']" />
        {{ testing ? 'Testing...' : 'Test Connection' }}
      </button>
    </div>
  </div>
</template>
