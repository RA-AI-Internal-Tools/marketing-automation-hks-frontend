<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import { useCampaignsStore } from '@/stores/campaigns'
import type { Step, StepVariant, CampaignRequest } from '@/api/types'
import { useTemplatesStore } from '@/stores/templates'
import { PlusIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, BeakerIcon } from '@heroicons/vue/24/outline'

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
const steps = ref<Step[]>([{ delay_minutes: 0, channel: 'email', template_key: '', condition: 'always', condition_params: {} }])

const saving = ref(false)
const error = ref('')
const loading = ref(false)
const nextVariantId = ref(0)

const channels = ['email', 'sms', 'whatsapp', 'push']
const conditions = ['always', 'has_ordered_since', 'not_ordered_since', 'kyc_level_gte', 'spend_gte']
const segments = ['all', 'high_value', 'new_user', 'dormant']

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
      steps.value = campaign.steps.length > 0 ? campaign.steps : [{ delay_minutes: 0, channel: 'email', template_key: '', condition: 'always' }]
    } catch {
      error.value = 'Failed to load campaign'
    } finally {
      loading.value = false
    }
  }
})

function addStep() {
  steps.value.push({ delay_minutes: 0, channel: 'email', template_key: '', condition: 'always' })
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
              <input v-model="isActive" type="checkbox" class="sr-only peer" />
              <div class="w-9 h-5 bg-[var(--color-border)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-accent)]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[var(--color-primary)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </label>
            <span class="text-sm text-[var(--color-text-secondary)]">Active</span>
          </div>
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
      </div>
    </form>
  </div>
</template>
