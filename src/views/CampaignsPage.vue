<script setup lang="ts">
import { ref, onMounted } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { fetchCampaigns } from '@/api/dashboard'
import type { CampaignDefinition } from '@/api/types'

const campaigns = ref<CampaignDefinition[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    campaigns.value = await fetchCampaigns()
  } finally {
    loading.value = false
  }
})

function formatDelay(minutes: number): string {
  if (minutes === 0) return 'Immediately'
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`
  return `${Math.round(minutes / 1440)}d`
}

const channelColors: Record<string, string> = {
  email: 'bg-blue-100 text-blue-800',
  sms: 'bg-purple-100 text-purple-800',
  whatsapp: 'bg-green-100 text-green-800',
  push: 'bg-orange-100 text-orange-800',
}
</script>

<template>
  <div>
    <PageHeader title="Campaigns" description="Campaign definitions and workflow steps" />

    <div v-if="loading" class="text-center py-12 text-gray-400">Loading campaigns...</div>

    <div v-else class="space-y-4">
      <div
        v-for="campaign in campaigns"
        :key="campaign.id"
        class="bg-white rounded-xl border border-gray-200 p-6"
      >
        <div class="flex items-start justify-between mb-4">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">{{ campaign.name }}</h3>
            <p class="text-sm text-gray-500 mt-1">
              Trigger: <code class="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{{ campaign.trigger_event }}</code>
              <span v-if="campaign.cancellation_event" class="ml-2">
                Cancel: <code class="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{{ campaign.cancellation_event }}</code>
              </span>
            </p>
          </div>
          <StatusBadge :status="campaign.is_active ? 'active' : 'expired'" />
        </div>

        <!-- Steps visualization -->
        <div class="flex items-center gap-2 overflow-x-auto pb-2">
          <div
            v-for="(step, i) in campaign.steps"
            :key="i"
            class="flex items-center gap-2 shrink-0"
          >
            <div class="border border-gray-200 rounded-lg px-3 py-2 text-center min-w-[100px]">
              <span
                class="text-xs font-medium inline-block px-1.5 py-0.5 rounded"
                :class="channelColors[step.channel] || 'bg-gray-100 text-gray-800'"
              >
                {{ step.channel }}
              </span>
              <p class="text-xs text-gray-500 mt-1">{{ formatDelay(step.delay_minutes) }}</p>
              <p class="text-xs text-gray-400 truncate max-w-[120px]" :title="step.template_key">{{ step.template_key }}</p>
            </div>
            <svg v-if="i < campaign.steps.length - 1" class="h-4 w-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        <p class="text-xs text-gray-400 mt-3">
          Segment: {{ campaign.segment_filter }} | Slug: {{ campaign.slug }}
        </p>
      </div>
    </div>
  </div>
</template>
