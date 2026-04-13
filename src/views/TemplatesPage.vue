<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import CloneVariantDialog from '@/components/CloneVariantDialog.vue'
import TestSendModal from '@/components/TestSendModal.vue'
import ChannelChip from '@/components/ChannelChip.vue'
import { useTemplatesStore } from '@/stores/templates'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import {
  PlusIcon, PencilSquareIcon, TrashIcon, PaperAirplaneIcon,
  LanguageIcon, MagnifyingGlassIcon, ChevronRightIcon,
} from '@heroicons/vue/24/outline'
import type { MessageTemplate } from '@/api/types'

const router = useRouter()
const route = useRoute()
const store = useTemplatesStore()
const auth = useAuthStore()
const { showToast } = useToast()

// Filters are URL-synced so bookmarks, refresh and back-navigation preserve
// the view. Query params: ?channel=email&locale=ar-iq&q=welcome
const channelFilter = ref((route.query.channel as string) || '')
const localeFilter = ref((route.query.locale as string) || '')
const search = ref((route.query.q as string) || '')
const expanded = ref<Set<string>>(new Set())
const testSendOpen = ref(false)

const channels = ['', 'email', 'sms', 'whatsapp', 'push']

onMounted(() => store.load(channelFilter.value || undefined))

async function filterByChannel(ch: string) {
  channelFilter.value = ch
  await store.load(ch || undefined)
  // Reset local filters when channel changes
  localeFilter.value = ''
  search.value = ''
}

// Write filter state back to the URL (replace, not push, so back button
// still takes users to the previous page rather than walking through each keystroke).
watch([channelFilter, localeFilter, search], () => {
  const q: Record<string, string> = {}
  if (channelFilter.value) q.channel = channelFilter.value
  if (localeFilter.value) q.locale = localeFilter.value
  if (search.value.trim()) q.q = search.value.trim()
  router.replace({ query: q }).catch(() => { /* duplicate navigation */ })
})

function clearFilters() {
  channelFilter.value = ''
  localeFilter.value = ''
  search.value = ''
  store.load()
}

async function copyKey(key: string, evt?: MouseEvent) {
  evt?.preventDefault()
  evt?.stopPropagation()
  try {
    await navigator.clipboard.writeText(key)
    showToast(`Copied "${key}"`, 'success', 1800)
  } catch {
    showToast('Could not access clipboard', 'error')
  }
}

const LOCALE_SUFFIX_RE = /\.([a-z]{2}(-[a-z]{2})?)$/i
function stripLocale(key: string): { base: string; locale: string } {
  const m = key.match(LOCALE_SUFFIX_RE)
  if (!m || !m[0] || !m[1]) return { base: key, locale: '' }
  return { base: key.slice(0, -m[0].length), locale: m[1].toLowerCase() }
}

interface GroupRow { base: MessageTemplate; variants: MessageTemplate[]; locales: Set<string> }

// Group templates by base key: { welcome_email, [welcome_email.ar-iq, welcome_email.fr] }
// Two-pass — backend may return rows in any order (newer-first by default),
// so we can't assume the base arrives before its variants.
const grouped = computed<GroupRow[]>(() => {
  const bases: Record<string, GroupRow> = {}

  // Pass 1: collect all bases (no locale suffix).
  for (const t of store.templates) {
    const { locale } = stripLocale(t.template_key)
    if (!locale) {
      bases[t.template_key] = { base: t, variants: [], locales: new Set() }
    }
  }

  // Pass 2: attach variants to their base, or orphan-promote if the base is absent.
  for (const t of store.templates) {
    const { base, locale } = stripLocale(t.template_key)
    if (!locale) continue
    const parent = bases[base]
    if (parent) {
      parent.variants.push(t)
      parent.locales.add(locale)
    } else {
      // No base for this variant — show it as its own row so it's still editable.
      bases[t.template_key] = { base: t, variants: [], locales: new Set() }
    }
  }

  // Sort variants inside each group by locale for stable display.
  for (const g of Object.values(bases)) {
    g.variants.sort((a, b) => a.template_key.localeCompare(b.template_key))
  }

  return Object.values(bases).sort((a, b) =>
    a.base.template_key.localeCompare(b.base.template_key),
  )
})

// Apply search + locale filter over the grouped list
const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  const lf = localeFilter.value
  return grouped.value.filter((g) => {
    if (q) {
      const haystack = `${g.base.name} ${g.base.template_key}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (lf) {
      if (lf === '__base__') return true // always show the base row
      return g.locales.has(lf)
    }
    return true
  })
})

const localeChoices = computed(() => {
  const all = new Set<string>()
  for (const g of grouped.value) for (const l of g.locales) all.add(l)
  return Array.from(all).sort()
})

const totalVariants = computed(() =>
  grouped.value.reduce((acc, g) => acc + g.variants.length, 0),
)

// Filter-aware counts for the toolbar meta. When any filter is active the
// counter reflects the visible subset; when none are active it falls back to
// the global totals so the overall catalogue size is still discoverable.
const visibleVariants = computed(() =>
  visible.value.reduce((acc, g) => {
    // If a locale filter is set, only count variants that match it;
    // otherwise count all variants on the visible bases.
    const lf = localeFilter.value
    return acc + (lf ? (g.locales.has(lf) ? 1 : 0) : g.variants.length)
  }, 0),
)
const isFiltered = computed(() =>
  !!localeFilter.value || !!search.value.trim() || !!channelFilter.value,
)

function toggle(key: string) {
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}

function expandAll() {
  expanded.value = new Set(grouped.value.filter((g) => g.variants.length > 0).map((g) => g.base.template_key))
}
function collapseAll() {
  expanded.value = new Set()
}

// ── Delete flow via ConfirmDialog ──
const deleteTarget = ref<MessageTemplate | null>(null)
const deleteOpen = computed({
  get: () => !!deleteTarget.value,
  set: (v) => { if (!v) deleteTarget.value = null },
})
async function confirmDelete() {
  if (!deleteTarget.value) return
  const t = deleteTarget.value
  try {
    await store.remove(t.id)
    showToast(`Deleted "${t.name}"`, 'success')
  } catch (e: any) {
    showToast(e.response?.data?.error || 'Failed to delete template', 'error')
  } finally {
    deleteTarget.value = null
  }
}

// ── Clone-variant flow via modal ──
const cloneSource = ref<GroupRow | null>(null)
async function confirmClone(locale: string) {
  if (!cloneSource.value) return
  const g = cloneSource.value
  try {
    const variant = await store.cloneVariant(g.base.id, locale)
    showToast(`Draft variant "${variant.template_key}" created`, 'success')
    cloneSource.value = null
    router.push(`/templates/${variant.id}/edit`)
  } catch (e: any) {
    showToast(e.response?.data?.error || 'Failed to clone variant', 'error')
  }
}

// Channel chip styling moved to <ChannelChip>.
</script>

<template>
  <div class="page-enter">
    <PageHeader
      kicker="Catalogue"
      title="Templates"
      description="Every channel and every supported locale, resolved per recipient at send time."
    >
      <button
        v-if="auth.canWrite"
        @click="testSendOpen = true"
        class="btn btn-ghost"
      >
        <PaperAirplaneIcon class="h-4 w-4" /> Test send
      </button>
      <button
        v-if="auth.canWrite"
        @click="router.push('/templates/new')"
        class="btn btn-primary"
      >
        <PlusIcon class="h-4 w-4" /> New template
      </button>
    </PageHeader>

    <!-- Editorial toolbar -->
    <div class="tpl-toolbar">
      <div class="tpl-tabs">
        <button
          v-for="ch in channels"
          :key="ch"
          @click="filterByChannel(ch)"
          :class="['tpl-tab', { 'tpl-tab-active': channelFilter === ch }]"
        >
          {{ ch || 'All' }}
        </button>
      </div>

      <span class="tpl-sep" />

      <select v-model="localeFilter" class="tpl-select">
        <option value="">All locales</option>
        <option v-for="l in localeChoices" :key="l" :value="l">Has {{ l }}</option>
      </select>

      <div class="tpl-search">
        <MagnifyingGlassIcon class="tpl-search-icon" />
        <input
          v-model="search"
          type="search"
          placeholder="Search name or key…"
          class="tpl-search-input"
        />
      </div>

      <div class="tpl-meta">
        <span class="tpl-meta-count">
          <template v-if="isFiltered">
            <strong class="num-tabular">{{ visible.length }}</strong>
            <span class="tpl-meta-faint"> of </span>
            <strong class="num-tabular">{{ grouped.length }}</strong> base
            <span class="tpl-meta-sep">·</span>
            <strong class="num-tabular">{{ visibleVariants }}</strong> variant{{ visibleVariants === 1 ? '' : 's' }}
          </template>
          <template v-else>
            <strong class="num-tabular">{{ grouped.length }}</strong> base
            <span class="tpl-meta-sep">·</span>
            <strong class="num-tabular">{{ totalVariants }}</strong> variant{{ totalVariants === 1 ? '' : 's' }}
          </template>
        </span>
        <button v-if="totalVariants > 0" @click="expandAll" class="tpl-meta-link">Expand</button>
        <button v-if="totalVariants > 0" @click="collapseAll" class="tpl-meta-link">Collapse</button>
      </div>
    </div>

    <!-- Body -->
    <div v-if="store.loading" class="tpl-loading">
      <div class="tpl-spinner" />
      <p>Loading catalogue…</p>
    </div>

    <div v-else-if="visible.length === 0" class="tpl-empty">
      <p class="tpl-empty-headline">No templates match these filters.</p>
      <p class="tpl-empty-sub">Try a different channel, locale, or search term.</p>
      <button v-if="isFiltered" type="button" @click="clearFilters" class="btn btn-ghost" style="margin-top: 18px;">
        Clear filters
      </button>
    </div>

    <div v-else class="tpl-card table-scroll">
      <table class="tpl-table">
        <thead class="bg-[var(--color-bg-page)] border-b border-[var(--color-border)]">
          <tr>
            <th class="tpl-th tpl-th-toggle"></th>
            <th class="tpl-th">Template</th>
            <th class="tpl-th tpl-th-key">Key</th>
            <th class="tpl-th">Channel</th>
            <th class="tpl-th">Variants</th>
            <th class="tpl-th">Status</th>
            <th class="tpl-th tpl-th-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="g in visible" :key="g.base.id">
            <tr class="tpl-row" :class="{ 'tpl-row-expanded': expanded.has(g.base.template_key) }">
              <td class="tpl-td tpl-td-toggle">
                <button
                  v-if="g.variants.length > 0"
                  @click="toggle(g.base.template_key)"
                  class="tpl-chevron"
                  :aria-label="expanded.has(g.base.template_key) ? 'Collapse' : 'Expand'"
                >
                  <ChevronRightIcon
                    class="h-3.5 w-3.5 transition-transform"
                    :class="{ 'rotate-90': expanded.has(g.base.template_key) }"
                  />
                </button>
              </td>
              <td class="tpl-td">
                <div class="tpl-name">{{ g.base.name }}</div>
                <div class="tpl-name-meta" v-if="g.variants.length">
                  <span class="num-tabular">{{ g.variants.length }}</span>
                  {{ g.variants.length === 1 ? 'variant' : 'variants' }}
                </div>
              </td>
              <td class="tpl-td">
                <code
                  class="tpl-key tpl-key-copyable"
                  :title="`Copy ${g.base.template_key}`"
                  @click="copyKey(g.base.template_key, $event)"
                >{{ g.base.template_key }}</code>
              </td>
              <td class="tpl-td">
                <ChannelChip :channel="g.base.channel" />
              </td>
              <td class="tpl-td">
                <div v-if="g.variants.length" class="tpl-locales">
                  <span
                    v-for="v in g.variants"
                    :key="v.id"
                    :class="['tpl-loc', v.is_active ? 'tpl-loc-active' : 'tpl-loc-draft']"
                    :title="v.is_active ? 'Active variant' : 'Draft (inactive)'"
                  >
                    {{ stripLocale(v.template_key).locale }}
                  </span>
                </div>
                <span v-else class="tpl-empty-inline">—</span>
              </td>
              <td class="tpl-td">
                <span class="tpl-status" :data-active="g.base.is_active">
                  <span class="tpl-status-dot" />
                  {{ g.base.is_active ? 'Active' : 'Paused' }}
                </span>
              </td>
              <td class="tpl-td tpl-td-right">
                <div v-if="auth.canWrite" class="tpl-actions">
                  <button
                    @click="router.push(`/templates/${g.base.id}/edit`)"
                    class="tpl-action"
                    :aria-label="`Edit template ${g.base.name}`"
                    title="Edit"
                  >
                    <PencilSquareIcon class="h-4 w-4" />
                  </button>
                  <button
                    @click="cloneSource = g"
                    class="tpl-action"
                    :aria-label="`Clone ${g.base.name} as locale variant`"
                    title="Clone as locale variant"
                  >
                    <LanguageIcon class="h-4 w-4" />
                  </button>
                  <button
                    @click="deleteTarget = g.base"
                    class="tpl-action tpl-action-danger"
                    :aria-label="`Delete template ${g.base.name}`"
                    title="Delete"
                  >
                    <TrashIcon class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>

            <template v-if="expanded.has(g.base.template_key)">
              <tr
                v-for="v in g.variants"
                :key="v.id"
                class="tpl-row tpl-row-variant"
              >
                <td class="tpl-td tpl-td-toggle"></td>
                <td class="tpl-td tpl-td-variant-name">
                  <span class="tpl-variant-arrow">└</span>
                  <span class="tpl-variant-name">{{ v.name }}</span>
                </td>
                <td class="tpl-td">
                  <code
                    class="tpl-key tpl-key-sm tpl-key-copyable"
                    :title="`Copy ${v.template_key}`"
                    @click="copyKey(v.template_key, $event)"
                  >{{ v.template_key }}</code>
                </td>
                <td class="tpl-td">
                  <span class="tpl-loc tpl-loc-active tpl-loc-inline">{{ stripLocale(v.template_key).locale }}</span>
                </td>
                <td class="tpl-td"></td>
                <td class="tpl-td">
                  <span class="tpl-status" :data-active="v.is_active">
                    <span class="tpl-status-dot" />
                    {{ v.is_active ? 'Active' : 'Draft' }}
                  </span>
                </td>
                <td class="tpl-td tpl-td-right">
                  <div v-if="auth.canWrite" class="tpl-actions">
                    <button
                      @click="router.push(`/templates/${v.id}/edit`)"
                      class="tpl-action"
                      :aria-label="`Edit ${v.name} variant`"
                      title="Edit variant"
                    >
                      <PencilSquareIcon class="h-3.5 w-3.5" />
                    </button>
                    <button
                      @click="deleteTarget = v"
                      class="tpl-action tpl-action-danger"
                      :aria-label="`Delete ${v.name} variant`"
                      title="Delete variant"
                    >
                      <TrashIcon class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Modals -->
    <TestSendModal :open="testSendOpen" @close="testSendOpen = false" />

    <ConfirmDialog
      :open="deleteOpen"
      :title="`Delete ${deleteTarget?.name || 'template'}?`"
      :message="`This permanently removes the row. Any campaign referencing ${deleteTarget?.template_key} will fall back to a variant or send nothing.`"
      confirm-text="Delete"
      cancel-text="Keep"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="deleteTarget = null"
    />

    <CloneVariantDialog
      :open="!!cloneSource"
      :base-key="cloneSource?.base.template_key || ''"
      :base-name="cloneSource?.base.name || ''"
      :existing-locales="cloneSource ? Array.from(cloneSource.locales) : []"
      @confirm="confirmClone"
      @cancel="cloneSource = null"
    />
  </div>
</template>

<style scoped>
/* ─────────── Toolbar ─────────── */
.tpl-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 6px;
  margin-bottom: 18px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.tpl-tabs {
  display: flex;
  gap: 2px;
  padding: 2px;
  background: var(--color-bg-subtle);
  border-radius: var(--radius-md);
}
.tpl-tab {
  padding: 5px 12px;
  font-family: var(--font-sans);
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--color-text-tertiary);
  background: transparent;
  border: none;
  border-radius: calc(var(--radius-md) - 2px);
  cursor: pointer;
  text-transform: capitalize;
  transition: color var(--transition-fast), background var(--transition-fast);
}
.tpl-tab:hover { color: var(--color-text-secondary); }
.tpl-tab-active {
  color: var(--color-text-primary);
  background: var(--color-bg-card);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.tpl-sep {
  width: 1px;
  height: 20px;
  background: var(--color-border);
  margin: 0 2px;
}

.tpl-select, .tpl-search-input {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg-page);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 5px 10px;
  transition: border-color var(--transition-fast);
}
.tpl-select:hover, .tpl-search-input:hover { border-color: var(--color-border-strong); }
.tpl-select:focus, .tpl-search-input:focus {
  outline: none;
  border-color: var(--hks-cyan);
  box-shadow: 0 0 0 2px var(--color-accent-light);
}

.tpl-search {
  position: relative;
  flex: 1;
  min-width: 200px;
  max-width: 340px;
}
.tpl-search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  color: var(--color-text-muted);
  pointer-events: none;
}
.tpl-search-input {
  width: 100%;
  padding-left: 28px;
}

.tpl-meta {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 14px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
}
.tpl-meta-count strong {
  font-weight: 500;
  color: var(--color-text-secondary);
}
.tpl-meta-sep {
  color: var(--color-border-strong);
  margin: 0 4px;
}
.tpl-meta-faint {
  color: var(--color-text-muted);
  font-weight: 400;
  padding: 0 2px;
}
.tpl-meta-link {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--hks-cyan);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
}
.tpl-meta-link:hover { text-decoration: underline; }

/* ─────────── States ─────────── */
.tpl-loading {
  padding: 96px 20px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
}
.tpl-spinner {
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-top-color: var(--hks-cyan);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin-bottom: 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }

.tpl-empty {
  padding: 88px 24px;
  text-align: center;
  background: var(--color-bg-card);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-md);
}
.tpl-empty-headline {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 400;
  color: var(--color-text-secondary);
  letter-spacing: -0.01em;
  font-variation-settings: 'opsz' 72;
}
.tpl-empty-sub {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--color-text-muted);
}

/* ─────────── Table ─────────── */
.tpl-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.tpl-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-sans);
}

.tpl-th {
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
.tpl-th-toggle { width: 36px; padding-left: 16px; padding-right: 0; }
.tpl-th-right { text-align: right; }
.tpl-th-key { width: 30%; }

.tpl-row { transition: background var(--transition-fast); }
.tpl-row:hover { background: var(--color-bg-subtle); }
.tpl-row-expanded { background: var(--color-bg-subtle); }

.tpl-td {
  padding: 14px 16px;
  font-size: 13px;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-divider);
  vertical-align: middle;
}
.tpl-row:last-child .tpl-td { border-bottom: 0; }
.tpl-td-toggle { width: 36px; padding-right: 0; }
.tpl-td-right { text-align: right; }

.tpl-chevron {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast);
}
.tpl-chevron:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-muted);
  border-color: var(--color-border);
}

.tpl-name {
  font-family: var(--font-sans);
  font-weight: 500;
  font-size: 13.5px;
  color: var(--color-text-primary);
  letter-spacing: -0.005em;
}
.tpl-name-meta {
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
}
.tpl-name-meta strong { color: var(--color-text-tertiary); font-weight: 500; }

.tpl-key {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 11.5px;
  font-weight: 400;
  color: var(--color-text-tertiary);
  letter-spacing: -0.005em;
  padding: 2px 7px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-muted);
}
.tpl-key-sm { font-size: 10.5px; padding: 1px 6px; }
.tpl-key-copyable {
  cursor: copy;
  transition: color var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast);
}
.tpl-key-copyable:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-hover);
  border-color: var(--color-border-strong);
}
.tpl-key-copyable:active {
  color: var(--hks-cyan);
  border-color: var(--color-accent-light);
}

/* Channel chip styles moved to <ChannelChip>. */

/* ─── Locale badges ─── */
.tpl-locales {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.tpl-loc {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: var(--radius-sm);
  border: 1px solid;
}
.tpl-loc-active {
  color: var(--hks-cyan);
  background: var(--color-accent-soft);
  border-color: var(--color-accent-light);
}
.tpl-loc-draft {
  color: var(--color-text-muted);
  background: var(--color-bg-subtle);
  border-color: var(--color-border);
  font-style: italic;
}
.tpl-loc-inline { display: inline-block; }

.tpl-empty-inline {
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

/* ─── Status ─── */
.tpl-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--font-sans);
  font-size: 11.5px;
  font-weight: 500;
  color: var(--color-text-tertiary);
}
.tpl-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-muted);
}
.tpl-status[data-active="true"] { color: var(--color-success); }
.tpl-status[data-active="true"] .tpl-status-dot {
  background: var(--color-success);
  box-shadow: 0 0 0 2px rgba(11, 122, 75, 0.15);
}

/* ─── Actions ─── */
.tpl-actions {
  display: inline-flex;
  gap: 2px;
}
.tpl-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast);
}
.tpl-action:hover {
  color: var(--hks-deep-blue);
  background: var(--color-bg-card);
  border-color: var(--color-border);
}
.tpl-action-danger:hover {
  color: var(--color-error);
  border-color: var(--color-error-border);
}

/* ─── Variant rows (nested) ─── */
.tpl-row-variant {
  background: var(--color-bg-subtle);
}
.tpl-row-variant .tpl-td { padding-top: 10px; padding-bottom: 10px; }
.tpl-td-variant-name {
  padding-left: 28px !important;
  display: flex;
  align-items: center;
  gap: 8px;
}
.tpl-variant-arrow {
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
}
.tpl-variant-name {
  font-size: 12.5px;
  color: var(--color-text-secondary);
}
</style>
