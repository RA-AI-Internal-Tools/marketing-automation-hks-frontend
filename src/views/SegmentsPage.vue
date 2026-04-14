<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import {
  PlusIcon, PencilSquareIcon, TrashIcon, LockClosedIcon,
  PlayIcon, XMarkIcon, AdjustmentsHorizontalIcon,
} from '@heroicons/vue/24/outline'
import {
  fetchSegments, createSegment, updateSegment, deleteSegment,
  evaluateSegment, evaluateAllSegments,
} from '@/api/dashboard'
import type { Segment, SegmentRequest } from '@/api/types'

const auth = useAuthStore()
const { showToast } = useToast()

const deleteTarget = ref<{ slug: string; name: string } | null>(null)
const deleteOpen = computed({
  get: () => !!deleteTarget.value,
  set: (v) => { if (!v) deleteTarget.value = null },
})

const loading = ref(true)
const segments = ref<Segment[]>([])
const showModal = ref(false)
const saving = ref(false)
const evaluating = ref<string | null>(null)
const evaluatingAll = ref(false)
const editingSlug = ref<string | null>(null)
const eventInput = ref('')

const ruleTypes = [
  { value: 'last_order_days', label: 'Last order days' },
  { value: 'order_count', label: 'Order count' },
  { value: 'total_spend', label: 'Total spend' },
  { value: 'avg_order_value', label: 'Avg order value' },
  { value: 'account_age_days', label: 'Account age days' },
  { value: 'all', label: 'All (match everyone)' },
]

const operators = [
  { value: 'gt', label: '> greater than' },
  { value: 'gte', label: '≥ greater or equal' },
  { value: 'lt', label: '< less than' },
  { value: 'lte', label: '≤ less or equal' },
  { value: 'eq', label: '= equal' },
  { value: 'between', label: 'between' },
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
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
watch(() => form.value.name, (name) => {
  if (!editingSlug.value) form.value.slug = slugify(name)
})

async function load() {
  loading.value = true
  try {
    segments.value = await fetchSegments()
  } catch (e: any) { console.error('Failed to load segments', e) }
  finally { loading.value = false }
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
    if (payload.operator !== 'between') payload.threshold_max = undefined
    if (!payload.sync_to_tracardi) payload.tracardi_event_type = undefined
    if (editingSlug.value) await updateSegment(editingSlug.value, payload)
    else await createSegment(payload)
    showModal.value = false
    showToast(editingSlug.value ? 'Segment updated' : 'Segment created', 'success')
    await load()
  } catch (e: any) {
    showToast(e.response?.data?.error || 'Failed to save segment', 'error')
  } finally { saving.value = false }
}

function handleDelete(slug: string, name: string) { deleteTarget.value = { slug, name } }
async function confirmDelete() {
  if (!deleteTarget.value) return
  const { slug, name } = deleteTarget.value
  try {
    await deleteSegment(slug)
    showToast(`Deleted segment "${name}"`, 'success')
    await load()
  } catch (e: any) {
    showToast(e.response?.data?.error || 'Failed to delete segment', 'error')
  } finally { deleteTarget.value = null }
}

async function handleEvaluate(slug: string) {
  evaluating.value = slug
  try {
    const result = await evaluateSegment(slug)
    showToast(`Evaluation complete: ${result.evaluated} members evaluated.`, 'success')
    await load()
  } catch (e: any) {
    showToast(e.response?.data?.error || 'Failed to evaluate segment', 'error')
  } finally { evaluating.value = null }
}

async function handleEvaluateAll() {
  evaluatingAll.value = true
  try {
    // Backend now returns 202 with { status, client_count, segment_count }
    // (async fire-and-forget). The old 200 { clients_evaluated, segments_evaluated, results }
    // shape is gone; list will update once the background job writes back.
    const result = await evaluateAllSegments()
    const started = result?.status === 'evaluation_started'
    showToast(
      started
        ? `Evaluating ${result.segment_count} segments across ${result.client_count} clients…`
        : 'Evaluation started.',
      'success',
      5000,
    )
    // Refresh after a short delay so the first results have a chance to persist.
    setTimeout(() => { load() }, 2000)
  } catch (e: any) {
    showToast(e.response?.data?.error || 'Failed to evaluate all segments', 'error')
  } finally { evaluatingAll.value = false }
}

function addEvent() {
  const val = eventInput.value.trim()
  if (val && !form.value.entry_events.includes(val)) form.value.entry_events.push(val)
  eventInput.value = ''
}
function removeEvent(event: string) { form.value.entry_events = form.value.entry_events.filter(e => e !== event) }
function handleEventKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') { e.preventDefault(); addEvent() }
}

function formatOperator(op: string): string {
  const map: Record<string, string> = { gt: '>', gte: '≥', lt: '<', lte: '≤', eq: '=', between: '↔' }
  return map[op] || op
}
function formatThreshold(segment: Segment): string {
  if (segment.operator === 'between') return `${segment.threshold_min} ↔ ${segment.threshold_max ?? '?'}`
  return `${formatOperator(segment.operator)} ${segment.threshold_min}`
}

const totalMembers = computed(() =>
  segments.value.reduce((a, s) => a + (s.member_count ?? 0), 0),
)
</script>

<template>
  <div class="page-enter">
    <PageHeader
      kicker="Audience"
      title="Segments"
      description="Compose audiences from behavioural rules, attributes, and engagement history."
    >
      <div class="hdr-actions">
        <button
          v-if="auth.canWrite"
          @click="handleEvaluateAll"
          :disabled="evaluatingAll"
          class="btn btn-ghost"
        >
          <PlayIcon class="h-4 w-4" />
          <span>{{ evaluatingAll ? 'Evaluating…' : 'Evaluate all' }}</span>
        </button>
        <button v-if="auth.canWrite" @click="openCreate" class="btn btn-primary">
          <PlusIcon class="h-4 w-4" /> New segment
        </button>
      </div>
    </PageHeader>

    <!-- Meta strip -->
    <div v-if="!loading && segments.length" class="seg-meta">
      <span class="rule-dot">Inventory</span>
      <span class="seg-meta-num num-tabular">{{ segments.length }}</span>
      <span class="seg-meta-lbl">segment{{ segments.length === 1 ? '' : 's' }}</span>
      <span class="seg-meta-sep">·</span>
      <span class="seg-meta-num num-tabular">{{ totalMembers.toLocaleString() }}</span>
      <span class="seg-meta-lbl">members total</span>
      <span class="seg-meta-rule" />
    </div>

    <!-- Column guide -->
    <details class="seg-guide">
      <summary>
        <span class="rule-dot">How segments work</span>
        <span class="seg-guide-chev">›</span>
      </summary>
      <div class="seg-guide-body">
        <p>Segments group customers by behavioural rules. When a campaign uses a segment filter, only customers who qualify at enrollment time are entered.</p>
        <dl>
          <div><dt>Rule Type</dt><dd>What customer data to evaluate — days since last order, total order count, lifetime spend, avg order value, or account age.</dd></div>
          <div><dt>Thresholds</dt><dd>The comparison value. <code>&gt; 30</code> means "more than 30 days"; <code>2 ↔ 4</code> means "between 2 and 4 orders".</dd></div>
          <div><dt>Entry Events</dt><dd>Which customer events trigger re-evaluation. When <code>order-completed</code> fires, the system re-checks this segment.</dd></div>
          <div><dt>Tracardi</dt><dd><span class="seg-ok">Connected</span> = thresholds sync to Tracardi for profile tagging. <span class="seg-dim">—</span> = MA-only.</dd></div>
          <div><dt>Members</dt><dd>Current count. Updates on entry events or when you click evaluate.</dd></div>
          <div><dt>Actions</dt><dd>Play = re-evaluate now. Edit = change rules. Built-in segments (lock icon) can be edited but not deleted.</dd></div>
        </dl>
      </div>
    </details>

    <!-- Skeletons -->
    <div v-if="loading" class="seg-table-wrap">
      <div v-for="i in 4" :key="i" class="seg-skel">
        <div class="skeleton h-4 w-44"></div>
        <div class="skeleton h-3.5 w-28"></div>
        <div class="skeleton h-3.5 w-20"></div>
        <div class="skeleton h-3.5 w-16 ml-auto"></div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="segments.length === 0" class="seg-empty">
      <AdjustmentsHorizontalIcon class="seg-empty-icon" />
      <p class="seg-empty-title">No segments yet.</p>
      <p class="seg-empty-sub">Create your first segment to start grouping your audience.</p>
    </div>

    <!-- Table -->
    <div v-else class="seg-card table-scroll">
      <table class="seg-table">
        <thead>
          <tr>
            <th class="seg-th">Name</th>
            <th class="seg-th">Slug</th>
            <th class="seg-th">Rule</th>
            <th class="seg-th">Threshold</th>
            <th class="seg-th">Entry events</th>
            <th class="seg-th seg-th-right">Members</th>
            <th class="seg-th seg-th-center">Tracardi</th>
            <th class="seg-th seg-th-center">Active</th>
            <th class="seg-th seg-th-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="segment in segments" :key="segment.id" class="seg-row">
            <td class="seg-td">
              <div class="seg-name-wrap">
                <LockClosedIcon v-if="segment.is_built_in" class="seg-lock" title="Built-in segment" />
                <router-link :to="`/segments/${segment.slug}`" class="seg-name">
                  {{ segment.name }}
                </router-link>
              </div>
            </td>
            <td class="seg-td">
              <code class="seg-code">{{ segment.slug }}</code>
            </td>
            <td class="seg-td seg-rule">{{ segment.rule_type.replace(/_/g, ' ') }}</td>
            <td class="seg-td">
              <code class="seg-threshold num-tabular">{{ formatThreshold(segment) }}</code>
            </td>
            <td class="seg-td">
              <div v-if="segment.entry_events.length" class="seg-events">
                <span v-for="evt in segment.entry_events" :key="evt" class="seg-event">{{ evt }}</span>
              </div>
              <span v-else class="seg-dim">—</span>
            </td>
            <td class="seg-td seg-td-right">
              <span class="seg-members num-tabular">{{ (segment.member_count ?? 0).toLocaleString() }}</span>
            </td>
            <td class="seg-td seg-td-center">
              <span v-if="segment.sync_to_tracardi" class="seg-pill seg-pill-ok">
                <span class="seg-pill-dot" /> sync
              </span>
              <span v-else class="seg-dim">—</span>
            </td>
            <td class="seg-td seg-td-center">
              <span class="seg-pill" :class="segment.is_active ? 'seg-pill-ok' : 'seg-pill-muted'">
                <span class="seg-pill-dot" />{{ segment.is_active ? 'active' : 'paused' }}
              </span>
            </td>
            <td class="seg-td seg-td-right">
              <div class="seg-actions">
                <button
                  @click="handleEvaluate(segment.slug)"
                  :disabled="evaluating === segment.slug"
                  class="seg-action"
                  :title="evaluating === segment.slug ? 'Evaluating…' : 'Evaluate now'"
                >
                  <PlayIcon class="h-4 w-4" :class="{ 'seg-spin': evaluating === segment.slug }" />
                </button>
                <button
                  v-if="auth.canWrite"
                  @click="openEdit(segment)"
                  class="seg-action"
                  title="Edit"
                >
                  <PencilSquareIcon class="h-4 w-4" />
                </button>
                <button
                  v-if="auth.canWrite && !segment.is_built_in"
                  @click="handleDelete(segment.slug, segment.name)"
                  class="seg-action seg-action-danger"
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

    <!-- Create / Edit Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="seg-modal-root">
        <div class="seg-modal-scrim" @click="showModal = false" />
        <div class="seg-modal" role="dialog" aria-modal="true">
          <header class="seg-modal-head">
            <div>
              <div class="rule-dot">{{ editingSlug ? 'Edit' : 'New' }}</div>
              <h2 class="seg-modal-title">
                {{ editingSlug ? 'Edit segment' : 'New segment' }}
              </h2>
            </div>
            <button @click="showModal = false" class="seg-modal-close" aria-label="Close">
              <XMarkIcon class="h-5 w-5" />
            </button>
          </header>

          <form @submit.prevent="handleSave" class="seg-form">
            <div class="seg-field">
              <label>Name</label>
              <input v-model="form.name" type="text" required placeholder="e.g. High spenders" />
            </div>
            <div class="seg-field">
              <label>Slug</label>
              <input v-model="form.slug" type="text" required class="mono" placeholder="high-spenders" />
            </div>
            <div class="seg-field">
              <label>Description</label>
              <textarea v-model="form.description" rows="2" placeholder="Optional description…" />
            </div>

            <div class="seg-grid-2">
              <div class="seg-field">
                <label>Rule type</label>
                <select v-model="form.rule_type">
                  <option v-for="rt in ruleTypes" :key="rt.value" :value="rt.value">{{ rt.label }}</option>
                </select>
              </div>
              <div class="seg-field">
                <label>Operator</label>
                <select v-model="form.operator">
                  <option v-for="op in operators" :key="op.value" :value="op.value">{{ op.label }}</option>
                </select>
              </div>
            </div>

            <div class="seg-grid-2">
              <div class="seg-field">
                <label>{{ isBetween ? 'Threshold min' : 'Threshold' }}</label>
                <input v-model.number="form.threshold_min" type="number" required class="mono" />
              </div>
              <div v-if="isBetween" class="seg-field">
                <label>Threshold max</label>
                <input v-model.number="form.threshold_max" type="number" required class="mono" />
              </div>
            </div>

            <div class="seg-field">
              <label>Entry events</label>
              <div v-if="form.entry_events.length" class="seg-event-list">
                <span v-for="evt in form.entry_events" :key="evt" class="seg-event-chip">
                  {{ evt }}
                  <button type="button" @click="removeEvent(evt)" aria-label="Remove">
                    <XMarkIcon class="h-3 w-3" />
                  </button>
                </span>
              </div>
              <input
                v-model="eventInput"
                type="text"
                @keydown="handleEventKeydown"
                @blur="addEvent"
                class="mono"
                placeholder="Type event name and press Enter"
              />
            </div>

            <div class="seg-field-row">
              <label class="seg-check">
                <input v-model="form.sync_to_tracardi" type="checkbox" />
                <span>Sync to Tracardi</span>
              </label>
              <label class="seg-check">
                <input v-model="form.is_active" type="checkbox" />
                <span>Active</span>
              </label>
            </div>

            <div v-if="form.sync_to_tracardi" class="seg-field">
              <label>Tracardi event type</label>
              <input v-model="form.tracardi_event_type" type="text" class="mono" placeholder="e.g. segment-entry" />
            </div>

            <div class="seg-modal-foot">
              <button type="button" @click="showModal = false" class="btn btn-ghost">Cancel</button>
              <button type="submit" :disabled="saving" class="btn btn-primary">
                {{ saving ? 'Saving…' : (editingSlug ? 'Update' : 'Create') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <ConfirmDialog
      :open="deleteOpen"
      :title="`Delete segment ${deleteTarget?.name || ''}?`"
      message="Any campaign using this segment will stop targeting it. This cannot be undone."
      confirm-text="Delete"
      cancel-text="Keep"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="deleteTarget = null"
    />
  </div>
</template>

<style scoped>
.hdr-actions { display: inline-flex; align-items: center; gap: 8px; }

/* ── Meta ── */
.seg-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 18px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-tertiary);
  letter-spacing: 0.02em;
}
.seg-meta-num { color: var(--color-text-primary); font-weight: 500; font-size: 12px; }
.seg-meta-lbl { color: var(--color-text-muted); }
.seg-meta-sep { color: var(--color-border-strong); }
.seg-meta-rule { flex: 1; height: 1px; background: var(--color-divider); margin-left: 8px; }

/* ── Guide ── */
.seg-guide {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: 18px;
  overflow: hidden;
}
.seg-guide > summary {
  list-style: none;
  cursor: pointer;
  user-select: none;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background var(--transition-fast);
}
.seg-guide > summary::-webkit-details-marker { display: none; }
.seg-guide > summary:hover { background: var(--color-bg-subtle); }
.seg-guide-chev {
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--color-text-muted);
  transition: transform var(--transition-fast);
}
.seg-guide[open] .seg-guide-chev { transform: rotate(90deg); color: var(--hks-cyan); }
.seg-guide-body {
  padding: 4px 20px 20px;
  border-top: 1px solid var(--color-divider);
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}
.seg-guide-body > p { padding-top: 12px; }
.seg-guide-body dl {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px 24px;
  margin-top: 14px;
}
@media (min-width: 720px) {
  .seg-guide-body dl { grid-template-columns: 1fr 1fr; }
}
.seg-guide-body dt {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  margin-bottom: 2px;
}
.seg-guide-body dd { margin: 0; font-size: 12.5px; color: var(--color-text-secondary); }
.seg-guide-body code {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 6px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-muted);
  border-radius: var(--radius-sm);
}
.seg-ok { color: var(--color-success); font-weight: 500; }
.seg-dim { color: var(--color-text-muted); font-family: var(--font-mono); font-size: 11px; }

/* ── Table ── */
.seg-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.seg-table { width: 100%; border-collapse: collapse; font-family: var(--font-sans); }

.seg-th {
  padding: 12px 16px;
  text-align: left;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  background: var(--color-bg-table-header);
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}
.seg-th-right { text-align: right; }
.seg-th-center { text-align: center; }

.seg-row { transition: background var(--transition-fast); }
.seg-row:hover { background: var(--color-bg-subtle); }
.seg-td {
  padding: 13px 16px;
  font-size: 13px;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-divider);
  vertical-align: middle;
}
.seg-row:last-child .seg-td { border-bottom: 0; }
.seg-td-right { text-align: right; }
.seg-td-center { text-align: center; }

.seg-name-wrap { display: inline-flex; align-items: center; gap: 8px; }
.seg-lock { width: 13px; height: 13px; color: var(--color-text-muted); flex-shrink: 0; }
.seg-name {
  font-family: var(--font-sans);
  font-weight: 500;
  font-size: 13.5px;
  color: var(--color-text-primary);
  text-decoration: none;
  letter-spacing: -0.005em;
  transition: color var(--transition-fast);
}
.seg-name:hover { color: var(--hks-cyan); }

.seg-code, .seg-threshold {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 11.5px;
  padding: 2px 7px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-muted);
  border-radius: var(--radius-sm);
  color: var(--color-text-tertiary);
}
.seg-threshold { color: var(--color-text-secondary); font-weight: 500; }

.seg-rule {
  font-family: var(--font-sans);
  font-size: 12.5px;
  color: var(--color-text-secondary);
  text-transform: capitalize;
  letter-spacing: 0.01em;
}

.seg-events { display: flex; flex-wrap: wrap; gap: 4px; }
.seg-event {
  font-family: var(--font-mono);
  font-size: 10.5px;
  padding: 2px 7px;
  background: var(--color-info-bg);
  color: var(--color-info-text);
  border: 1px solid var(--color-info-border);
  border-radius: var(--radius-sm);
  letter-spacing: 0.01em;
}

.seg-members {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 16px;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums lining-nums;
  letter-spacing: -0.01em;
}

.seg-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 9px 2px 8px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-radius: var(--radius-full);
  border: 1px solid;
}
.seg-pill-dot { width: 5px; height: 5px; border-radius: 50%; }
.seg-pill-ok {
  color: var(--color-success-text);
  background: var(--color-success-bg);
  border-color: var(--color-success-border);
}
.seg-pill-ok .seg-pill-dot {
  background: var(--color-success);
  box-shadow: 0 0 0 2px rgba(11,122,75,0.15);
}
.seg-pill-muted {
  color: var(--color-text-muted);
  background: var(--color-bg-subtle);
  border-color: var(--color-border);
}
.seg-pill-muted .seg-pill-dot { background: var(--color-text-muted); }

.seg-actions { display: inline-flex; gap: 2px; justify-content: flex-end; }
.seg-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px; height: 30px;
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast);
}
.seg-action:hover {
  color: var(--hks-deep-blue);
  background: var(--color-bg-subtle);
  border-color: var(--color-border);
}
.seg-action-danger:hover { color: var(--color-error); border-color: var(--color-error-border); }
.seg-action:disabled { opacity: 0.5; cursor: not-allowed; }
.seg-spin { animation: segspin 0.8s linear infinite; }
@keyframes segspin { to { transform: rotate(360deg); } }

/* ── Skeleton ── */
.seg-table-wrap {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 8px 16px;
}
.seg-skel {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-divider);
}
.seg-skel:last-child { border-bottom: 0; }

/* ── Empty ── */
.seg-empty {
  padding: 96px 24px;
  text-align: center;
  background: var(--color-bg-card);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-lg);
}
.seg-empty-icon {
  width: 42px; height: 42px;
  color: var(--color-text-muted);
  margin: 0 auto 16px;
  opacity: 0.6;
}
.seg-empty-title {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 400;
  color: var(--color-text-secondary);
  letter-spacing: -0.01em;
  font-variation-settings: 'opsz' 72;
}
.seg-empty-sub { margin-top: 6px; font-size: 12.5px; color: var(--color-text-muted); }

/* ── Modal ── */
.seg-modal-root {
  position: fixed; inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fadeIn 0.2s ease-out;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.seg-modal-scrim {
  position: absolute; inset: 0;
  background: rgba(10, 13, 24, 0.55);
  backdrop-filter: blur(4px);
}
.seg-modal {
  position: relative;
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  animation: slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

.seg-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 22px 24px 18px;
  border-bottom: 1px solid var(--color-divider);
}
.seg-modal-title {
  margin-top: 6px;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 26px;
  letter-spacing: -0.02em;
  color: var(--color-text-primary);
  font-variation-settings: 'opsz' 72, 'SOFT' 30;
}
.seg-modal-close {
  width: 32px; height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast);
}
.seg-modal-close:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-subtle);
}

.seg-form {
  padding: 18px 24px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.seg-field { display: flex; flex-direction: column; gap: 5px; }
.seg-field > label {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
}
.seg-field input, .seg-field select, .seg-field textarea {
  font-family: var(--font-sans);
  font-size: 13.5px;
  padding: 9px 11px;
  color: var(--color-text-primary);
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.seg-field input.mono, .seg-field textarea.mono { font-family: var(--font-mono); font-size: 12.5px; }
.seg-field input:focus, .seg-field select:focus, .seg-field textarea:focus {
  outline: none;
  border-color: var(--hks-cyan);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}
.seg-field input::placeholder, .seg-field textarea::placeholder { color: var(--color-text-muted); }

.seg-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
@media (max-width: 540px) { .seg-grid-2 { grid-template-columns: 1fr; } }

.seg-field-row { display: flex; gap: 24px; flex-wrap: wrap; padding-top: 4px; }
.seg-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.seg-check input[type="checkbox"] {
  width: 16px; height: 16px;
  accent-color: var(--hks-deep-blue);
  cursor: pointer;
}

.seg-event-list { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 6px; }
.seg-event-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px 2px 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-info-text);
  background: var(--color-info-bg);
  border: 1px solid var(--color-info-border);
  border-radius: var(--radius-sm);
}
.seg-event-chip button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px;
  color: inherit;
  background: transparent;
  border: none;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity var(--transition-fast), color var(--transition-fast);
}
.seg-event-chip button:hover { opacity: 1; color: var(--color-error); }

.seg-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 14px;
  margin-top: 6px;
  border-top: 1px solid var(--color-divider);
}
</style>
