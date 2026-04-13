<script setup lang="ts">
/**
 * BlueprintPickerModal — gallery of pre-built campaign workflows.
 *
 * Shown from the Campaigns list as an alternative to "Start from
 * scratch". Picking a blueprint server-side-clones it into a fresh
 * (inactive) CampaignDefinition and navigates to the editor so the
 * author can customise before activating.
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/client'
import { useAction } from '@/composables/useAction'
import { useToast } from '@/composables/useToast'
import {
  XMarkIcon, ArrowRightIcon, SparklesIcon,
  PaperAirplaneIcon, ShoppingCartIcon, HeartIcon, RocketLaunchIcon,
} from '@heroicons/vue/24/outline'

interface BlueprintStep {
  delay_minutes: number
  channel: string
  template_key: string
  condition?: string
}
interface Blueprint {
  key: string
  name: string
  description: string
  category: string
  trigger_event: string
  cancellation_event?: string
  segment_filter: string
  steps: BlueprintStep[]
}

defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [v: boolean] }>()

const router = useRouter()
const { showToast } = useToast()

const blueprints = ref<Blueprint[]>([])
const loading = ref(true)
const categoryFilter = ref<string>('all')
const cloningKey = ref<string | null>(null)

async function load() {
  loading.value = true
  try {
    const { data } = await api.get<{ blueprints: Blueprint[] }>('/api/campaigns/blueprints')
    blueprints.value = data.blueprints || []
  } catch {
    showToast('Failed to load blueprints', 'error')
  } finally {
    loading.value = false
  }
}
onMounted(load)

const categories = computed(() => {
  const s = new Set<string>()
  for (const b of blueprints.value) s.add(b.category)
  return ['all', ...Array.from(s).sort()]
})

const filtered = computed(() =>
  categoryFilter.value === 'all'
    ? blueprints.value
    : blueprints.value.filter(b => b.category === categoryFilter.value),
)

function iconFor(cat: string) {
  switch (cat) {
    case 'onboarding': return RocketLaunchIcon
    case 'recovery':   return ShoppingCartIcon
    case 'engagement': return HeartIcon
    default:           return SparklesIcon
  }
}
function accentFor(cat: string): string {
  switch (cat) {
    case 'onboarding': return 'text-indigo-700'
    case 'recovery':   return 'text-amber-700'
    case 'engagement': return 'text-rose-700'
    default:           return 'text-neutral-700'
  }
}

const cloneAction = useAction(async (bp: Blueprint) => {
  cloningKey.value = bp.key
  try {
    const { data } = await api.post<{ id: number; slug: string }>('/api/campaigns/from-blueprint', {
      key: bp.key,
    })
    showToast(`Campaign created from "${bp.name}"`, 'success')
    emit('update:open', false)
    router.push(`/campaigns/${data.id}/edit`)
  } finally {
    cloningKey.value = null
  }
})
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
       @click.self="emit('update:open', false)">
    <div class="mt-12 w-full max-w-5xl rounded-lg bg-white shadow-xl dark:bg-neutral-900">
      <div class="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800">
        <h2 class="flex items-center gap-2 text-lg font-semibold">
          <SparklesIcon class="h-5 w-5 text-ma-accent" aria-hidden="true" />
          Start from a blueprint
        </h2>
        <button @click="emit('update:open', false)" aria-label="Close"
                class="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <XMarkIcon class="h-5 w-5" />
        </button>
      </div>

      <div class="p-4">
        <div class="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Blueprint category">
          <button
            v-for="c in categories"
            :key="c"
            :aria-pressed="categoryFilter === c"
            role="tab"
            @click="categoryFilter = c"
            :class="[
              'rounded-full border px-3 py-1 text-xs font-medium',
              categoryFilter === c
                ? 'border-ma-accent bg-ma-accent text-white'
                : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800',
            ]"
          >{{ c }}</button>
        </div>

        <div v-if="loading" class="py-10 text-center text-sm text-neutral-500" role="status">Loading…</div>

        <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <article
            v-for="bp in filtered" :key="bp.key"
            class="flex flex-col rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div class="flex items-center gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
              <div class="flex h-7 w-7 items-center justify-center rounded bg-neutral-100 dark:bg-neutral-800">
                <component :is="iconFor(bp.category)" class="h-4 w-4" :class="accentFor(bp.category)" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium">{{ bp.name }}</div>
                <div class="font-mono text-[11px] text-neutral-500">trigger: {{ bp.trigger_event }}</div>
              </div>
            </div>
            <p class="flex-1 px-3 py-2 text-xs text-neutral-600 dark:text-neutral-400">
              {{ bp.description }}
            </p>
            <div class="flex items-center justify-between border-t border-neutral-100 px-3 py-2 dark:border-neutral-800">
              <span class="text-[11px] text-neutral-500">
                <PaperAirplaneIcon class="inline h-3 w-3" aria-hidden="true" /> {{ bp.steps.length }} step{{ bp.steps.length === 1 ? '' : 's' }}
              </span>
              <button
                @click="cloneAction.execute(bp)"
                :disabled="cloningKey === bp.key"
                class="inline-flex items-center gap-1 rounded-md bg-ma-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-ma-accent-hover disabled:opacity-50"
                :aria-label="`Use blueprint ${bp.name}`"
              >
                <span v-if="cloningKey === bp.key">Creating…</span>
                <template v-else>Use <ArrowRightIcon class="h-3.5 w-3.5" /></template>
              </button>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>
