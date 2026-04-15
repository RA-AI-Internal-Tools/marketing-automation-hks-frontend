<script setup lang="ts">
/**
 * ClientJourneyPage — unified timeline for a single customer.
 *
 * The backend (`internal/api/journey.go`) already aggregates campaign_logs +
 * Tracardi events into one touchpoints array sorted DESC by timestamp. This
 * page renders it as a vertical timeline with type-coded dots and an
 * expandable detail panel per event.
 *
 * Filtering is intentionally client-side: the dataset is capped at 100 by
 * the backend so the whole page fits comfortably in memory, and letting the
 * user flip filters without a round-trip is materially faster than the
 * "Apply" + refetch pattern the analytics pages use.
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import { fetchClientJourney, type JourneyTouchpoint } from '@/api/journey'
import { useToast } from '@/composables/useToast'
import {
  ArrowLeftIcon, PaperAirplaneIcon, HandRaisedIcon, EyeIcon, CursorArrowRaysIcon,
  ExclamationTriangleIcon, InboxIcon, QuestionMarkCircleIcon,
} from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()

const loading = ref(true)
const touchpoints = ref<JourneyTouchpoint[]>([])
const clientID = computed(() => Number(route.params.id))

// Filter state — client-side.
const typeFilter     = ref<string>('')
const channelFilter  = ref<string>('')
const campaignFilter = ref<string>('')

async function load() {
  if (!clientID.value) return
  loading.value = true
  try {
    const { touchpoints: t } = await fetchClientJourney(clientID.value, 200)
    touchpoints.value = t
  } catch {
    showToast('Failed to load journey', 'error')
  } finally {
    loading.value = false
  }
}
onMounted(load)

// Derive available filter options from the dataset so operators only see
// filters that would actually hit something.
const availableChannels = computed(() => {
  const s = new Set<string>()
  for (const t of touchpoints.value) {
    const ch = t.details?.channel
    if (typeof ch === 'string' && ch) s.add(ch)
  }
  return Array.from(s).sort()
})
const availableCampaigns = computed(() => {
  const s = new Set<string>()
  for (const t of touchpoints.value) {
    const c = t.details?.campaign_slug || t.details?.campaign
    if (typeof c === 'string' && c) s.add(c)
  }
  return Array.from(s).sort()
})

const filtered = computed<JourneyTouchpoint[]>(() => {
  return touchpoints.value.filter(t => {
    if (typeFilter.value && t.type !== typeFilter.value) return false
    if (channelFilter.value && t.details?.channel !== channelFilter.value) return false
    if (campaignFilter.value) {
      const c = t.details?.campaign_slug || t.details?.campaign
      if (c !== campaignFilter.value) return false
    }
    return true
  })
})

// Visual mapping for touchpoint type / sub-status. Icons chosen so the
// shape alone reads as a verb (arrow = send, eye = open, hand = click).
function iconFor(t: JourneyTouchpoint) {
  const status = (t.details?.status as string) || ''
  if (t.type === 'campaign_step') {
    switch (status) {
      case 'delivered':  return InboxIcon
      case 'opened':     return EyeIcon
      case 'clicked':    return CursorArrowRaysIcon
      case 'bounced':
      case 'failed':     return ExclamationTriangleIcon
      case 'complaint':  return HandRaisedIcon
      default:           return PaperAirplaneIcon
    }
  }
  return QuestionMarkCircleIcon
}

function colorFor(t: JourneyTouchpoint): string {
  const status = (t.details?.status as string) || ''
  if (t.type === 'campaign_step') {
    switch (status) {
      case 'delivered':
      case 'opened':
      case 'clicked':    return 'bg-[var(--color-success-soft)]0 border-emerald-600'
      case 'bounced':
      case 'failed':
      case 'complaint':  return 'bg-[var(--color-error-soft)]0 border-rose-600'
      case 'skipped':    return 'bg-neutral-400 border-neutral-500'
      default:           return 'bg-sky-500 border-sky-600'
    }
  }
  return 'bg-violet-500 border-violet-600'
}

function summaryLine(t: JourneyTouchpoint): string {
  const d = t.details || {}
  if (t.type === 'campaign_step') {
    const bits: string[] = []
    if (d.channel)       bits.push(String(d.channel))
    if (d.template_key)  bits.push(String(d.template_key))
    if (d.status)        bits.push(String(d.status))
    return bits.join(' · ')
  }
  if (typeof d.event_type === 'string') return d.event_type
  return t.type
}

function contextLine(t: JourneyTouchpoint): string {
  const d = t.details || {}
  const bits: string[] = []
  if (d.campaign_slug)   bits.push(`campaign: ${d.campaign_slug}`)
  if (d.error_message)   bits.push(String(d.error_message))
  return bits.join(' · ')
}

function formatDate(s: string): string {
  try { return new Date(s).toLocaleString() } catch { return s }
}
</script>

<template>
  <div class="page-enter mx-auto max-w-4xl space-y-6 p-6">
    <PageHeader
      :title="`Journey · client #${clientID}`"
      description="Unified timeline of sends, opens, clicks, and behavioural events."
    >
      <template #actions>
        <button
          @click="router.back()"
          class="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          aria-label="Go back"
        >
          <ArrowLeftIcon class="h-4 w-4" /> Back
        </button>
      </template>
    </PageHeader>

    <!-- Filter row -->
    <div class="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
      <label class="flex items-center gap-2">
        <span class="text-xs uppercase tracking-wide text-neutral-500">Type</span>
        <select v-model="typeFilter" class="rounded border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-800">
          <option value="">all</option>
          <option value="campaign_step">campaign_step</option>
          <option value="tracardi_event">tracardi_event</option>
        </select>
      </label>
      <label v-if="availableChannels.length > 0" class="flex items-center gap-2">
        <span class="text-xs uppercase tracking-wide text-neutral-500">Channel</span>
        <select v-model="channelFilter" class="rounded border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-800">
          <option value="">all</option>
          <option v-for="c in availableChannels" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>
      <label v-if="availableCampaigns.length > 0" class="flex items-center gap-2">
        <span class="text-xs uppercase tracking-wide text-neutral-500">Campaign</span>
        <select v-model="campaignFilter" class="rounded border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-800">
          <option value="">all</option>
          <option v-for="c in availableCampaigns" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>
      <span class="ml-auto text-xs text-neutral-500">
        Showing <strong>{{ filtered.length }}</strong> of {{ touchpoints.length }}
      </span>
    </div>

    <div v-if="loading" class="py-12 text-center text-sm text-neutral-500" role="status">Loading journey…</div>

    <div v-else-if="filtered.length === 0" class="rounded-lg border border-dashed border-neutral-300 py-12 text-center text-sm text-neutral-500 dark:border-neutral-700">
      No touchpoints match the current filters.
    </div>

    <ol v-else class="relative ml-3 border-l-2 border-neutral-200 pl-6 dark:border-neutral-800">
      <li v-for="(t, i) in filtered" :key="i" class="relative mb-6">
        <!-- Timeline dot -->
        <div
          class="absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full border-2 text-white shadow-sm"
          :class="colorFor(t)"
          :aria-label="t.type + ' ' + (t.details?.status || '')"
        >
          <component :is="iconFor(t)" class="h-3.5 w-3.5" />
        </div>

        <div class="rounded-md border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div class="flex items-baseline justify-between gap-3">
            <div class="font-medium">{{ summaryLine(t) }}</div>
            <time class="whitespace-nowrap text-xs text-neutral-500" :datetime="t.timestamp">{{ formatDate(t.timestamp) }}</time>
          </div>
          <div v-if="contextLine(t)" class="mt-0.5 font-mono text-xs text-neutral-600 dark:text-neutral-400">
            {{ contextLine(t) }}
          </div>
          <details class="mt-2">
            <summary class="cursor-pointer text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
              Raw details
            </summary>
            <pre class="mt-1 max-h-48 overflow-auto rounded bg-neutral-50 p-2 text-[11px] dark:bg-neutral-800">{{ JSON.stringify(t.details, null, 2) }}</pre>
          </details>
        </div>
      </li>
    </ol>
  </div>
</template>
