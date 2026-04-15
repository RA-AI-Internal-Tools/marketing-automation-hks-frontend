<script setup lang="ts">
/**
 * TemplateLibraryPage — gallery of pre-built MJML templates.
 *
 * Library entries are read-only originals seeded by
 * seed.SeedTemplateLibrary. Operators click "Use template" on a card;
 * MA server-side clones the original into a freshly-keyed inactive
 * copy and navigates to the editor.
 *
 * Categories derive from the template_key prefix ("lib.mkt.*" →
 * "marketing"), not a dedicated column — the library is a small
 * fixed catalogue and a joined table didn't feel worth it.
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useAction } from '@/composables/useAction'
import { useToast } from '@/composables/useToast'
import { listLibraryTemplates, cloneFromLibrary } from '@/api/template_library'
import type { MessageTemplate } from '@/api/types'
import {
  PaperAirplaneIcon, RocketLaunchIcon, ShoppingCartIcon, HeartIcon,
  ArrowRightIcon, SparklesIcon, EnvelopeOpenIcon,
} from '@heroicons/vue/24/outline'

const router = useRouter()
const { showToast } = useToast()

const templates = ref<MessageTemplate[]>([])
const loading = ref(true)
const categoryFilter = ref<string>('all')

const categories = [
  { key: 'all',           label: 'All',            icon: SparklesIcon },
  { key: 'transactional', label: 'Transactional',  icon: PaperAirplaneIcon },
  { key: 'marketing',     label: 'Marketing',      icon: RocketLaunchIcon },
  { key: 'recovery',      label: 'Recovery',       icon: ShoppingCartIcon },
  { key: 'engagement',    label: 'Engagement',     icon: HeartIcon },
]

function categoryOf(t: MessageTemplate): string {
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

const cloningId = ref<number | null>(null)
const cloneAction = useAction(async (tmpl: MessageTemplate) => {
  cloningId.value = tmpl.id
  try {
    const copy = await cloneFromLibrary(tmpl.id)
    showToast(`Cloned "${tmpl.name}" — opening editor`, 'success')
    router.push(`/templates/${copy.id}/edit`)
  } finally {
    cloningId.value = null
  }
})

function iconFor(cat: string) {
  const found = categories.find(c => c.key === cat)
  return (found ?? categories[0]!).icon
}
</script>

<template>
  <div class="page-enter">
    <PageHeader
      kicker="Catalogue · Library"
      title="Template library"
      description="Pre-built, responsive MJML templates. Clone, customise in the Visual editor, and send."
    />

    <div class="lib-toolbar">
      <div class="lib-tabs" role="tablist" aria-label="Template category">
        <button
          v-for="c in categories"
          :key="c.key"
          role="tab"
          :aria-pressed="categoryFilter === c.key"
          @click="categoryFilter = c.key"
          :class="['lib-tab', { 'lib-tab-active': categoryFilter === c.key }]"
        >
          <component :is="c.icon" class="h-3.5 w-3.5" aria-hidden="true" />
          {{ c.label }}
          <span class="lib-tab-count num-tabular">{{ countByCategory[c.key] ?? 0 }}</span>
        </button>
      </div>

      <div class="lib-meta">
        <strong class="num-tabular">{{ filtered.length }}</strong>
        <span class="lib-meta-faint">of</span>
        <strong class="num-tabular">{{ templates.length }}</strong> templates
      </div>
    </div>

    <div v-if="loading" class="lib-grid">
      <div v-for="i in 6" :key="i" class="lib-card lib-card-skel">
        <div class="skeleton h-9 w-9" style="border-radius: var(--radius-md);" />
        <div class="skeleton h-4 w-3/4 mt-3" />
        <div class="skeleton h-3 w-1/2 mt-2" />
        <div class="skeleton h-8 w-full mt-5" style="border-radius: var(--radius-md);" />
      </div>
    </div>

    <EmptyState
      v-else-if="filtered.length === 0"
      :icon="EnvelopeOpenIcon"
      title="No templates in this category."
      description="Pick another category above, or browse the full set."
    />

    <div v-else class="lib-grid stagger">
      <article
        v-for="t in filtered"
        :key="t.id"
        class="lib-card"
        :data-category="categoryOf(t)"
      >
        <span class="lib-card-accent" aria-hidden="true" />

        <header class="lib-card-head">
          <div class="lib-card-icon">
            <component :is="iconFor(categoryOf(t))" class="h-4 w-4" aria-hidden="true" />
          </div>
          <div class="lib-card-head-body">
            <h3 class="lib-card-title">{{ t.name }}</h3>
            <code class="lib-card-key">{{ t.template_key }}</code>
          </div>
        </header>

        <div class="lib-card-body">
          <p v-if="t.subject" class="lib-card-subject">{{ t.subject }}</p>
          <div class="lib-card-meta">
            <span class="lib-card-meta-item">
              <span class="lib-card-meta-lbl">Channel</span>
              <code class="lib-card-meta-val">{{ t.channel }}</code>
            </span>
            <span class="lib-card-meta-item">
              <span class="lib-card-meta-lbl">Category</span>
              <span class="lib-card-meta-val">{{ categoryOf(t) }}</span>
            </span>
          </div>
        </div>

        <footer class="lib-card-foot">
          <button
            @click="cloneAction.execute(t)"
            :disabled="cloningId === t.id"
            class="btn btn-primary lib-card-use"
            :aria-label="`Use template ${t.name}`"
          >
            <template v-if="cloningId === t.id">
              <span class="lib-spinner" aria-hidden="true" />
              Cloning…
            </template>
            <template v-else>
              Use template
              <ArrowRightIcon class="h-3.5 w-3.5" aria-hidden="true" />
            </template>
          </button>
        </footer>
      </article>
    </div>
  </div>
</template>

<style scoped>
.lib-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  margin-bottom: 18px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.lib-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 2px;
  background: var(--color-bg-subtle);
  border-radius: var(--radius-md);
}
.lib-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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
  transition: color var(--transition-fast), background var(--transition-fast);
}
.lib-tab:hover { color: var(--color-text-secondary); }
.lib-tab-active {
  color: var(--color-text-primary);
  background: var(--color-bg-card);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.lib-tab-count {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 5px;
  color: var(--color-text-muted);
  background: var(--color-bg-card);
  border-radius: 3px;
  margin-left: 2px;
}
.lib-tab-active .lib-tab-count {
  background: var(--color-bg-subtle);
  color: var(--color-text-tertiary);
}
.lib-meta {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--color-text-muted);
}
.lib-meta strong { color: var(--color-text-secondary); font-weight: 500; }
.lib-meta-faint { color: var(--color-text-muted); padding: 0 4px; }

.lib-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 640px) { .lib-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .lib-grid { grid-template-columns: repeat(3, 1fr); } }

.lib-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: border-color var(--transition-fast), transform var(--transition-fast);
}
.lib-card:hover {
  border-color: var(--color-border-strong);
  transform: translateY(-1px);
}
.lib-card-accent {
  position: absolute;
  left: 0;
  top: 20px;
  bottom: 20px;
  width: 2px;
  background: var(--color-text-muted);
  border-radius: 1px;
}
.lib-card[data-category="transactional"] .lib-card-accent { background: var(--category-transactional); }
.lib-card[data-category="marketing"]     .lib-card-accent { background: var(--hks-royal-blue); }
.lib-card[data-category="recovery"]      .lib-card-accent { background: var(--category-recovery); }
.lib-card[data-category="engagement"]    .lib-card-accent { background: var(--category-engagement); }

.lib-card-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--color-divider);
}
.lib-card-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-muted);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
}
.lib-card[data-category="transactional"] .lib-card-icon { color: var(--category-transactional); }
.lib-card[data-category="marketing"]     .lib-card-icon { color: var(--hks-royal-blue); }
.lib-card[data-category="recovery"]      .lib-card-icon { color: var(--category-recovery); }
.lib-card[data-category="engagement"]    .lib-card-icon { color: var(--category-engagement); }

.lib-card-head-body { min-width: 0; flex: 1; }
.lib-card-title {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 18px;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--color-text-primary);
  font-variation-settings: 'opsz' 72, 'SOFT' 30;
  margin-bottom: 2px;
  word-break: break-word;
}
.lib-card-key {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--color-text-muted);
  letter-spacing: -0.005em;
}

.lib-card-body { flex: 1; padding: 14px 20px 16px; }
.lib-card-subject {
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: 10px;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.lib-card-meta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
.lib-card-meta-item { display: inline-flex; align-items: baseline; gap: 5px; }
.lib-card-meta-lbl {
  font-family: var(--font-sans);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
.lib-card-meta-val {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-tertiary);
  text-transform: lowercase;
  padding: 1px 6px;
  background: var(--color-bg-subtle);
  border-radius: var(--radius-sm);
}

.lib-card-foot {
  padding: 12px 20px 16px;
  border-top: 1px solid var(--color-divider);
  background: var(--color-bg-page);
}
.lib-card-use { width: 100%; justify-content: center; }
.lib-card-use:disabled { opacity: 0.6; cursor: not-allowed; }

.lib-spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid rgba(255, 255, 255, 0.4);
  border-top-color: var(--color-text-inverse);
  border-radius: 50%;
  animation: libspin 0.7s linear infinite;
}
@keyframes libspin { to { transform: rotate(360deg); } }

.lib-card-skel { padding: 20px; flex-direction: column; }
</style>
