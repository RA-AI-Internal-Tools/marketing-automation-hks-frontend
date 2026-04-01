<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
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

function normalizeHealthStatus(status: string): string {
  if (status === 'ok') return 'up'
  return status
}

const services = [
  { key: 'postgres', name: 'PostgreSQL', description: 'Campaign data, enrollments, logs, consents' },
  { key: 'redis', name: 'Redis', description: 'Frequency cap sorted sets, NATS deduplication' },
  { key: 'nats', name: 'NATS', description: 'Event bus (campaign.trigger, campaign.cancel)' },
]
</script>

<template>
  <div class="page-enter">
    <PageHeader title="Health Monitor" description="Real-time infrastructure health status" />

    <div v-if="loading" class="text-center py-12 text-gray-400">Checking health...</div>

    <template v-else>
      <!-- Overall status -->
      <div class="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 mb-6">
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
              <h2 class="text-xl font-bold text-gray-900">
                {{ error ? 'Unreachable' : health?.status === 'ok' ? 'All Systems Operational' : 'Degraded Performance' }}
              </h2>
              <p class="text-sm text-gray-500">Last checked: {{ lastChecked }}</p>
            </div>
          </div>
          <button
            @click="checkHealth"
            class="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
          >
            Refresh
          </button>
        </div>
      </div>

      <!-- Service cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4" v-if="health">
        <div
          v-for="svc in services"
          :key="svc.key"
          class="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6"
        >
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-semibold tracking-tight text-gray-900">{{ svc.name }}</h3>
            <StatusBadge :status="normalizeHealthStatus((health.checks as any)[svc.key])" />
          </div>
          <p class="text-sm text-gray-500">{{ svc.description }}</p>
        </div>
      </div>

      <p v-if="error" class="mt-6 text-center text-red-600">{{ error }}</p>
    </template>
  </div>
</template>
