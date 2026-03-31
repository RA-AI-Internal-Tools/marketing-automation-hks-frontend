<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useCampaignsStore } from '@/stores/campaigns'
import { PlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/vue/24/outline'

const router = useRouter()
const store = useCampaignsStore()

onMounted(() => store.load())

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

async function handleToggle(id: number) {
  await store.toggle(id)
}

async function handleDelete(id: number, name: string) {
  if (!confirm(`Delete campaign "${name}"? This cannot be undone.`)) return
  try {
    await store.remove(id)
  } catch (e: any) {
    alert(e.response?.data?.error || 'Failed to delete campaign')
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <PageHeader title="Campaigns" description="Campaign definitions and workflow steps" />
      <button
        @click="router.push('/campaigns/new')"
        class="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
      >
        <PlusIcon class="h-4 w-4" /> New Campaign
      </button>
    </div>

    <div v-if="store.loading" class="text-center py-12 text-gray-400">Loading campaigns...</div>

    <div v-else-if="store.campaigns.length === 0" class="text-center py-12 text-gray-400">
      No campaigns yet. Create your first campaign to get started.
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="campaign in store.campaigns"
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
          <div class="flex items-center gap-3">
            <!-- Toggle switch -->
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                :checked="campaign.is_active"
                @change="handleToggle(campaign.id)"
                class="sr-only peer"
              />
              <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </label>
            <StatusBadge :status="campaign.is_active ? 'active' : 'expired'" />
            <button
              @click="router.push(`/campaigns/${campaign.id}/edit`)"
              class="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors"
              title="Edit"
            >
              <PencilSquareIcon class="h-4 w-4" />
            </button>
            <button
              @click="handleDelete(campaign.id, campaign.name)"
              class="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
              title="Delete"
            >
              <TrashIcon class="h-4 w-4" />
            </button>
          </div>
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
