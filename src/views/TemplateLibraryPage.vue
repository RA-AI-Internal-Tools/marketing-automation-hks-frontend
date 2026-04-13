<script setup lang="ts">
/**
 * TemplateLibraryPage — gallery of pre-built MJML templates.
 *
 * Library entries are read-only originals seeded by
 * seed.SeedTemplateLibrary. Operators click "Use template" on a card; MA
 * server-side clones the original into a freshly-keyed, inactive copy
 * and navigates to the editor so it's immediately customisable.
 *
 * Categories are derived from the template_key prefix ("lib.mkt.*" →
 * "marketing"), not a dedicated column — the library is a small fixed
 * catalogue and a joined table didn't feel worth it.
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import { useAction } from '@/composables/useAction'
import { useToast } from '@/composables/useToast'
import { listLibraryTemplates, cloneFromLibrary } from '@/api/template_library'
import type { MessageTemplate } from '@/api/types'
import {
  PaperAirplaneIcon, RocketLaunchIcon, ShoppingCartIcon, HeartIcon,
  ArrowRightIcon, SparklesIcon,
} from '@heroicons/vue/24/outline'

const router = useRouter()
const { showToast } = useToast()

const templates = ref<MessageTemplate[]>([])
const loading = ref(true)
const categoryFilter = ref<string>('all')

// Category metadata drives both the filter chips and the per-card
// accent. Keys line up with the seed file's template_key prefix.
const categories = [
  { key: 'all',           label: 'All',            icon: SparklesIcon,       tint: 'text-neutral-700' },
  { key: 'transactional', label: 'Transactional',  icon: PaperAirplaneIcon,  tint: 'text-sky-700' },
  { key: 'marketing',     label: 'Marketing',      icon: RocketLaunchIcon,   tint: 'text-indigo-700' },
  { key: 'recovery',      label: 'Recovery',       icon: ShoppingCartIcon,   tint: 'text-amber-700' },
  { key: 'engagement',    label: 'Engagement',     icon: HeartIcon,          tint: 'text-rose-700' },
]

function categoryOf(t: MessageTemplate): string {
  // template_key shape: "lib.<category>.<slug>"
  const segs = t.template_key.split('.')
  return (segs.length >= 2 ? segs[1] : 'other') ?? 'other'
}

async function load() {
  loading.value = true
  try {
    templates.value = await listLibraryTemplates('email')
  } catch {
    showToast('Failed to load template library', 'error')
  } finally {
    loading.value = false
  }
}
onMounted(load)

const filtered = computed(() => {
  if (categoryFilter.value === 'all') return templates.value
  return templates.value.filter(t => categoryOf(t) === categoryFilter.value)
})

const countByCategory = computed<Record<string, number>>(() => {
  const out: Record<string, number> = { all: templates.value.length }
  for (const t of templates.value) {
    const c = categoryOf(t)
    out[c] = (out[c] || 0) + 1
  }
  return out
})

// One useAction per card would spawn too many refs; we store pending
// by id and guard at call time.
const cloningId = ref<number | null>(null)
const useAction_ = useAction(async (tmpl: MessageTemplate) => {
  cloningId.value = tmpl.id
  try {
    const copy = await cloneFromLibrary(tmpl.id)
    showToast(`Cloned "${tmpl.name}" — opening editor`, 'success')
    router.push(`/templates/${copy.id}/edit`)
  } finally {
    cloningId.value = null
  }
})

function accentFor(cat: string): string {
  const c = categories.find(c => c.key === cat)
  return c?.tint || 'text-neutral-700'
}
function iconFor(cat: string) {
  const found = categories.find(c => c.key === cat)
  return (found ?? categories[0]!).icon
}
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-5 p-6">
    <PageHeader
      title="Template library"
      description="Start from a pre-built, responsive MJML template. Clone, customise in the Visual editor, and send."
    />

    <!-- Category filter chips -->
    <div class="flex flex-wrap items-center gap-2" role="tablist" aria-label="Template category">
      <button
        v-for="c in categories"
        :key="c.key"
        :aria-pressed="categoryFilter === c.key"
        role="tab"
        @click="categoryFilter = c.key"
        :class="[
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
          categoryFilter === c.key
            ? 'border-ma-accent bg-ma-accent text-white'
            : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800',
        ]"
      >
        <component :is="c.icon" class="h-4 w-4" />
        {{ c.label }}
        <span v-if="countByCategory[c.key] !== undefined"
              class="ml-0.5 rounded-full bg-black/10 px-1.5 text-[10px] tabular-nums">
          {{ countByCategory[c.key] }}
        </span>
      </button>
    </div>

    <div v-if="loading" class="py-10 text-center text-sm text-neutral-500" role="status">Loading library…</div>

    <div v-else-if="filtered.length === 0" class="rounded-lg border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500 dark:border-neutral-700">
      No templates in this category yet.
    </div>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="t in filtered"
        :key="t.id"
        class="group relative flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm transition hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
      >
        <!-- Visual hero: category-coloured accent band + icon. We don't
             render the MJML preview inline — it's heavy and the editor
             already handles that. The card is a discoverable stub. -->
        <div class="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <div class="flex h-9 w-9 items-center justify-center rounded-md bg-neutral-100 dark:bg-neutral-800">
            <component :is="iconFor(categoryOf(t))" class="h-4 w-4" :class="accentFor(categoryOf(t))" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate font-medium">{{ t.name }}</div>
            <div class="font-mono text-[11px] text-neutral-500">{{ t.template_key }}</div>
          </div>
        </div>

        <div class="flex-1 space-y-2 p-4 text-sm">
          <p v-if="t.subject" class="font-medium">{{ t.subject }}</p>
          <p class="text-xs text-neutral-500">
            Channel <code class="font-mono">{{ t.channel }}</code> ·
            Category <span :class="accentFor(categoryOf(t))">{{ categoryOf(t) }}</span>
          </p>
        </div>

        <div class="border-t border-neutral-100 p-3 dark:border-neutral-800">
          <button
            @click="useAction_.execute(t)"
            :disabled="cloningId === t.id"
            class="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-ma-accent px-3 py-2 text-sm font-medium text-white hover:bg-ma-accent-hover disabled:opacity-50"
            :aria-label="`Use template ${t.name}`"
          >
            <span v-if="cloningId === t.id">Cloning…</span>
            <template v-else>Use template <ArrowRightIcon class="h-4 w-4" /></template>
          </button>
        </div>
      </article>
    </div>
  </div>
</template>
