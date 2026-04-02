<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useCampaignsStore } from '@/stores/campaigns'
import { useAuthStore } from '@/stores/auth'
import { PlusIcon, PencilSquareIcon, TrashIcon, RocketLaunchIcon } from '@heroicons/vue/24/outline'

const router = useRouter()
const store = useCampaignsStore()
const auth = useAuthStore()

onMounted(() => store.load())

function formatDelay(minutes: number): string {
  if (minutes === 0) return 'Immediately'
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`
  return `${Math.round(minutes / 1440)}d`
}

const channelColors: Record<string, string> = {
  email: 'bg-blue-50 text-blue-700',
  sms: 'bg-purple-50 text-purple-700',
  whatsapp: 'bg-emerald-50 text-emerald-700',
  push: 'bg-orange-50 text-orange-700',
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
  <div class="page-enter">
    <div class="flex items-center justify-between mb-6">
      <PageHeader title="Campaigns" description="Campaign definitions and workflow steps" />
      <button
        v-if="auth.canWrite"
        @click="router.push('/campaigns/new')"
        class="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-hover)] shadow-sm transition-all"
      >
        <PlusIcon class="h-4 w-4" /> New Campaign
      </button>
    </div>

    <!-- Skeleton loading -->
    <div v-if="store.loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
        <div class="flex items-start justify-between mb-4">
          <div class="space-y-2">
            <div class="skeleton h-5 w-48"></div>
            <div class="skeleton h-3.5 w-72"></div>
          </div>
          <div class="skeleton h-6 w-16 rounded-full"></div>
        </div>
        <div class="flex gap-2">
          <div v-for="j in 3" :key="j" class="skeleton h-16 w-28 rounded-lg"></div>
        </div>
      </div>
    </div>

    <div v-else-if="store.campaigns.length === 0" class="text-center py-16">
      <div class="text-[var(--color-text-muted)] mb-3">
        <RocketLaunchIcon class="h-12 w-12 mx-auto" />
      </div>
      <p class="text-[var(--color-text-tertiary)] font-medium">No campaigns yet</p>
      <p class="text-sm text-[var(--color-text-muted)] mt-1">Create your first campaign to get started.</p>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="campaign in store.campaigns"
        :key="campaign.id"
        class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6 card-interactive"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div class="min-w-0">
            <h3 class="text-lg font-semibold tracking-tight text-[var(--color-text-primary)] break-words">{{ campaign.name }}</h3>
            <div class="text-sm text-[var(--color-text-tertiary)] mt-1 flex flex-wrap items-center gap-2">
              <span>Trigger:</span>
              <code class="bg-[var(--color-bg-subtle)] px-1.5 py-0.5 rounded text-xs font-mono break-all">{{ campaign.trigger_event }}</code>
              <template v-if="campaign.cancellation_event">
                <span class="sm:ml-2">Cancel:</span>
                <code class="bg-[var(--color-bg-subtle)] px-1.5 py-0.5 rounded text-xs font-mono break-all">{{ campaign.cancellation_event }}</code>
              </template>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-3 sm:justify-end">
            <!-- Toggle switch -->
            <label v-if="auth.canWrite" class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                :checked="campaign.is_active"
                @change="handleToggle(campaign.id)"
                class="sr-only peer"
              />
              <div class="w-9 h-5 bg-[var(--color-border)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-accent)]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[var(--color-primary)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </label>
            <StatusBadge :status="campaign.is_active ? 'active' : 'inactive'" />
            <button
              v-if="auth.canWrite"
              @click="router.push(`/campaigns/${campaign.id}/edit`)"
              class="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
              title="Edit"
            >
              <PencilSquareIcon class="h-4 w-4" />
            </button>
            <button
              v-if="auth.canWrite"
              @click="handleDelete(campaign.id, campaign.name)"
              class="p-1.5 text-[var(--color-text-muted)] hover:text-red-600 transition-colors"
              title="Delete"
            >
              <TrashIcon class="h-4 w-4" />
            </button>
          </div>
        </div>

        <!-- Steps visualization -->
        <div class="flex items-start gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          <div
            v-for="(step, i) in campaign.steps"
            :key="i"
            class="flex items-center gap-2 shrink-0"
          >
            <div class="border border-[var(--color-border)] rounded-lg px-2.5 py-2 text-center min-w-[96px] sm:min-w-[100px] max-w-[140px] bg-[var(--color-bg-page)]">
              <span
                class="text-xs font-medium inline-block px-1.5 py-0.5 rounded"
                :class="channelColors[step.channel] || 'bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)]'"
              >
                {{ step.channel }}
              </span>
              <p class="text-xs text-[var(--color-text-tertiary)] mt-1">{{ formatDelay(step.delay_minutes) }}</p>
              <p class="text-xs text-[var(--color-text-muted)] truncate max-w-[120px]" :title="step.template_key">{{ step.template_key }}</p>
            </div>
            <svg v-if="i < campaign.steps.length - 1" class="h-4 w-4 text-[var(--color-text-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        <p class="text-xs text-[var(--color-text-muted)] mt-3">
          Segment: {{ campaign.segment_filter }} | Slug: {{ campaign.slug }}
        </p>
      </div>
    </div>
  </div>
</template>
