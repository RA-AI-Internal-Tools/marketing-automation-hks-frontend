<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { fetchHealth } from '@/api/dashboard'
import type { HealthCheck } from '@/api/types'

const health = ref<HealthCheck | null>(null)
const loading = ref(true)
const lastChecked = ref('')
const error = ref('')

let interval: ReturnType<typeof setInterval>

async function checkHealth() {
  try {
    health.value = await fetchHealth()
    lastChecked.value = new Date().toLocaleTimeString()
    error.value = ''
  } catch (e: any) {
    error.value = 'Service unreachable'
    health.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  checkHealth()
  interval = setInterval(checkHealth, 15000)
})

onUnmounted(() => clearInterval(interval))

function normalizeHealthStatus(status: string | undefined): string {
  if (!status) return 'unknown'
  if (status === 'ok') return 'up'
  return status
}

const serviceGroups = computed(() => [
  {
    title: 'Core Infrastructure',
    description: 'Dependencies required for the service to run at all.',
    items: [
      { key: 'postgres', name: 'PostgreSQL', description: 'Campaign data, enrollments, logs, consents' },
      { key: 'redis', name: 'Redis', description: 'Frequency caps, caches, deduplication support' },
      { key: 'nats', name: 'NATS', description: 'Event bus for trigger and cancellation workflows' },
    ],
  },
  {
    title: 'Analytics & CDP',
    description: 'Systems powering analytics and Tracardi-driven enrichment.',
    items: [
      { key: 'tracardi', name: 'Tracardi Analytics', description: 'Executive, funnel, user, product, and acquisition analytics source' },
      { key: 'tracardi_segment_tagger', name: 'Tracardi Segment Tagger', description: 'Scheduled segment-tagging flow for dormant / at-risk profiles' },
    ],
  },
  {
    title: 'Delivery Providers',
    description: 'Optional third-party systems used for outbound messaging when configured.',
    items: [
      { key: 'elastic_email', name: 'Elastic Email', description: 'Transactional and campaign email delivery provider' },
      { key: 'plivo', name: 'Plivo', description: 'SMS delivery provider' },
      { key: 'meta_whatsapp', name: 'Meta WhatsApp', description: 'WhatsApp template/message delivery via Meta Cloud API' },
      { key: 'fcm', name: 'Firebase Cloud Messaging', description: 'Push notification delivery provider' },
    ],
  },
])
</script>

<template>
  <div class="page-enter">
    <PageHeader title="Health Monitor" description="Real-time infrastructure and integration health status" />

    <div v-if="loading" class="text-center py-12 text-[var(--color-text-muted)]">Checking health...</div>

    <template v-else>
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6 mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div
              :class="[
                'h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold',
                health?.status === 'ok' ? 'bg-green-100 text-green-700' : error ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700',
              ]"
            >
              {{ health?.status === 'ok' ? '\u2713' : error ? '\u2715' : '!' }}
            </div>
            <div>
              <h2 class="text-xl font-bold text-[var(--color-text-primary)]">
                {{ error ? 'Unreachable' : health?.status === 'ok' ? 'All Core Systems Operational' : 'Degraded Performance' }}
              </h2>
              <p class="text-sm text-[var(--color-text-tertiary)]">Last checked: {{ lastChecked }}</p>
            </div>
          </div>
          <button
            @click="checkHealth"
            class="px-4 py-2 bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] text-sm font-medium rounded-lg hover:bg-[var(--color-bg-hover)]"
          >
            Refresh
          </button>
        </div>
      </div>

      <div v-if="health" class="space-y-6">
        <section
          v-for="group in serviceGroups"
          :key="group.title"
          class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6"
        >
          <div class="mb-4">
            <h3 class="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">{{ group.title }}</h3>
            <p class="text-sm text-[var(--color-text-tertiary)] mt-1">{{ group.description }}</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div
              v-for="svc in group.items"
              :key="svc.key"
              class="bg-[var(--color-bg-page)] rounded-xl border border-[var(--color-border)] p-5"
            >
              <div class="flex items-center justify-between mb-3 gap-3">
                <h4 class="text-base font-semibold tracking-tight text-[var(--color-text-primary)]">{{ svc.name }}</h4>
                <StatusBadge :status="normalizeHealthStatus((health.checks as any)[svc.key])" />
              </div>
              <p class="text-sm text-[var(--color-text-tertiary)]">{{ svc.description }}</p>
            </div>
          </div>
        </section>
      </div>

      <p v-if="error" class="mt-6 text-center text-red-600">{{ error }}</p>
    </template>
  </div>
</template>
