<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useCampaignsStore } from '@/stores/campaigns'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import {
  PlusIcon, PencilSquareIcon, TrashIcon, RocketLaunchIcon,
  DocumentDuplicateIcon, SparklesIcon,
} from '@heroicons/vue/24/outline'
import { cloneCampaign } from '@/api/dashboard'
import BlueprintPickerModal from '@/components/BlueprintPickerModal.vue'
import ChannelChip from '@/components/ChannelChip.vue'
import EmptyState from '@/components/EmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import BaseCard from '@/components/BaseCard.vue'

const router = useRouter()
const store = useCampaignsStore()
const auth = useAuthStore()
const { showToast } = useToast()

const blueprintOpen = ref(false)
const deleteTarget = ref<{ id: number; name: string } | null>(null)
const deleteOpen = computed({
  get: () => !!deleteTarget.value,
  set: (v) => { if (!v) deleteTarget.value = null },
})

onMounted(() => store.load())

function formatDelay(minutes: number): string {
  if (minutes === 0) return 'now'
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`
  return `${Math.round(minutes / 1440)}d`
}

async function handleToggle(id: number) { await store.toggle(id) }
function handleDelete(id: number, name: string) { deleteTarget.value = { id, name } }

async function confirmDelete() {
  if (!deleteTarget.value) return
  const { id, name } = deleteTarget.value
  try {
    await store.remove(id)
    showToast(`Deleted "${name}"`, 'success')
  } catch (e: any) {
    showToast(e.response?.data?.error || 'Failed to delete campaign', 'error')
  } finally { deleteTarget.value = null }
}

async function handleClone(id: number) {
  try {
    const cloned = await cloneCampaign(id)
    await store.load()
    showToast(`Cloned as "${cloned.name}"`, 'success')
  } catch (e: any) {
    showToast(e.response?.data?.error || 'Failed to clone campaign', 'error')
  }
}

const totalActive = computed(() => store.campaigns.filter(c => c.is_active).length)
</script>

<template>
  <div class="page-enter">
    <PageHeader
      kicker="Orchestration"
      title="Campaigns"
      description="Definitions, workflow steps and live delivery across every channel."
    >
      <div v-if="auth.canWrite" class="hdr-actions">
        <button @click="blueprintOpen = true" class="btn btn-ghost" aria-label="Start from blueprint">
          <SparklesIcon class="h-4 w-4" aria-hidden="true" /> From blueprint
        </button>
        <button @click="router.push('/campaigns/new')" class="btn btn-primary">
          <PlusIcon class="h-4 w-4" /> New campaign
        </button>
      </div>
    </PageHeader>

    <BlueprintPickerModal v-model:open="blueprintOpen" />

    <!-- Meta strip -->
    <div v-if="!store.loading && store.campaigns.length" class="camp-meta">
      <span class="rule-dot">Catalogue</span>
      <span class="camp-meta-num num-tabular">{{ store.campaigns.length }}</span>
      <span class="camp-meta-lbl">total</span>
      <span class="camp-meta-sep">·</span>
      <span class="camp-meta-num num-tabular">{{ totalActive }}</span>
      <span class="camp-meta-lbl">active</span>
      <span class="camp-meta-rule" />
    </div>

    <!-- Skeletons -->
    <div v-if="store.loading" class="camp-list grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <BaseCard v-for="i in 3" :key="i" class="camp-card">
        <div class="camp-card-inner">
          <div class="skeleton h-5 w-48 mb-3"></div>
          <div class="skeleton h-3.5 w-72 mb-5"></div>
          <div class="flex gap-2">
            <div v-for="j in 3" :key="j" class="skeleton h-16 w-28 rounded"></div>
          </div>
        </div>
      </BaseCard>
    </div>

    <!-- Empty -->
    <EmptyState
      v-else-if="store.campaigns.length === 0"
      :icon="RocketLaunchIcon"
      title="No campaigns yet."
      description="Start from a blueprint or compose your own — automated journeys begin here."
    >
      <template v-if="auth.canWrite" #action>
        <button @click="blueprintOpen = true" class="btn btn-ghost">
          <SparklesIcon class="h-4 w-4" /> From blueprint
        </button>
        <button @click="router.push('/campaigns/new')" class="btn btn-primary">
          <PlusIcon class="h-4 w-4" /> New campaign
        </button>
      </template>
    </EmptyState>

    <!-- Campaign cards -->
    <div v-else class="camp-list stagger grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <BaseCard
        v-for="campaign in store.campaigns"
        :key="campaign.id"
        interactive
        class="camp-card"
        :data-active="campaign.is_active"
      >
        <span class="camp-accent" aria-hidden="true" />
        <div class="camp-card-inner">
        <!-- Header -->
        <header class="camp-head">
          <div class="camp-head-main">
            <div class="camp-title-row">
              <span class="camp-pulse" :data-active="campaign.is_active" aria-hidden="true" />
              <h3 class="camp-title">{{ campaign.name }}</h3>
            </div>
            <div class="camp-triggers">
              <span class="camp-trig-lbl">on</span>
              <code class="camp-trig-code">{{ campaign.trigger_event }}</code>
              <template v-if="campaign.cancellation_event">
                <span class="camp-trig-sep">·</span>
                <span class="camp-trig-lbl">cancel</span>
                <code class="camp-trig-code">{{ campaign.cancellation_event }}</code>
              </template>
            </div>
          </div>

          <div class="camp-head-tools">
            <StatusBadge :status="campaign.is_active ? 'active' : 'inactive'" />

            <label v-if="auth.canWrite" class="camp-toggle" :title="campaign.is_active ? 'Pause' : 'Activate'">
              <input type="checkbox" :checked="campaign.is_active" @change="handleToggle(campaign.id)" />
              <span class="camp-toggle-track"><span class="camp-toggle-thumb" /></span>
            </label>

            <div v-if="auth.canWrite" class="camp-actions">
              <button
                @click="handleClone(campaign.id)"
                class="camp-action"
                :aria-label="`Clone campaign ${campaign.name}`"
                title="Clone"
              >
                <DocumentDuplicateIcon class="h-4 w-4" />
              </button>
              <button
                @click="router.push(`/campaigns/${campaign.id}/edit`)"
                class="camp-action"
                :aria-label="`Edit campaign ${campaign.name}`"
                title="Edit"
              >
                <PencilSquareIcon class="h-4 w-4" />
              </button>
              <button
                @click="handleDelete(campaign.id, campaign.name)"
                class="camp-action camp-action-danger"
                :aria-label="`Delete campaign ${campaign.name}`"
                title="Delete"
              >
                <TrashIcon class="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <!-- Flow -->
        <div class="camp-flow">
          <div v-for="(step, i) in campaign.steps" :key="i" class="camp-step-wrap">
            <div class="camp-step">
              <div class="camp-step-idx num-tabular">{{ String(i + 1).padStart(2, '0') }}</div>
              <div class="camp-step-body">
                <ChannelChip :channel="step.channel" />
                <p class="camp-step-delay">after <strong class="num-tabular">{{ formatDelay(step.delay_minutes) }}</strong></p>
                <p class="camp-step-tpl" :title="step.template_key">{{ step.template_key }}</p>
              </div>
            </div>
            <svg v-if="i < campaign.steps.length - 1" class="camp-flow-arrow" viewBox="0 0 24 24" fill="none">
              <path d="M4 12h14m-4-4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>

        <!-- Footer meta -->
        <footer class="camp-foot">
          <div class="camp-foot-item">
            <span class="camp-foot-lbl">Segment</span>
            <code class="camp-foot-val">{{ campaign.segment_filter }}</code>
          </div>
          <div class="camp-foot-item">
            <span class="camp-foot-lbl">Slug</span>
            <code class="camp-foot-val">{{ campaign.slug }}</code>
          </div>
          <div class="camp-foot-item camp-foot-item-right">
            <span class="camp-foot-lbl">Steps</span>
            <span class="camp-foot-val num-tabular">{{ campaign.steps.length }}</span>
          </div>
        </footer>
        </div>
      </BaseCard>
    </div>

    <ConfirmDialog
      :open="deleteOpen"
      :title="`Delete campaign ${deleteTarget?.name || ''}?`"
      message="This removes the campaign definition and its step history. Enrollments in flight are cancelled. This cannot be undone."
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

/* ── Meta strip ── */
.camp-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 20px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-tertiary);
  letter-spacing: 0.02em;
}
.camp-meta-num { color: var(--color-text-primary); font-weight: 500; font-size: 12px; }
.camp-meta-lbl { color: var(--color-text-muted); }
.camp-meta-sep { color: var(--color-border-strong); }
.camp-meta-rule { flex: 1; height: 1px; background: var(--color-divider); margin-left: 8px; }

/* ── List ──
 * Responsive grid: single column on mobile, 2-up at md, 3-up at xl. Layout
 * classes live on the element (grid/grid-cols-*); this rule just ensures
 * long flow strips can shrink inside grid cells. */
.camp-list { min-width: 0; }
.camp-list > * { min-width: 0; }

/* ── Card ── */
.camp-card {
  position: relative;
}
.camp-card[data-active="false"] { opacity: 0.86; }
.camp-card-inner { min-width: 0; }
.camp-accent {
  position: absolute;
  left: 0; top: 16px; bottom: 16px;
  width: 3px; border-radius: 2px;
  background: var(--color-border-strong);
  transition: background var(--transition-fast);
}
.camp-card[data-active="true"] .camp-accent { background: var(--hks-cyan); }

.camp-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.camp-head-main { min-width: 0; flex: 1; }

.camp-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.camp-pulse {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--color-text-muted);
  flex-shrink: 0;
}
.camp-pulse[data-active="true"] {
  background: var(--color-success);
  box-shadow: 0 0 0 3px rgba(11, 122, 75, 0.15);
  animation: campPulse 2.4s ease-in-out infinite;
}
@keyframes campPulse { 50% { box-shadow: 0 0 0 6px rgba(11, 122, 75, 0); } }

.camp-title {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 22px;
  line-height: 1.1;
  letter-spacing: -0.015em;
  color: var(--color-text-primary);
  font-variation-settings: 'opsz' 72, 'SOFT' 30;
  word-break: break-word;
}

.camp-triggers {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.camp-trig-lbl {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
.camp-trig-code {
  font-family: var(--font-mono);
  font-size: 11.5px;
  padding: 2px 7px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-muted);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  word-break: break-all;
}
.camp-trig-sep { color: var(--color-border-strong); margin: 0 4px; }

.camp-head-tools {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* ── Toggle ── */
.camp-toggle { position: relative; display: inline-flex; cursor: pointer; }
.camp-toggle input { position: absolute; opacity: 0; pointer-events: none; }
.camp-toggle-track {
  width: 34px; height: 18px;
  background: var(--color-bg-muted);
  border-radius: 9999px;
  border: 1px solid var(--color-border);
  position: relative;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}
.camp-toggle-thumb {
  position: absolute;
  top: 1px; left: 1px;
  width: 14px; height: 14px;
  background: var(--color-bg-card);
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
  transition: transform var(--transition-fast);
}
.camp-toggle input:checked + .camp-toggle-track {
  background: var(--hks-deep-blue);
  border-color: var(--hks-deep-blue);
}
.camp-toggle input:checked + .camp-toggle-track .camp-toggle-thumb {
  transform: translateX(16px);
}
.camp-toggle input:focus-visible + .camp-toggle-track {
  box-shadow: 0 0 0 3px var(--color-accent-light);
}

/* ── Actions ── */
.camp-actions { display: inline-flex; gap: 2px; }
.camp-action {
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
.camp-action:hover {
  color: var(--hks-deep-blue);
  background: var(--color-bg-subtle);
  border-color: var(--color-border);
}
.camp-action-danger:hover { color: var(--color-error); border-color: var(--color-error-border); }

/* ── Flow ── */
.camp-flow {
  display: flex;
  align-items: stretch;
  gap: 0;
  overflow-x: auto;
  scrollbar-width: thin;
  padding: 2px 0 10px;
  margin-bottom: 14px;
  border-top: 1px solid var(--color-divider);
  border-bottom: 1px solid var(--color-divider);
  padding-top: 16px;
  padding-bottom: 16px;
  min-width: 0;
}
.camp-flow::-webkit-scrollbar { height: 4px; }
.camp-flow::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 2px; }
.camp-step-wrap { display: inline-flex; align-items: center; gap: 10px; flex-shrink: 0; }
.camp-step {
  display: flex;
  gap: 10px;
  padding: 10px 14px;
  min-width: 180px;
  max-width: 220px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-muted);
  border-radius: var(--radius-md);
  transition: border-color var(--transition-fast), transform var(--transition-fast);
}
.camp-step:hover { border-color: var(--color-border-strong); transform: translateY(-1px); }
.camp-step-idx {
  font-family: var(--font-display);
  font-weight: 300;
  font-size: 28px;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--hks-cyan);
  font-variation-settings: 'opsz' 72;
  padding-top: 2px;
}
.camp-step-body { min-width: 0; flex: 1; }
.camp-step-delay {
  margin-top: 6px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
}
.camp-step-delay strong { color: var(--color-text-secondary); font-weight: 500; }
.camp-step-tpl {
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--color-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.camp-flow-arrow {
  width: 18px; height: 18px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

/* Channel chips moved to <ChannelChip> — single source of truth in
 * src/components/ChannelChip.vue. */

/* ── Footer ── */
.camp-foot {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  align-items: center;
  padding-top: 2px;
}
.camp-foot-item { display: inline-flex; align-items: baseline; gap: 6px; }
.camp-foot-item-right { margin-left: auto; }
.camp-foot-lbl {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
.camp-foot-val {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--color-text-secondary);
  padding: 1px 6px;
  background: var(--color-bg-subtle);
  border-radius: var(--radius-sm);
}
.camp-foot-item-right .camp-foot-val {
  background: transparent;
  color: var(--color-text-primary);
  font-size: 13px;
  padding: 0;
}

/* Empty state moved to <EmptyState> — single source of truth. */
</style>
