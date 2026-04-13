<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import CampaignSimulateModal from '@/components/CampaignSimulateModal.vue'
import AIJourneyAssistModal from '@/components/AIJourneyAssistModal.vue'
import { useCampaignsStore } from '@/stores/campaigns'
import type { Step, StepVariant, CampaignRequest } from '@/api/types'
import { useTemplatesStore } from '@/stores/templates'
import { PlusIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, BeakerIcon, SparklesIcon } from '@heroicons/vue/24/outline'
import { fetchAIStatus, type SuggestedStep } from '@/api/ai'

const route = useRoute()
const router = useRouter()
const store = useCampaignsStore()

const templatesStore = useTemplatesStore()

const isEdit = computed(() => !!route.params.id)
const campaignId = computed(() => Number(route.params.id))

const name = ref('')
const slug = ref('')
const triggerEvent = ref('')
const cancellationEvent = ref('')
const segmentFilter = ref('all')
const isActive = ref(true)
// Phase 3 — Send Time Optimization. When true, 0-delay sends defer to
// the recipient's next optimal hour (from client_send_preferences,
// refreshed nightly). Only meaningful on steps with DelayMinutes = 0;
// deliberately not a per-step toggle — same campaign either uses STO
// end-to-end or it doesn't, to keep author UX focused.
const useSTO = ref(false)

// Simulate modal open state. Only reachable in edit mode (unsaved
// campaigns don't yet have an id to simulate against).
const simulateOpen = ref(false)

// AI assist: gated on a one-time status probe so the buttons stay hidden
// when OPENAI_API_KEY isn't configured on the server. Failure = disabled
// (fail-closed on the UI).
const aiOpen = ref(false)
const aiEnabled = ref(false)
fetchAIStatus().then(s => { aiEnabled.value = !!s.enabled }).catch(() => {})

function applyAIJourney(aiSteps: SuggestedStep[]) {
  // Replace the current steps array with the AI suggestion. Operator
  // can still tune each step in the editor; we don't auto-activate.
  steps.value = aiSteps.map(s => ({
    delay_minutes: s.delay_minutes || 0,
    channel: s.channel || 'email',
    template_key: s.template_key || '',
    condition: s.condition || 'always_true',
    condition_params: {},
  }))
}

// Phase 5.1 — per-campaign quiet hours. Stored as an object in the
// editor; serialised only at save time, and only when both start+end
// are filled. Absent fields = no override, block sent as null.
const quietHours = ref<{ start: string; end: string; timezone: string }>({
  start: '', end: '', timezone: 'UTC',
})
const commonTimezones = [
  'UTC', 'Europe/London', 'Europe/Paris', 'Europe/Istanbul',
  'America/New_York', 'America/Los_Angeles', 'America/Sao_Paulo',
  'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
]
const steps = ref<Step[]>([{ delay_minutes: 0, channel: 'email', template_key: '', condition: 'always_true', condition_params: {} }])

const saving = ref(false)
const error = ref('')
const loading = ref(false)
const nextVariantId = ref(0)

const channels = ['email', 'sms', 'whatsapp', 'push']
// Keep this list in lockstep with internal/condition/condition.go's
// Registry. A stale option here would render in the dropdown but fail at
// runtime with "unknown condition: X".
const conditions = [
  'always_true',
  'no_purchase_since_enrollment',
  'kyc_not_completed',
  'no_order_in_days',
  'message_opened',
  'message_clicked',
  'cart_value_gte',
  'cart_value_lte',
  'viewed_product_category',
  'viewed_product_count_gte',
  'cart_contains_category',
  'rfm_segment',
]
// Segments loaded dynamically from the backend. 'all' is the universal
// implicit bucket and always first — the stored list contains only
// operator-managed segments (includes RFM categories once the nightly
// job populates client_rfm_scores).
//
// Fallback list used if the fetch fails — matches the slugs the seeded
// segments carry so a transient API hiccup still produces a usable
// editor. Fetched list overwrites on success.
const FALLBACK_SEGMENTS = ['all','high_value','new_user','dormant','at_risk','loyal','churned','vip']
const segments = ref<string[]>([...FALLBACK_SEGMENTS])
// Fire once — the segments catalogue rarely changes mid-session.
import('@/api/client').then(async ({ default: api }) => {
  try {
    const { data } = await api.get<Array<{ slug: string }>>('/api/segments')
    const slugs = Array.isArray(data) ? data.map(s => s.slug).filter(Boolean) : []
    if (slugs.length) segments.value = ['all', ...slugs]
  } catch { /* stay on fallback */ }
})

// Locale variants use a "key.locale" suffix (e.g. welcome.ar-iq). The MA
// executor resolves them per-recipient at send time, so campaign steps
// should reference the BASE key — otherwise a step is pinned to one locale.
// This regex mirrors internal/locale/resolver.go TemplateCandidates.
const LOCALE_SUFFIX_RE = /\.([a-z]{2}(-[a-z]{2})?)$/i
function stripLocaleSuffix(key: string): string {
  return key.replace(LOCALE_SUFFIX_RE, '')
}

function templatesForChannel(ch: string) {
  const all = templatesStore.templates.filter((t) => t.channel === ch)
  // Collect the set of base keys present (templates without a locale suffix).
  const baseKeys = new Set(
    all.filter((t) => !LOCALE_SUFFIX_RE.test(t.template_key)).map((t) => t.template_key),
  )
  // Hide locale variants when their base key also exists — authors should
  // pick the base and let the engine resolve the variant. If only variants
  // exist (no base), keep them visible so the user isn't stuck.
  return all.filter((t) => {
    const base = stripLocaleSuffix(t.template_key)
    if (base === t.template_key) return true
    return !baseKeys.has(base)
  })
}

onMounted(async () => {
  templatesStore.load()
  if (isEdit.value) {
    loading.value = true
    try {
      const campaign = await store.get(campaignId.value)
      name.value = campaign.name
      slug.value = campaign.slug
      triggerEvent.value = campaign.trigger_event
      cancellationEvent.value = campaign.cancellation_event || ''
      segmentFilter.value = campaign.segment_filter
      isActive.value = campaign.is_active
      useSTO.value = (campaign as any).use_sto === true
      const qh = (campaign as any).quiet_hours
      if (qh && typeof qh === 'object') {
        quietHours.value = {
          start: qh.start || '',
          end: qh.end || '',
          timezone: qh.timezone || 'UTC',
        }
      }
      steps.value = campaign.steps.length > 0 ? campaign.steps : [{ delay_minutes: 0, channel: 'email', template_key: '', condition: 'always_true' }]
    } catch {
      error.value = 'Failed to load campaign'
    } finally {
      loading.value = false
    }
  } else {
    // New campaign — check for deep-link seeds from e.g. the RFMPage's
    // "Create campaign for segment" CTA. A ?rfm_segment= query param
    // pre-fills the first step's condition so the flow is one click
    // shorter for the operator.
    const rfmSeg = route.query.rfm_segment as string | undefined
    if (rfmSeg && steps.value[0]) {
      steps.value[0].condition = 'rfm_segment'
      steps.value[0].condition_params = { segment: rfmSeg }
      // Hint the operator in the campaign name too — purely a starting
      // point, fully editable.
      if (!name.value) name.value = `RFM — ${rfmSeg}`
    }
  }
})

function addStep() {
  steps.value.push({ delay_minutes: 0, channel: 'email', template_key: '', condition: 'always_true' })
}

function removeStep(index: number) {
  steps.value.splice(index, 1)
  // Remap branch references in all remaining steps
  for (const s of steps.value) {
    for (const field of ['true_next', 'false_next'] as const) {
      const val = s[field]
      if (val == null || val === -1) continue
      if (val === index) {
        // Referenced the removed step — reset to sequential
        s[field] = null
      } else if (val > index) {
        // Decrement indices above the removed step
        s[field] = val - 1
      }
    }
  }
}

function moveStep(index: number, direction: number) {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= steps.value.length) return
  const arr: Step[] = [...steps.value]
  const item = arr[index]!
  arr.splice(index, 1)
  arr.splice(newIndex, 0, item)
  // Remap branch references: index and newIndex were swapped
  for (const s of arr) {
    for (const field of ['true_next', 'false_next'] as const) {
      const val = s[field]
      if (val == null || val === -1) continue
      if (val === index) {
        s[field] = newIndex
      } else if (val === newIndex) {
        s[field] = index
      }
    }
  }
  steps.value = arr
}

function stepTargetOptions(allSteps: Step[], currentIndex: number) {
  const options: { label: string; value: number | null }[] = [
    { label: 'Next step (sequential)', value: null },
  ]
  for (let j = 0; j < allSteps.length; j++) {
    if (j === currentIndex) continue
    const s = allSteps[j]!
    options.push({
      label: `Step ${j + 1}: ${s.channel} — ${s.template_key || '(no template)'}`,
      value: j,
    })
  }
  options.push({ label: 'Complete campaign', value: -1 })
  return options
}

function hasBranchableCondition(step: Step): boolean {
  return !!step.condition && step.condition !== 'always' && step.condition !== 'always_true'
}

function isBranchingEnabled(step: Step): boolean {
  return step.true_next !== undefined || step.false_next !== undefined
}

function toggleBranching(step: Step, enabled: boolean) {
  if (enabled) {
    step.true_next = null
    step.false_next = null
  } else {
    step.true_next = undefined
    step.false_next = undefined
  }
}

function setBranchTarget(step: Step, field: 'true_next' | 'false_next', value: string) {
  step[field] = value === '' ? null : Number(value)
}

function addVariant(stepIndex: number) {
  if (!steps.value[stepIndex]!.variants) {
    steps.value[stepIndex]!.variants = []
  }
  const id = String.fromCharCode(65 + nextVariantId.value)
  nextVariantId.value++
  steps.value[stepIndex]!.variants!.push({
    id,
    template_key: '',
    weight: 50,
  })
}

function removeVariant(stepIndex: number, variantIndex: number) {
  steps.value[stepIndex]!.variants!.splice(variantIndex, 1)
  if (steps.value[stepIndex]!.variants!.length === 0) {
    steps.value[stepIndex]!.variants = undefined
  }
}

// Sum of variant weights on a step. Used by both the template hint row
// (shown on save) and the form guard below.
function variantWeightSum(step: Step): number {
  if (!step.variants || step.variants.length === 0) return 100
  return step.variants.reduce((acc, v) => acc + (Number(v.weight) || 0), 0)
}

async function handleSubmit() {
  error.value = ''

  // Validate steps before submitting
  for (let i = 0; i < steps.value.length; i++) {
    const step = steps.value[i]!
    if (!step.template_key || step.template_key.trim() === '') {
      error.value = `Step ${i + 1}: Template key is required`
      return
    }
    if (step.delay_minutes < 0) {
      error.value = `Step ${i + 1}: Delay must be non-negative`
      return
    }
    // A/B variant weights MUST sum to 100. Prior builds silently accepted
    // weights that didn't — the executor then under-/over-dispatched one
    // variant because the weighted-random formula assumed 100 as the total.
    if (step.variants && step.variants.length > 0) {
      const sum = variantWeightSum(step)
      if (sum !== 100) {
        error.value = `Step ${i + 1}: A/B variant weights must sum to 100 (currently ${sum}). ` +
          `Adjust the weights on each variant to total exactly 100.`
        return
      }
      for (let v = 0; v < step.variants.length; v++) {
        const variant = step.variants[v]!
        if (!variant.template_key || variant.template_key.trim() === '') {
          error.value = `Step ${i + 1}, variant ${variant.id || v + 1}: template key is required`
          return
        }
      }
    }
  }

  saving.value = true
  try {
    const req: CampaignRequest = {
      name: name.value,
      slug: slug.value || undefined,
      trigger_event: triggerEvent.value,
      steps: steps.value,
      segment_filter: segmentFilter.value,
      cancellation_event: cancellationEvent.value || null,
      is_active: isActive.value,
      use_sto: useSTO.value,
      quiet_hours: (quietHours.value.start && quietHours.value.end)
        ? quietHours.value
        : undefined,
    }

    if (isEdit.value) {
      await store.update(campaignId.value, req)
    } else {
      await store.create(req)
    }
    router.push('/campaigns')
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to save campaign'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader
      :title="isEdit ? 'Edit Campaign' : 'New Campaign'"
      :description="isEdit ? 'Modify campaign configuration and steps' : 'Create a new campaign workflow'"
    >
      <template #actions>
        <button v-if="aiEnabled" type="button" @click="aiOpen = true"
                class="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
          <SparklesIcon class="h-4 w-4 text-ma-accent" aria-hidden="true" /> AI assist
        </button>
        <button v-if="isEdit" type="button" @click="simulateOpen = true"
                class="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
          <BeakerIcon class="h-4 w-4" aria-hidden="true" /> Simulate
        </button>
      </template>
    </PageHeader>

    <CampaignSimulateModal
      v-if="isEdit"
      :open="simulateOpen"
      :campaign-id="campaignId"
      @update:open="simulateOpen = $event"
    />
    <AIJourneyAssistModal
      :open="aiOpen"
      @update:open="aiOpen = $event"
      @apply="applyAIJourney"
    />

    <div v-if="loading" class="space-y-6 max-w-3xl">
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6 space-y-4">
        <div class="skeleton h-4 w-32"></div>
        <div class="grid grid-cols-2 gap-4"><div class="skeleton h-9 w-full"></div><div class="skeleton h-9 w-full"></div></div>
      </div>
    </div>

    <form v-else @submit.prevent="handleSubmit" class="space-y-6 max-w-3xl page-enter">
      <!-- Basic info -->
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6 space-y-4">
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)]">Campaign Details</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Name</label>
            <input v-model="name" required class="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[#0099db]" />
          </div>
          <div>
            <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Slug (auto-generated if empty)</label>
            <input v-model="slug" class="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[#0099db]" placeholder="auto-generated" />
          </div>
          <div>
            <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Trigger Event</label>
            <input v-model="triggerEvent" required class="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[#0099db]" placeholder="e.g. order_completed" />
          </div>
          <div>
            <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Cancellation Event</label>
            <input v-model="cancellationEvent" class="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[#0099db]" placeholder="Optional" />
          </div>
          <div>
            <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Segment Filter</label>
            <select v-model="segmentFilter" class="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[#0099db]">
              <option v-for="seg in segments" :key="seg" :value="seg">{{ seg }}</option>
            </select>
          </div>
          <div class="flex items-center gap-3 pt-6">
            <label class="relative inline-flex items-center cursor-pointer">
              <input v-model="isActive" type="checkbox" class="sr-only peer" aria-label="Campaign active" />
              <div class="w-9 h-5 bg-[var(--color-border)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-accent)]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[var(--color-primary)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </label>
            <span class="text-sm text-[var(--color-text-secondary)]">Active</span>
          </div>
        </div>

        <!-- Send Time Optimization toggle — spans full width under the grid
             so the explanatory text has room to breathe. -->
        <div class="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3">
          <label class="flex items-start gap-3 cursor-pointer">
            <span class="relative inline-flex items-center mt-0.5">
              <input v-model="useSTO" type="checkbox" class="sr-only peer" aria-label="Send Time Optimization" />
              <span class="w-9 h-5 bg-[var(--color-border)] peer-focus:ring-2 peer-focus:ring-[var(--color-accent)]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[var(--color-primary)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></span>
            </span>
            <span class="flex-1">
              <span class="block text-sm font-medium text-[var(--color-text-primary)]">Send Time Optimization</span>
              <span class="mt-0.5 block text-xs text-[var(--color-text-tertiary)]">
                When enabled, 0-delay steps are delivered at each recipient's optimal engagement hour based on their historical open patterns. Recipients with &lt; 10 sends fall through to immediate delivery.
              </span>
            </span>
          </label>
        </div>

        <!-- Quiet hours — per-campaign override. Leave blank to defer to the
             global policy configured in Settings. -->
        <div class="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-sm font-medium text-[var(--color-text-primary)]">Quiet hours</span>
            <span class="text-[11px] text-[var(--color-text-tertiary)]">Leave empty to use the global policy</span>
          </div>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label class="block">
              <span class="block text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Start</span>
              <input v-model="quietHours.start" type="time"
                     class="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1.5 font-mono text-sm" />
            </label>
            <label class="block">
              <span class="block text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">End</span>
              <input v-model="quietHours.end" type="time"
                     class="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1.5 font-mono text-sm" />
            </label>
            <label class="block">
              <span class="block text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Timezone</span>
              <select v-model="quietHours.timezone"
                      class="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1.5 text-sm">
                <option v-for="tz in commonTimezones" :key="tz" :value="tz">{{ tz }}</option>
              </select>
            </label>
          </div>
          <p class="mt-2 text-xs text-[var(--color-text-tertiary)]">
            Messages scheduled during this window are held until the window ends — not dropped.
            Cross-midnight ranges supported (e.g. 22:00 → 08:00).
          </p>
        </div>
      </div>

      <!-- Steps -->
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-[var(--color-text-primary)]">Workflow Steps</h3>
          <button type="button" @click="addStep" class="flex items-center gap-1 text-sm text-[#020288] hover:text-[#0d35d7]">
            <PlusIcon class="h-4 w-4" /> Add Step
          </button>
        </div>
        <p class="text-[11px] text-[var(--color-text-muted)] -mt-2">
          Pick the <strong>base template key</strong> for each step. At send time the engine resolves the recipient's locale
          and tries <code class="px-1 py-[1px] rounded bg-[var(--color-bg-muted)]">key.ar-iq</code>
          → <code class="px-1 py-[1px] rounded bg-[var(--color-bg-muted)]">key.ar</code>
          → <code class="px-1 py-[1px] rounded bg-[var(--color-bg-muted)]">key</code>.
          WhatsApp is special: the base key is always used and the language is passed to Meta as a separate field.
        </p>

        <div v-for="(step, i) in steps" :key="i" class="border border-[var(--color-border)] rounded-lg p-4 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-[var(--color-text-tertiary)]">Step {{ i + 1 }}</span>
            <div class="flex items-center gap-1">
              <button type="button" @click="moveStep(i, -1)" :disabled="i === 0" class="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] disabled:opacity-30">
                <ArrowUpIcon class="h-4 w-4" />
              </button>
              <button type="button" @click="moveStep(i, 1)" :disabled="i === steps.length - 1" class="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] disabled:opacity-30">
                <ArrowDownIcon class="h-4 w-4" />
              </button>
              <button type="button" @click="removeStep(i)" :disabled="steps.length <= 1" class="p-1 text-[var(--color-text-muted)] hover:text-red-600 disabled:opacity-30">
                <TrashIcon class="h-4 w-4" />
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label class="block text-xs text-[var(--color-text-tertiary)] mb-1">Channel</label>
              <select v-model="step.channel" class="w-full px-2 py-1.5 border border-[var(--color-border)] rounded text-sm">
                <option v-for="ch in channels" :key="ch" :value="ch">{{ ch }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-[var(--color-text-tertiary)] mb-1">Template Key</label>
              <select
                v-if="templatesForChannel(step.channel).length > 0"
                v-model="step.template_key"
                class="w-full px-2 py-1.5 border border-[var(--color-border)] rounded text-sm"
              >
                <option value="">Select template...</option>
                <option v-for="t in templatesForChannel(step.channel)" :key="t.id" :value="t.template_key">
                  {{ t.name }} ({{ t.template_key }})
                </option>
              </select>
              <input v-else v-model="step.template_key" class="w-full px-2 py-1.5 border border-[var(--color-border)] rounded text-sm" placeholder="template_key" />
            </div>
            <div>
              <label class="block text-xs text-[var(--color-text-tertiary)] mb-1">Delay (minutes)</label>
              <input v-model.number="step.delay_minutes" type="number" min="0" class="w-full px-2 py-1.5 border border-[var(--color-border)] rounded text-sm" />
            </div>
            <div>
              <label class="block text-xs text-[var(--color-text-tertiary)] mb-1">Condition</label>
              <select v-model="step.condition" class="w-full px-2 py-1.5 border border-[var(--color-border)] rounded text-sm">
                <option v-for="cond in conditions" :key="cond" :value="cond">{{ cond }}</option>
              </select>
            </div>
          </div>

          <!-- A/B Variant Editor -->
          <div class="mt-3 border-t border-[var(--color-border-muted)] pt-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium text-[var(--color-text-tertiary)] flex items-center gap-1">
                <BeakerIcon class="h-3.5 w-3.5" /> A/B Variants
                <!-- Live weight-sum badge: green at 100, red otherwise. -->
                <span
                  v-if="step.variants && step.variants.length > 0"
                  class="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium"
                  :class="variantWeightSum(step) === 100
                    ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)]'
                    : 'bg-[var(--color-error-bg)] text-[var(--color-error-text)] border border-[var(--color-error-border)]'"
                  :title="variantWeightSum(step) === 100 ? 'Weights sum to 100' : 'Weights must sum to 100 before save'"
                >
                  Σ {{ variantWeightSum(step) }}
                </span>
              </span>
              <button type="button" @click="addVariant(i)" class="text-xs text-[#020288] hover:text-[#0d35d7]">
                + Add Variant
              </button>
            </div>
            <div v-if="!step.variants || step.variants.length === 0" class="text-xs text-[var(--color-text-muted)] italic">
              No variants configured. Default template will be used.
            </div>
            <div v-else class="space-y-2">
              <div v-for="(variant, vi) in step.variants" :key="vi" class="flex items-center gap-2 bg-[var(--color-bg-page)] rounded-lg px-3 py-2">
                <span class="text-xs font-bold text-[#020288] w-6">{{ variant.id }}</span>
                <div class="flex-1">
                  <select
                    v-if="templatesForChannel(step.channel).length > 0"
                    v-model="variant.template_key"
                    class="w-full px-2 py-1 border border-[var(--color-border)] rounded text-xs"
                  >
                    <option value="">Select template...</option>
                    <option v-for="t in templatesForChannel(step.channel)" :key="t.id" :value="t.template_key">
                      {{ t.name }} ({{ t.template_key }})
                    </option>
                  </select>
                  <input v-else v-model="variant.template_key" class="w-full px-2 py-1 border border-[var(--color-border)] rounded text-xs" placeholder="template_key" />
                </div>
                <div class="w-20">
                  <input v-model.number="variant.weight" type="number" min="1" max="100" class="w-full px-2 py-1 border border-[var(--color-border)] rounded text-xs text-center" />
                </div>
                <span class="text-[10px] text-[var(--color-text-muted)] w-4">%</span>
                <button type="button" @click="removeVariant(i, vi)" class="text-[var(--color-text-muted)] hover:text-red-500">
                  <TrashIcon class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <!-- If/Else Branching -->
          <div v-if="hasBranchableCondition(step)" class="mt-3 border-t border-[var(--color-border-muted)] pt-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium text-[var(--color-text-tertiary)]">If/Else Branching</span>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  :checked="isBranchingEnabled(step)"
                  class="sr-only peer"
                  @change="toggleBranching(step, !isBranchingEnabled(step))"
                />
                <div class="w-8 h-4 bg-[var(--color-border)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-accent)]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[var(--color-primary)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all"></div>
              </label>
            </div>
            <div v-if="isBranchingEnabled(step)" class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-[var(--color-text-tertiary)] mb-1">If TRUE &rarr; go to</label>
                <select
                  :value="step.true_next === null || step.true_next === undefined ? '' : String(step.true_next)"
                  class="w-full px-2 py-1.5 border border-[var(--color-border)] rounded text-sm"
                  @change="setBranchTarget(step, 'true_next', ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="opt in stepTargetOptions(steps, i)" :key="String(opt.value)" :value="opt.value === null ? '' : String(opt.value)">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-[var(--color-text-tertiary)] mb-1">If FALSE &rarr; go to</label>
                <select
                  :value="step.false_next === null || step.false_next === undefined ? '' : String(step.false_next)"
                  class="w-full px-2 py-1.5 border border-[var(--color-border)] rounded text-sm"
                  @change="setBranchTarget(step, 'false_next', ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="opt in stepTargetOptions(steps, i)" :key="String(opt.value)" :value="opt.value === null ? '' : String(opt.value)">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Error + Submit -->
      <div v-if="error" class="text-sm text-[var(--color-error-text)] bg-[var(--color-error-bg)] border border-[var(--color-error-border)] px-4 py-3 rounded-xl">{{ error }}</div>

      <div class="flex items-center gap-3">
        <button
          type="submit"
          :disabled="saving"
          class="px-6 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-hover)] shadow-sm disabled:opacity-50 transition-all"
        >
          {{ saving ? 'Saving...' : isEdit ? 'Update Campaign' : 'Create Campaign' }}
        </button>
        <button
          type="button"
          @click="router.push('/campaigns')"
          class="px-6 py-2.5 bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] text-sm font-medium rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-page)] transition-colors"
        >
          Cancel
        </button>
        <button
          v-if="isEdit"
          type="button"
          @click="router.push(`/campaigns/${route.params.id}/builder`)"
          class="ml-auto px-4 py-2.5 bg-[var(--color-bg-card)] text-[var(--color-text-primary)] text-sm font-medium rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-page)] transition-colors"
          title="Open visual flow preview"
        >
          View flow →
        </button>
      </div>
    </form>
  </div>
</template>
