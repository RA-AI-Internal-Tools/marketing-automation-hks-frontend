<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useAuthStore } from '@/stores/auth'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  LockClosedIcon,
  PlayIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/vue/24/outline'
import {
  fetchSegments,
  createSegment,
  updateSegment,
  deleteSegment,
  evaluateSegment,
  evaluateAllSegments,
} from '@/api/dashboard'
import type { Segment, SegmentRequest } from '@/api/types'

const router = useRouter()
const auth = useAuthStore()

const loading = ref(true)
const segments = ref<Segment[]>([])
const showModal = ref(false)
const saving = ref(false)
const evaluating = ref<string | null>(null)
const evaluatingAll = ref(false)
const editingSlug = ref<string | null>(null)
const eventInput = ref('')

const ruleTypes = [
  { value: 'last_order_days', label: 'Last Order Days' },
  { value: 'order_count', label: 'Order Count' },
  { value: 'total_spend', label: 'Total Spend' },
  { value: 'avg_order_value', label: 'Avg Order Value' },
  { value: 'account_age_days', label: 'Account Age Days' },
  { value: 'all', label: 'All (Match Everyone)' },
]

const operators = [
  { value: 'gt', label: '> Greater than' },
  { value: 'gte', label: '>= Greater or equal' },
  { value: 'lt', label: '< Less than' },
  { value: 'lte', label: '<= Less or equal' },
  { value: 'eq', label: '= Equal' },
  { value: 'between', label: 'Between' },
]

const defaultForm: SegmentRequest = {
  name: '',
  slug: '',
  description: '',
  rule_type: 'last_order_days',
  operator: 'gt',
  threshold_min: 0,
  threshold_max: undefined,
  entry_events: [],
  is_active: true,
  sync_to_tracardi: false,
  tracardi_event_type: '',
}

const form = ref<SegmentRequest>({ ...defaultForm })

const isBetween = computed(() => form.value.operator === 'between')

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

watch(() => form.value.name, (name) => {
  if (!editingSlug.value) {
    form.value.slug = slugify(name)
  }
})

async function load() {
  loading.value = true
  try {
    segments.value = await fetchSegments()
  } catch (e: any) {
    console.error('Failed to load segments', e)
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openCreate() {
  editingSlug.value = null
  form.value = { ...defaultForm, entry_events: [] }
  showModal.value = true
}

function openEdit(segment: Segment) {
  editingSlug.value = segment.slug
  form.value = {
    name: segment.name,
    slug: segment.slug,
    description: segment.description || '',
    rule_type: segment.rule_type,
    operator: segment.operator,
    threshold_min: segment.threshold_min,
    threshold_max: segment.threshold_max,
    entry_events: [...segment.entry_events],
    is_active: segment.is_active,
    sync_to_tracardi: segment.sync_to_tracardi,
    tracardi_event_type: segment.tracardi_event_type || '',
  }
  showModal.value = true
}

async function handleSave() {
  saving.value = true
  try {
    const payload = { ...form.value }
    if (payload.operator !== 'between') {
      payload.threshold_max = undefined
    }
    if (!payload.sync_to_tracardi) {
      payload.tracardi_event_type = undefined
    }
    if (editingSlug.value) {
      await updateSegment(editingSlug.value, payload)
    } else {
      await createSegment(payload)
    }
    showModal.value = false
    await load()
  } catch (e: any) {
    alert(e.response?.data?.error || 'Failed to save segment')
  } finally {
    saving.value = false
  }
}

async function handleDelete(slug: string, name: string) {
  if (!confirm(`Delete segment "${name}"? This cannot be undone.`)) return
  try {
    await deleteSegment(slug)
    await load()
  } catch (e: any) {
    alert(e.response?.data?.error || 'Failed to delete segment')
  }
}

async function handleEvaluate(slug: string) {
  evaluating.value = slug
  try {
    const result = await evaluateSegment(slug)
    alert(`Evaluation complete: ${result.evaluated} members evaluated.`)
    await load()
  } catch (e: any) {
    alert(e.response?.data?.error || 'Failed to evaluate segment')
  } finally {
    evaluating.value = null
  }
}

async function handleEvaluateAll() {
  evaluatingAll.value = true
  try {
    const result = await evaluateAllSegments()
    alert(`All segments evaluated: ${result.clients_evaluated} clients across ${result.segments_evaluated} segments.`)
    await load()
  } catch (e: any) {
    alert(e.response?.data?.error || 'Failed to evaluate all segments')
  } finally {
    evaluatingAll.value = false
  }
}

function addEvent() {
  const val = eventInput.value.trim()
  if (val && !form.value.entry_events.includes(val)) {
    form.value.entry_events.push(val)
  }
  eventInput.value = ''
}

function removeEvent(event: string) {
  form.value.entry_events = form.value.entry_events.filter(e => e !== event)
}

function handleEventKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    addEvent()
  }
}

function formatOperator(op: string): string {
  const map: Record<string, string> = { gt: '>', gte: '>=', lt: '<', lte: '<=', eq: '=', between: 'between' }
  return map[op] || op
}

function formatThreshold(segment: Segment): string {
  if (segment.operator === 'between') {
    return `${segment.threshold_min} - ${segment.threshold_max ?? '?'}`
  }
  return `${formatOperator(segment.operator)} ${segment.threshold_min}`
}
</script>

<template>
  <div class="page-enter">
    <div class="flex items-center justify-between mb-6">
      <PageHeader title="Segments" description="Define audience segments by behavioral rules" />
      <div class="flex items-center gap-2">
        <button
          v-if="auth.canWrite"
          @click="handleEvaluateAll"
          :disabled="evaluatingAll"
          class="flex items-center gap-2 px-4 py-2.5 border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm font-medium rounded-lg hover:bg-[var(--color-bg-subtle)] disabled:opacity-50 transition-all"
        >
          <PlayIcon class="h-4 w-4" /> {{ evaluatingAll ? 'Evaluating...' : 'Evaluate All' }}
        </button>
        <button
          v-if="auth.canWrite"
          @click="openCreate"
          class="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-hover)] shadow-sm transition-all"
        >
          <PlusIcon class="h-4 w-4" /> New Segment
        </button>
      </div>
    </div>

    <!-- Column guide -->
    <div class="bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded-xl p-4 mb-6 text-sm text-[var(--color-text-secondary)]">
      <details>
        <summary class="cursor-pointer font-semibold text-[var(--color-text-primary)] select-none">How segments work</summary>
        <div class="mt-3 space-y-2">
          <p>Segments group customers by behavioral rules. When a campaign uses a segment filter, only customers who qualify at enrollment time are entered into the campaign.</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            <div><span class="font-medium text-[var(--color-text-primary)]">Rule Type</span> &mdash; What customer data to evaluate: days since last order, total order count, lifetime spend, average order value, or account age.</div>
            <div><span class="font-medium text-[var(--color-text-primary)]">Thresholds</span> &mdash; The comparison value. E.g. <code class="bg-[var(--color-bg-card)] px-1 rounded text-xs">> 30</code> means "more than 30 days" or <code class="bg-[var(--color-bg-card)] px-1 rounded text-xs">2 &ndash; 4</code> means "between 2 and 4 orders".</div>
            <div><span class="font-medium text-[var(--color-text-primary)]">Entry Events</span> &mdash; Which customer events trigger re-evaluation. When <code class="bg-[var(--color-bg-card)] px-1 rounded text-xs">order-completed</code> fires, the system checks if the customer now enters or exits this segment.</div>
            <div><span class="font-medium text-[var(--color-text-primary)]">Tracardi</span> &mdash; <span class="text-green-600 font-medium">Connected</span> means thresholds sync to Tracardi for profile tagging. <span class="text-[var(--color-text-muted)]">--</span> means MA-only, not synced.</div>
            <div><span class="font-medium text-[var(--color-text-primary)]">Members</span> &mdash; Current count of customers in this segment. Updates when entry events fire or when you click the evaluate button.</div>
            <div><span class="font-medium text-[var(--color-text-primary)]">Actions</span> &mdash; <span class="font-medium">Play</span> = manually evaluate all customers now. <span class="font-medium">Edit</span> = change rules, thresholds, or Tracardi sync settings. Built-in segments (lock icon) can be edited but not deleted.</div>
          </div>
        </div>
      </details>
    </div>

    <!-- Skeleton loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-5">
        <div class="flex items-center gap-4">
          <div class="skeleton h-5 w-40"></div>
          <div class="skeleton h-4 w-24"></div>
          <div class="skeleton h-4 w-20"></div>
          <div class="flex-1"></div>
          <div class="skeleton h-6 w-16 rounded-full"></div>
        </div>
      </div>
    </div>

    <div v-else-if="segments.length === 0" class="text-center py-16">
      <div class="text-[var(--color-text-muted)] mb-3">
        <AdjustmentsHorizontalIcon class="h-12 w-12 mx-auto" />
      </div>
      <p class="text-[var(--color-text-tertiary)] font-medium">No segments yet</p>
      <p class="text-sm text-[var(--color-text-muted)] mt-1">Create your first segment to start grouping your audience.</p>
    </div>

    <!-- Segments table -->
    <div v-else class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
              <th class="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Name</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Slug</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Rule Type</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Thresholds</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Entry Events</th>
              <th class="text-right px-4 py-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Members</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Tracardi</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Active</th>
              <th class="text-right px-4 py-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="segment in segments"
              :key="segment.id"
              class="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-subtle)]/50 transition-colors"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <LockClosedIcon v-if="segment.is_built_in" class="h-4 w-4 text-[var(--color-text-muted)]" title="Built-in segment" />
                  <router-link
                    :to="`/segments/${segment.slug}`"
                    class="font-medium text-[var(--color-text-primary)] hover:text-[var(--color-primary)] transition-colors"
                  >
                    {{ segment.name }}
                  </router-link>
                </div>
              </td>
              <td class="px-4 py-3">
                <code class="bg-[var(--color-bg-subtle)] px-1.5 py-0.5 rounded text-xs font-mono text-[var(--color-text-tertiary)]">{{ segment.slug }}</code>
              </td>
              <td class="px-4 py-3 text-[var(--color-text-secondary)]">
                {{ segment.rule_type.replace(/_/g, ' ') }}
              </td>
              <td class="px-4 py-3 text-[var(--color-text-secondary)] font-mono text-xs">
                {{ formatThreshold(segment) }}
              </td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="evt in segment.entry_events"
                    :key="evt"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-info-bg)] text-[var(--color-info-text)]"
                  >
                    {{ evt }}
                  </span>
                  <span v-if="segment.entry_events.length === 0" class="text-[var(--color-text-muted)] text-xs">--</span>
                </div>
              </td>
              <td class="px-4 py-3 text-right font-semibold text-[var(--color-text-primary)]">
                {{ (segment.member_count ?? 0).toLocaleString() }}
              </td>
              <td class="px-4 py-3 text-center">
                <StatusBadge v-if="segment.sync_to_tracardi" status="connected" />
                <span v-else class="text-[var(--color-text-muted)] text-xs">--</span>
              </td>
              <td class="px-4 py-3 text-center">
                <StatusBadge :status="segment.is_active ? 'active' : 'inactive'" />
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-1">
                  <button
                    @click="handleEvaluate(segment.slug)"
                    :disabled="evaluating === segment.slug"
                    class="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-50"
                    title="Evaluate"
                  >
                    <PlayIcon class="h-4 w-4" :class="{ 'animate-spin': evaluating === segment.slug }" />
                  </button>
                  <button
                    v-if="auth.canWrite"
                    @click="openEdit(segment)"
                    class="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                    title="Edit"
                  >
                    <PencilSquareIcon class="h-4 w-4" />
                  </button>
                  <button
                    v-if="auth.canWrite && !segment.is_built_in"
                    @click="handleDelete(segment.slug, segment.name)"
                    class="p-1.5 text-[var(--color-text-muted)] hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <TrashIcon class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create / Edit Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm" @click="showModal = false" />
        <div class="relative bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4 p-6">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-lg font-semibold text-[var(--color-text-primary)]">
              {{ editingSlug ? 'Edit Segment' : 'New Segment' }}
            </h2>
            <button @click="showModal = false" class="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <form @submit.prevent="handleSave" class="space-y-4">
            <!-- Name -->
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Name</label>
              <input
                v-model="form.name"
                type="text"
                required
                class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)]"
                placeholder="e.g. High Spenders"
              />
            </div>

            <!-- Slug -->
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Slug</label>
              <input
                v-model="form.slug"
                type="text"
                required
                class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] font-mono"
                placeholder="high-spenders"
              />
            </div>

            <!-- Description -->
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Description</label>
              <textarea
                v-model="form.description"
                rows="2"
                class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)]"
                placeholder="Optional description..."
              />
            </div>

            <!-- Rule Type -->
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Rule Type</label>
              <select
                v-model="form.rule_type"
                class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)]"
              >
                <option v-for="rt in ruleTypes" :key="rt.value" :value="rt.value">{{ rt.label }}</option>
              </select>
            </div>

            <!-- Operator -->
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Operator</label>
              <select
                v-model="form.operator"
                class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)]"
              >
                <option v-for="op in operators" :key="op.value" :value="op.value">{{ op.label }}</option>
              </select>
            </div>

            <!-- Threshold Min -->
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {{ isBetween ? 'Threshold Min' : 'Threshold' }}
              </label>
              <input
                v-model.number="form.threshold_min"
                type="number"
                required
                class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)]"
              />
            </div>

            <!-- Threshold Max (between only) -->
            <div v-if="isBetween">
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Threshold Max</label>
              <input
                v-model.number="form.threshold_max"
                type="number"
                required
                class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)]"
              />
            </div>

            <!-- Entry Events -->
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Entry Events</label>
              <div class="flex flex-wrap gap-1.5 mb-2" v-if="form.entry_events.length">
                <span
                  v-for="evt in form.entry_events"
                  :key="evt"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-info-bg)] text-[var(--color-info-text)]"
                >
                  {{ evt }}
                  <button type="button" @click="removeEvent(evt)" class="hover:text-red-500 transition-colors">
                    <XMarkIcon class="h-3 w-3" />
                  </button>
                </span>
              </div>
              <input
                v-model="eventInput"
                type="text"
                @keydown="handleEventKeydown"
                @blur="addEvent"
                class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)]"
                placeholder="Type event name and press Enter"
              />
            </div>

            <!-- Sync to Tracardi -->
            <div class="space-y-3">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  v-model="form.sync_to_tracardi"
                  type="checkbox"
                  class="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-accent)]/30"
                />
                <span class="text-sm text-[var(--color-text-secondary)]">Sync to Tracardi</span>
              </label>
              <div v-if="form.sync_to_tracardi">
                <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Tracardi Event Type</label>
                <input
                  v-model="form.tracardi_event_type"
                  type="text"
                  class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)]"
                  placeholder="e.g. segment-entry"
                />
              </div>
            </div>

            <!-- Active toggle -->
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="form.is_active"
                type="checkbox"
                class="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-accent)]/30"
              />
              <span class="text-sm text-[var(--color-text-secondary)]">Active</span>
            </label>

            <!-- Actions -->
            <div class="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                @click="showModal = false"
                class="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="saving"
                class="px-4 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-hover)] shadow-sm transition-all disabled:opacity-50"
              >
                {{ saving ? 'Saving...' : (editingSlug ? 'Update' : 'Create') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
