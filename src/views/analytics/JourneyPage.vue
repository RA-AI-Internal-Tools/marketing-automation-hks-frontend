<script setup lang="ts">
import { ref } from 'vue'
import AnalyticsLayout from '@/components/AnalyticsLayout.vue'
import { fetchClientJourney } from '@/api/dashboard'

const clientId = ref('')
const data = ref<any>(null)
const loading = ref(false)
const error = ref('')

const typeBadge: Record<string, string> = {
  campaign: 'bg-[var(--color-info-soft)] text-[var(--color-info-text)]',
  event: 'bg-purple-50 text-purple-700',
  email: 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]',
  sms: 'bg-orange-50 text-[var(--color-warning-text)]',
  push: 'bg-pink-50 text-pink-700',
}

const statusBadge: Record<string, string> = {
  sent: 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]',
  delivered: 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]',
  opened: 'bg-[var(--color-info-soft)] text-[var(--color-info-text)]',
  clicked: 'bg-[var(--color-info-soft)] text-[var(--color-info-text)]',
  failed: 'bg-[var(--color-error-soft)] text-[var(--color-error-text)]',
  pending: 'bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]',
  completed: 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]',
  cancelled: 'bg-[var(--color-bg-page)] text-[var(--color-text-secondary)]',
}

async function load() {
  const id = parseInt(clientId.value, 10)
  if (!id || isNaN(id)) {
    error.value = 'Please enter a valid client ID'
    return
  }
  loading.value = true
  error.value = ''
  data.value = null
  try {
    data.value = await fetchClientJourney(id)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load journey data'
  } finally {
    loading.value = false
  }
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleString()
}
</script>

<template>
  <AnalyticsLayout title="Customer Journey" description="Timeline view of individual customer touchpoints">
    <div class="space-y-6">
      <!-- Search -->
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Lookup Client</h3>
        <form @submit.prevent="load" class="flex gap-3">
          <input
            v-model="clientId"
            type="text"
            placeholder="Enter client ID"
            class="flex-1 max-w-xs px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
          />
          <button
            type="submit"
            :disabled="loading"
            class="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
          >
            {{ loading ? 'Loading...' : 'View Journey' }}
          </button>
        </form>
      </div>

      <div v-if="error" class="bg-[var(--color-error-bg)] border border-[var(--color-error-border)] text-[var(--color-error-text)] px-4 py-3 rounded-lg text-sm">{{ error }}</div>

      <div v-if="loading" class="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>

      <!-- Timeline -->
      <div v-else-if="data?.touchpoints?.length" class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Journey Timeline</h3>
        <div class="relative pl-6 border-l-2 border-[var(--color-border)] space-y-4">
          <div v-for="(tp, i) in data.touchpoints" :key="i" class="relative">
            <!-- Dot -->
            <div class="absolute -left-[25px] top-1 w-3 h-3 rounded-full border-2 border-[var(--color-border)] bg-[var(--color-bg-card)]"></div>
            <div class="flex flex-wrap items-center gap-2 mb-1">
              <span class="text-xs text-[var(--color-text-muted)]">{{ formatTime(tp.timestamp) }}</span>
              <span class="inline-block px-2 py-0.5 rounded text-xs font-medium" :class="typeBadge[tp.type] || 'bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)]'">
                {{ tp.type }}
              </span>
              <span v-if="tp.status" class="inline-block px-2 py-0.5 rounded text-xs font-medium" :class="statusBadge[tp.status] || 'bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)]'">
                {{ tp.status }}
              </span>
            </div>
            <p class="text-sm text-[var(--color-text-secondary)]">{{ tp.details || tp.description || tp.event_type || '-' }}</p>
          </div>
        </div>
      </div>

      <div v-else-if="data && !data.touchpoints?.length" class="text-center py-12">
        <p class="text-sm text-[var(--color-text-muted)]">No touchpoints found for this client.</p>
      </div>
    </div>
  </AnalyticsLayout>
</template>
