<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import CloneVariantDialog from '@/components/CloneVariantDialog.vue'
import TestSendModal from '@/components/TestSendModal.vue'
import { useTemplatesStore } from '@/stores/templates'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import {
  PlusIcon, PencilSquareIcon, TrashIcon, PaperAirplaneIcon,
  LanguageIcon, MagnifyingGlassIcon, ChevronRightIcon,
} from '@heroicons/vue/24/outline'
import type { MessageTemplate } from '@/api/types'

const router = useRouter()
const store = useTemplatesStore()
const auth = useAuthStore()
const { showToast } = useToast()

const channelFilter = ref('')
const localeFilter = ref('')
const search = ref('')
const expanded = ref<Set<string>>(new Set())
const testSendOpen = ref(false)

const channels = ['', 'email', 'sms', 'whatsapp', 'push']

onMounted(() => store.load())

async function filterByChannel(ch: string) {
  channelFilter.value = ch
  await store.load(ch || undefined)
  // Reset local filters when channel changes
  localeFilter.value = ''
  search.value = ''
}

const LOCALE_SUFFIX_RE = /\.([a-z]{2}(-[a-z]{2})?)$/i
function stripLocale(key: string): { base: string; locale: string } {
  const m = key.match(LOCALE_SUFFIX_RE)
  if (!m || !m[0] || !m[1]) return { base: key, locale: '' }
  return { base: key.slice(0, -m[0].length), locale: m[1].toLowerCase() }
}

interface GroupRow { base: MessageTemplate; variants: MessageTemplate[]; locales: Set<string> }

// Group templates by base key: { welcome_email, [welcome_email.ar-iq, welcome_email.fr] }
const grouped = computed<GroupRow[]>(() => {
  const bases: Record<string, GroupRow> = {}
  const orphans: MessageTemplate[] = []
  for (const t of store.templates) {
    const { base, locale } = stripLocale(t.template_key)
    if (!locale) {
      const existing = bases[t.template_key]
      bases[t.template_key] = existing ? { ...existing, base: t } : { base: t, variants: [], locales: new Set() }
    } else {
      const parent = bases[base]
      if (!parent) {
        orphans.push(t)
        continue
      }
      parent.variants.push(t)
      parent.locales.add(locale)
    }
  }
  // Promote orphan variants to their own rows so they're still reachable/editable
  for (const o of orphans) {
    bases[o.template_key] = { base: o, variants: [], locales: new Set() }
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

const channelColors: Record<string, string> = {
  email: 'bg-blue-100 text-blue-800',
  sms: 'bg-purple-100 text-purple-800',
  whatsapp: 'bg-green-100 text-green-800',
  push: 'bg-orange-100 text-orange-800',
}
</script>

<template>
  <div class="page-enter">
    <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
      <PageHeader title="Templates" description="Message templates for each channel, with per-locale variants resolved at send time" />
      <div class="flex items-center gap-2">
        <button
          v-if="auth.canWrite"
          @click="testSendOpen = true"
          class="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] text-sm font-medium rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors"
        >
          <PaperAirplaneIcon class="h-4 w-4" /> Test send
        </button>
        <button
          v-if="auth.canWrite"
          @click="router.push('/templates/new')"
          class="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors shadow-sm"
        >
          <PlusIcon class="h-4 w-4" /> New template
        </button>
      </div>
    </div>

    <!-- Filter toolbar -->
    <div class="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2">
      <div class="flex gap-1.5">
        <button
          v-for="ch in channels"
          :key="ch"
          @click="filterByChannel(ch)"
          :class="[
            'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
            channelFilter === ch
              ? 'bg-[var(--color-primary)] text-white shadow-sm'
              : 'text-[var(--color-text-secondary)] bg-[var(--color-bg-page)] hover:bg-[var(--color-bg-hover)]',
          ]"
        >
          {{ ch || 'All channels' }}
        </button>
      </div>

      <div class="h-5 w-px bg-[var(--color-border)] mx-1 hidden sm:block" />

      <!-- Locale filter -->
      <select
        v-model="localeFilter"
        class="px-2.5 py-1.5 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-page)] text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
      >
        <option value="">Any locale</option>
        <option v-for="l in localeChoices" :key="l" :value="l">Has {{ l }} variant</option>
      </select>

      <!-- Search -->
      <div class="relative flex-1 min-w-[200px] max-w-sm">
        <MagnifyingGlassIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
        <input
          v-model="search"
          type="search"
          placeholder="Search by name or key…"
          class="w-full pl-8 pr-3 py-1.5 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-page)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
        />
      </div>

      <div class="ml-auto flex items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
        <span>{{ grouped.length }} base · {{ totalVariants }} variant{{ totalVariants === 1 ? '' : 's' }}</span>
        <button v-if="totalVariants > 0" @click="expandAll" class="text-[var(--color-primary)] hover:underline">Expand all</button>
        <button v-if="totalVariants > 0" @click="collapseAll" class="text-[var(--color-primary)] hover:underline">Collapse all</button>
      </div>
    </div>

    <!-- Body -->
    <div v-if="store.loading" class="text-center py-16">
      <div class="inline-block h-8 w-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      <p class="mt-3 text-sm text-[var(--color-text-muted)]">Loading templates…</p>
    </div>

    <div
      v-else-if="visible.length === 0"
      class="text-center py-16 bg-[var(--color-bg-card)] rounded-xl border border-dashed border-[var(--color-border)]"
    >
      <p class="text-sm font-medium text-[var(--color-text-secondary)]">No templates match the current filters.</p>
      <p class="mt-1 text-xs text-[var(--color-text-muted)]">Try clearing the search or selecting a different channel.</p>
    </div>

    <div v-else class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-[var(--color-bg-page)] border-b border-[var(--color-border)]">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-[var(--color-text-tertiary)] w-6"></th>
            <th class="text-left px-4 py-3 font-medium text-[var(--color-text-tertiary)]">Name</th>
            <th class="text-left px-4 py-3 font-medium text-[var(--color-text-tertiary)]">Key</th>
            <th class="text-left px-4 py-3 font-medium text-[var(--color-text-tertiary)]">Channel</th>
            <th class="text-left px-4 py-3 font-medium text-[var(--color-text-tertiary)]">Locales</th>
            <th class="text-left px-4 py-3 font-medium text-[var(--color-text-tertiary)]">Status</th>
            <th class="text-right px-4 py-3 font-medium text-[var(--color-text-tertiary)]">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--color-border-muted)]">
          <template v-for="g in visible" :key="g.base.id">
            <!-- Base row -->
            <tr class="hover:bg-[var(--color-bg-hover)] transition-colors">
              <td class="px-4 py-3 align-middle">
                <button
                  v-if="g.variants.length > 0"
                  @click="toggle(g.base.template_key)"
                  class="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  :aria-label="expanded.has(g.base.template_key) ? 'Collapse' : 'Expand'"
                >
                  <ChevronRightIcon
                    class="h-4 w-4 transition-transform"
                    :class="{ 'rotate-90': expanded.has(g.base.template_key) }"
                  />
                </button>
              </td>
              <td class="px-4 py-3 font-medium text-[var(--color-text-primary)]">{{ g.base.name }}</td>
              <td class="px-4 py-3 text-[var(--color-text-tertiary)]">
                <code class="bg-[var(--color-bg-subtle)] px-1.5 py-0.5 rounded text-xs">{{ g.base.template_key }}</code>
              </td>
              <td class="px-4 py-3">
                <span
                  class="text-xs font-medium inline-block px-1.5 py-0.5 rounded"
                  :class="channelColors[g.base.channel] || 'bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)]'"
                >
                  {{ g.base.channel }}
                </span>
              </td>
              <td class="px-4 py-3">
                <div v-if="g.variants.length" class="flex flex-wrap gap-1">
                  <span
                    v-for="v in g.variants"
                    :key="v.id"
                    :class="[
                      'text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border',
                      v.is_active
                        ? 'bg-[var(--color-info-bg)] text-[var(--color-primary)] border-[var(--color-primary-border)]'
                        : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] border-[var(--color-border)]',
                    ]"
                    :title="v.is_active ? 'Active variant' : 'Draft variant (inactive)'"
                  >
                    {{ stripLocale(v.template_key).locale }}
                  </span>
                </div>
                <span v-else class="text-[11px] text-[var(--color-text-muted)] italic">No variants</span>
              </td>
              <td class="px-4 py-3">
                <StatusBadge :status="g.base.is_active ? 'active' : 'inactive'" />
              </td>
              <td class="px-4 py-3 text-right">
                <div v-if="auth.canWrite" class="flex items-center justify-end gap-1">
                  <button
                    @click="router.push(`/templates/${g.base.id}/edit`)"
                    class="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                    title="Edit"
                  ><PencilSquareIcon class="h-4 w-4" /></button>
                  <button
                    @click="cloneSource = g"
                    class="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                    title="Clone as locale variant"
                  ><LanguageIcon class="h-4 w-4" /></button>
                  <button
                    @click="deleteTarget = g.base"
                    class="p-1.5 text-[var(--color-text-muted)] hover:text-red-600 transition-colors"
                    title="Delete"
                  ><TrashIcon class="h-4 w-4" /></button>
                </div>
              </td>
            </tr>

            <!-- Variant child rows -->
            <template v-if="expanded.has(g.base.template_key)">
              <tr
                v-for="v in g.variants"
                :key="v.id"
                class="bg-[var(--color-bg-page)] hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <td class="px-4 py-2 align-middle"></td>
                <td class="px-4 py-2 pl-8 text-[var(--color-text-secondary)] text-[13px]">
                  <span class="text-[var(--color-text-muted)]">↳</span> {{ v.name }}
                </td>
                <td class="px-4 py-2 text-[var(--color-text-tertiary)]">
                  <code class="bg-[var(--color-bg-subtle)] px-1.5 py-0.5 rounded text-[11px]">{{ v.template_key }}</code>
                </td>
                <td class="px-4 py-2 text-[11px] text-[var(--color-text-muted)]">{{ v.channel }}</td>
                <td class="px-4 py-2">
                  <span class="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-info-bg)] text-[var(--color-primary)]">
                    {{ stripLocale(v.template_key).locale }}
                  </span>
                </td>
                <td class="px-4 py-2">
                  <StatusBadge :status="v.is_active ? 'active' : 'inactive'" />
                </td>
                <td class="px-4 py-2 text-right">
                  <div v-if="auth.canWrite" class="flex items-center justify-end gap-1">
                    <button
                      @click="router.push(`/templates/${v.id}/edit`)"
                      class="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                      title="Edit variant"
                    ><PencilSquareIcon class="h-3.5 w-3.5" /></button>
                    <button
                      @click="deleteTarget = v"
                      class="p-1.5 text-[var(--color-text-muted)] hover:text-red-600 transition-colors"
                      title="Delete variant"
                    ><TrashIcon class="h-3.5 w-3.5" /></button>
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
