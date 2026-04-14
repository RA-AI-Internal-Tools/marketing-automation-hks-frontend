<script setup lang="ts">
import type { Integration } from '@/api/types'
import type { Environment } from '@/api/integrations'
import StatusBadge from './StatusBadge.vue'
import {
  LinkIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  BellAlertIcon,
  GlobeAltIcon,
  ChartBarIcon,
  UserGroupIcon,
  PencilSquareIcon,
  LockClosedIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline'

defineProps<{
  integration: Integration
  credentialEnvironment?: Environment
  /** 'full' = all required fields stored; 'partial' = some; 'none' = none. */
  credentialStatus?: 'none' | 'partial' | 'full'
}>()

const emit = defineEmits<{
  (e: 'edit', id: number): void
}>()

const typeIcons: Record<string, any> = {
  email: EnvelopeIcon,
  sms: DevicePhoneMobileIcon,
  push: BellAlertIcon,
  webhook: GlobeAltIcon,
  crm: UserGroupIcon,
  analytics: ChartBarIcon,
  infrastructure: LinkIcon,
}

const typeLabels: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  push: 'Push',
  webhook: 'Webhook',
  crm: 'CRM',
  analytics: 'Analytics',
  infrastructure: 'Infrastructure',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function maskEndpointUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.hostname}${u.port ? ':' + u.port : ''}/***`
  } catch {
    return url.length > 35 ? url.slice(0, 35) + '…' : url
  }
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
        class="p-1.5 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] focus-visible:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40 transition-colors"
        title="Edit integration"
        aria-label="Edit integration"
      >
        <PencilSquareIcon class="h-4 w-4" />
      </button>
    </div>

    <!-- Status badge -->
    <div class="flex items-center gap-2 mb-3 flex-wrap">
      <StatusBadge :status="integration.status" />
      <span
        v-if="credentialStatus === 'full' && credentialEnvironment"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-bg-subtle)] text-[var(--color-text-tertiary)] border border-[var(--color-border)]"
        :title="`Credentials stored for ${credentialEnvironment}`"
      >
        <LockClosedIcon class="h-3 w-3" />
        Configured ({{ credentialEnvironment }})
      </span>
      <span
        v-else-if="credentialStatus === 'partial' && credentialEnvironment"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border border-[var(--color-warning-border)]"
        :title="`Some required credential fields are missing for ${credentialEnvironment}`"
      >
        <ExclamationTriangleIcon class="h-3 w-3" />
        Partial ({{ credentialEnvironment }})
      </span>
    </div>

    <!-- Details -->
    <div class="space-y-1.5 text-xs text-[var(--color-text-tertiary)]">
      <div v-if="integration.endpoint_url" class="truncate" title="Click Edit to view full connection details">
        {{ maskEndpointUrl(integration.endpoint_url) }}
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

  </div>
</template>
