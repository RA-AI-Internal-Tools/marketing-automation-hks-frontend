<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonTable from '@/components/SkeletonTable.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ChannelChip from '@/components/ChannelChip.vue'
import { useAuthStore } from '@/stores/auth'
import { useTemplatesStore } from '@/stores/templates'
import { useToast } from '@/composables/useToast'
import {
  listBroadcasts, createBroadcast, updateBroadcast,
  scheduleBroadcast, cancelBroadcast, deleteBroadcast,
  type Broadcast, type BroadcastRequest,
} from '@/api/broadcasts'
import { getChannelVocabulary } from '@/api/channels'
import { PlusIcon, PlayIcon, StopIcon, TrashIcon, PencilSquareIcon, XMarkIcon, MegaphoneIcon } from '@heroicons/vue/24/outline'

const auth = useAuthStore()
const templatesStore = useTemplatesStore()
const { showToast } = useToast()

const rows = ref<Broadcast[]>([])
const total = ref(0)
const loading = ref(true)
const statusFilter = ref<string>('')

const editorOpen = ref(false)
const editing = ref<Broadcast | null>(null)
const form = ref<BroadcastRequest & { id?: number }>({
  name: '',
  template_key: '',
  channel: 'email',
  segment_filter: 'all',
  scheduled_at: '',
})
const saving = ref(false)

const deleteTarget = ref<Broadcast | null>(null)
const deleteOpen = computed({ get: () => !!deleteTarget.value, set: v => { if (!v) deleteTarget.value = null } })
const cancelTarget = ref<Broadcast | null>(null)
const cancelOpen = computed({ get: () => !!cancelTarget.value, set: v => { if (!v) cancelTarget.value = null } })

async function load() {
  loading.value = true
  try {
    const r = await listBroadcasts({
      status: statusFilter.value || undefined,
      limit: 100,
    })
    rows.value = r.data
    total.value = r.total
  } catch (e: any) {
    showToast(e.response?.data?.error || 'Failed to load broadcasts', 'error')
  } finally {
    loading.value = false
  }
}

// Channel list is hydrated from the backend vocabulary endpoint on mount
// so new delivery surfaces (e.g. 'line', 'telegram') appear here without a
// frontend redeploy. The hardcoded list below is the first-paint default
// and the failure fallback — same pattern as ConsentsPage.
const availableChannels = ref<string[]>(['email', 'sms', 'push', 'whatsapp'])

onMounted(() => {
  load()
  templatesStore.load()
  getChannelVocabulary()
    .then(v => { if (Array.isArray(v) && v.length > 0) availableChannels.value = v })
    .catch(() => { /* keep fallback */ })
})

watch(statusFilter, load)

const templatesForChannel = computed(() =>
  templatesStore.templates.filter(t => t.channel === form.value.channel && !t.template_key.includes('.')),
)

function openNew() {
  editing.value = null
  form.value = {
    name: '',
    template_key: '',
    channel: 'email',
    segment_filter: 'all',
    // Default: one hour from now, rounded to next quarter-hour.
    scheduled_at: defaultScheduleISO(),
  }
  editorOpen.value = true
}

function openEdit(b: Broadcast) {
  editing.value = b
  form.value = {
    id: b.id,
    name: b.name,
    template_key: b.template_key,
    channel: b.channel,
    segment_filter: b.segment_filter,
    scheduled_at: b.scheduled_at.slice(0, 16), // YYYY-MM-DDTHH:MM for datetime-local
  }
  editorOpen.value = true
}

function defaultScheduleISO(): string {
  const t = new Date(Date.now() + 60 * 60 * 1000)
  t.setMinutes(Math.ceil(t.getMinutes() / 15) * 15, 0, 0)
  // Return YYYY-MM-DDTHH:MM for datetime-local input
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`
}

async function save() {
  saving.value = true
  try {
    const req: BroadcastRequest = {
      name: form.value.name.trim(),
      template_key: form.value.template_key.trim(),
      channel: form.value.channel,
      segment_filter: form.value.segment_filter || 'all',
      scheduled_at: new Date(form.value.scheduled_at).toISOString(),
    }
    if (editing.value) {
      await updateBroadcast(editing.value.id, req)
      showToast(`Updated "${req.name}"`, 'success')
    } else {
      await createBroadcast(req)
      showToast(`Draft "${req.name}" created`, 'success')
    }
    editorOpen.value = false
    load()
  } catch (e: any) {
    showToast(e.response?.data?.error || 'Failed to save', 'error')
  } finally {
    saving.value = false
  }
}

async function handleSchedule(b: Broadcast) {
  try {
    await scheduleBroadcast(b.id)
    showToast(`Scheduled — runs at ${formatTime(b.scheduled_at)}`, 'success')
    load()
  } catch (e: any) {
    showToast(e.response?.data?.error || 'Failed to schedule', 'error')
  }
}

async function confirmCancel() {
  if (!cancelTarget.value) return
  try {
    await cancelBroadcast(cancelTarget.value.id)
    showToast('Broadcast cancelled', 'success')
  } catch (e: any) {
    showToast(e.response?.data?.error || 'Failed to cancel', 'error')
  } finally {
    cancelTarget.value = null
    load()
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  try {
    await deleteBroadcast(deleteTarget.value.id)
    showToast(`Deleted "${deleteTarget.value.name}"`, 'success')
  } catch (e: any) {
    showToast(e.response?.data?.error || 'Failed to delete', 'error')
  } finally {
    deleteTarget.value = null
    load()
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

</script>

<template>
  <div class="page-enter">
    <PageHeader
      kicker="Engage"
      title="Broadcasts"
      description="One-off scheduled sends to a segment — newsletters, promos, launches."
    >
      <button v-if="auth.canWrite" @click="openNew" class="btn btn-primary">
        <PlusIcon class="h-4 w-4" /> New broadcast
      </button>
    </PageHeader>

    <div class="bc-toolbar">
      <div class="bc-tabs">
        <button
          v-for="s in ['', 'draft', 'scheduled', 'running', 'completed', 'cancelled']"
          :key="s"
          @click="statusFilter = s"
          :class="['bc-tab', { 'bc-tab-active': statusFilter === s }]"
        >{{ s || 'All' }}</button>
      </div>
      <span class="bc-meta">{{ total }} total</span>
    </div>

    <SkeletonTable v-if="loading" :rows="5" :columns="4" />

    <EmptyState
      v-else-if="rows.length === 0"
      :icon="MegaphoneIcon"
      title="No broadcasts yet."
      description="Send a one-off blast — newsletter, promo, product launch — to any segment on any channel."
    >
      <template v-if="auth.canWrite" #action>
        <button @click="openNew" class="btn btn-primary">
          <PlusIcon class="h-4 w-4" /> Create your first broadcast
        </button>
      </template>
    </EmptyState>

    <div v-else class="bc-list">
      <div v-for="b in rows" :key="b.id" class="bc-row" :data-status="b.status">
        <div class="bc-row-main">
          <div class="bc-row-top">
            <StatusBadge :status="b.status" />
            <h3 class="bc-name">{{ b.name }}</h3>
            <ChannelChip :channel="b.channel" />
          </div>
          <div class="bc-row-meta">
            <span>Template: <code>{{ b.template_key }}</code></span>
            <span class="bc-sep">·</span>
            <span>Segment: <code>{{ b.segment_filter }}</code></span>
            <span class="bc-sep">·</span>
            <span>Scheduled: <strong>{{ formatTime(b.scheduled_at) }}</strong></span>
          </div>
          <div v-if="b.status === 'completed' || b.status === 'running'" class="bc-stats">
            <div class="bc-stat"><span class="bc-stat-num bc-stat-sent">{{ b.sent_count }}</span><span class="bc-stat-lbl">sent</span></div>
            <div class="bc-stat"><span class="bc-stat-num bc-stat-failed">{{ b.failed_count }}</span><span class="bc-stat-lbl">failed</span></div>
            <div class="bc-stat"><span class="bc-stat-num bc-stat-skipped">{{ b.skipped_count }}</span><span class="bc-stat-lbl">skipped</span></div>
            <div class="bc-stat"><span class="bc-stat-num">{{ b.total_clients }}</span><span class="bc-stat-lbl">total</span></div>
          </div>
          <div v-if="b.error" class="bc-error">{{ b.error }}</div>
        </div>

        <div v-if="auth.canWrite" class="bc-row-actions">
          <button v-if="b.status === 'draft'" @click="handleSchedule(b)" class="bc-act bc-act-primary" :aria-label="`Schedule broadcast ${b.name}`" title="Schedule">
            <PlayIcon class="h-4 w-4" /> Schedule
          </button>
          <button v-if="b.status === 'draft'" @click="openEdit(b)" class="bc-act" :aria-label="`Edit broadcast ${b.name}`" title="Edit">
            <PencilSquareIcon class="h-4 w-4" />
          </button>
          <button v-if="b.status === 'scheduled' || b.status === 'running'" @click="cancelTarget = b" class="bc-act bc-act-warn" :aria-label="`Cancel broadcast ${b.name}`" title="Cancel">
            <StopIcon class="h-4 w-4" /> Cancel
          </button>
          <button v-if="b.status === 'draft' || b.status === 'cancelled'" @click="deleteTarget = b" class="bc-act bc-act-danger" :aria-label="`Delete broadcast ${b.name}`" title="Delete">
            <TrashIcon class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Editor modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="editorOpen" class="bc-modal-backdrop" @click.self="editorOpen = false" role="dialog" aria-modal="true">
          <div class="bc-modal">
            <div class="bc-modal-head">
              <h3>{{ editing ? 'Edit broadcast' : 'New broadcast' }}</h3>
              <button @click="editorOpen = false" class="bc-modal-close"><XMarkIcon class="h-5 w-5" /></button>
            </div>
            <div class="bc-modal-body">
              <label class="bc-field">
                <span class="bc-field-lbl">Name</span>
                <input v-model="form.name" type="text" placeholder="April newsletter" class="bc-input" />
              </label>
              <div class="bc-grid grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label class="bc-field">
                  <span class="bc-field-lbl">Channel</span>
                  <select v-model="form.channel" class="bc-input">
                    <option v-for="ch in availableChannels" :key="ch" :value="ch">{{ ch }}</option>
                  </select>
                </label>
                <label class="bc-field">
                  <span class="bc-field-lbl">Template</span>
                  <select v-model="form.template_key" class="bc-input">
                    <option value="">— pick a template —</option>
                    <option v-for="t in templatesForChannel" :key="t.id" :value="t.template_key">
                      {{ t.name }} ({{ t.template_key }})
                    </option>
                  </select>
                </label>
              </div>
              <div class="bc-grid grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label class="bc-field">
                  <span class="bc-field-lbl">Segment</span>
                  <input v-model="form.segment_filter" type="text" placeholder="all" class="bc-input" />
                  <span class="bc-field-hint">Use "all" for everyone, or a segment slug (e.g. "vip", "dormant").</span>
                </label>
                <label class="bc-field">
                  <span class="bc-field-lbl">Scheduled for</span>
                  <input v-model="form.scheduled_at" type="datetime-local" class="bc-input" />
                  <span class="bc-field-hint">Local time — the server will convert to UTC.</span>
                </label>
              </div>
            </div>
            <div class="bc-modal-foot">
              <button @click="editorOpen = false" class="btn btn-ghost">Cancel</button>
              <button
                @click="save"
                :disabled="saving || !form.name || !form.template_key || !form.scheduled_at"
                class="btn btn-primary"
              >
                {{ saving ? 'Saving…' : (editing ? 'Save changes' : 'Create draft') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <ConfirmDialog
      :open="deleteOpen"
      :title="`Delete ${deleteTarget?.name || ''}?`"
      message="This permanently removes the broadcast row."
      confirm-text="Delete" cancel-text="Keep" variant="danger"
      @confirm="confirmDelete" @cancel="deleteTarget = null"
    />
    <ConfirmDialog
      :open="cancelOpen"
      :title="`Cancel ${cancelTarget?.name || ''}?`"
      message="Any clients not yet sent to will be skipped. Already-sent messages are not recalled."
      confirm-text="Cancel broadcast" cancel-text="Keep running" variant="danger"
      @confirm="confirmCancel" @cancel="cancelTarget = null"
    />
  </div>
</template>

<style scoped>
/* ─── Toolbar ─── */
.bc-toolbar {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 20px;
}
.bc-tabs {
  display: flex; gap: 2px;
  padding: 2px;
  background: var(--color-bg-subtle);
  border-radius: var(--radius-md);
}
.bc-tab {
  padding: 5px 12px;
  font-size: 11.5px; font-weight: 500;
  color: var(--color-text-tertiary);
  background: transparent; border: none; cursor: pointer;
  text-transform: capitalize;
  border-radius: calc(var(--radius-md) - 2px);
  transition: color var(--transition-fast), background var(--transition-fast);
}
.bc-tab:hover { color: var(--color-text-secondary); }
.bc-tab-active { color: var(--color-text-primary); background: var(--color-bg-card); box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
.bc-meta {
  font-family: var(--font-mono); font-size: 11px;
  color: var(--color-text-muted); margin-left: auto;
}

/* Loading + empty state styles moved to <SkeletonTable> / <EmptyState>. */

/* ─── List rows ─── */
.bc-list { display: flex; flex-direction: column; gap: 10px; }
.bc-row {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px 18px;
  display: flex; align-items: flex-start; gap: 14px;
  transition: border-color var(--transition-fast);
}
.bc-row:hover { border-color: var(--color-border-strong); }
.bc-row[data-status="running"] { border-left: 3px solid var(--color-success); }
.bc-row[data-status="completed"] { opacity: 0.85; }
.bc-row[data-status="cancelled"], .bc-row[data-status="failed"] { opacity: 0.7; }

.bc-row-main { flex: 1; min-width: 0; }
.bc-row-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.bc-name {
  font-family: var(--font-sans); font-weight: 500; font-size: 15px;
  color: var(--color-text-primary); letter-spacing: -0.005em;
}

.bc-row-meta {
  margin-top: 8px; font-family: var(--font-sans); font-size: 12px;
  color: var(--color-text-tertiary); display: flex; gap: 8px; flex-wrap: wrap;
}
.bc-row-meta code {
  font-family: var(--font-mono); font-size: 11px;
  padding: 1px 5px; background: var(--color-bg-subtle); border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
}
.bc-row-meta strong { color: var(--color-text-primary); font-weight: 500; }
.bc-sep { color: var(--color-border-strong); }

.bc-stats { margin-top: 12px; display: flex; gap: 20px; }
.bc-stat { display: flex; align-items: baseline; gap: 6px; }
.bc-stat-num { font-family: var(--font-display); font-weight: 400; font-size: 22px; color: var(--color-text-primary); letter-spacing: -0.015em; font-variant-numeric: tabular-nums; }
.bc-stat-sent { color: var(--color-success); }
.bc-stat-failed { color: var(--color-error); }
.bc-stat-skipped { color: var(--color-warning); }
.bc-stat-lbl { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-text-tertiary); }

.bc-error {
  margin-top: 10px; padding: 8px 10px;
  background: var(--color-error-bg); border: 1px solid var(--color-error-border);
  color: var(--color-error-text); border-radius: var(--radius-sm);
  font-size: 12px; font-family: var(--font-mono);
}

.bc-row-actions { display: flex; gap: 4px; align-items: center; flex-shrink: 0; }
.bc-act {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px; font-size: 12px; font-weight: 500;
  color: var(--color-text-tertiary); background: transparent;
  border: 1px solid transparent; border-radius: var(--radius-sm);
  cursor: pointer; transition: all var(--transition-fast);
}
.bc-act:hover { color: var(--color-text-primary); background: var(--color-bg-subtle); border-color: var(--color-border); }
.bc-act-primary { color: var(--hks-deep-blue); background: var(--color-primary-soft); border-color: var(--color-primary-border); }
.bc-act-primary:hover { color: #fff; background: var(--hks-deep-blue); border-color: var(--hks-deep-blue); }
.bc-act-warn:hover { color: var(--color-warning); border-color: var(--color-warning-border); background: var(--color-warning-bg); }
.bc-act-danger:hover { color: var(--color-error); border-color: var(--color-error-border); background: var(--color-error-bg); }

/* ─── Modal ─── */
.bc-modal-backdrop {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(15,23,42,0.4); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  display: flex; align-items: flex-start; justify-content: center; padding: 12vh 20px 20px;
}
.bc-modal {
  width: 100%; max-width: 560px;
  background: var(--color-bg-card); border: 1px solid var(--color-border);
  border-radius: var(--radius-lg); box-shadow: 0 40px 80px -12px rgba(15,23,42,0.35);
}
.bc-modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px; border-bottom: 1px solid var(--color-border);
}
.bc-modal-head h3 {
  font-family: var(--font-display); font-weight: 400; font-size: 20px;
  color: var(--color-text-primary); letter-spacing: -0.015em;
}
.bc-modal-close {
  padding: 4px; color: var(--color-text-muted); background: none; border: none; cursor: pointer;
  border-radius: var(--radius-sm); transition: color var(--transition-fast), background var(--transition-fast);
}
.bc-modal-close:hover { color: var(--color-text-primary); background: var(--color-bg-subtle); }

.bc-modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
/* .bc-grid: layout via Tailwind utilities on the element itself. */

.bc-field { display: flex; flex-direction: column; gap: 4px; }
.bc-field-lbl { font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-text-tertiary); }
.bc-field-hint { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }

.bc-input {
  font-family: var(--font-sans); font-size: 14px;
  padding: 8px 11px;
  color: var(--color-text-primary); background: var(--color-bg-input);
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.bc-input:focus { outline: none; border-color: var(--hks-cyan); box-shadow: 0 0 0 3px var(--color-accent-light); }

.bc-modal-foot {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 14px 20px; background: var(--color-bg-page);
  border-top: 1px solid var(--color-border);
}

.fade-enter-active, .fade-leave-active { transition: opacity .15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
