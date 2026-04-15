<script setup lang="ts">
/**
 * AIJourneyAssistModal — "describe the goal, get a campaign skeleton".
 *
 * Opens from an "AI Assist" button in the campaign builder. Sends the
 * operator's goal + optional audience to the backend, gets back an
 * array of suggested steps, and emits them as an array of plain Step
 * objects that the parent serialises into the Vue Flow canvas (or the
 * list editor).
 */
import { ref } from 'vue'
import { useAction } from '@/composables/useAction'
import { useToast } from '@/composables/useToast'
import { suggestJourney, type SuggestedStep } from '@/api/ai'
import { XMarkIcon, SparklesIcon, ArrowDownIcon } from '@heroicons/vue/24/outline'

defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [v: boolean]
  'apply':       [steps: SuggestedStep[]]
}>()

const { showToast } = useToast()

const goal = ref('')
const audience = ref('')
const examples = [
  'Reduce cart abandonment',
  'Reactivate dormant users',
  'Onboard first-time buyers',
  'Win back lapsed VIPs',
  'Drive repeat purchase within 30 days',
]

const suggestion = ref<{ steps: SuggestedStep[]; notes?: string[]; cached?: boolean } | null>(null)
const runAction = useAction(async () => {
  if (!goal.value.trim()) throw new Error('Goal is required')
  suggestion.value = await suggestJourney({ goal: goal.value, audience: audience.value })
})
async function run() {
  try { await runAction.execute() }
  catch (e: any) {
    const code = e?.response?.data?.error
    if (code === 'ai_disabled') showToast('AI features not configured', 'error')
    else showToast(e?.message || e?.response?.data?.message || 'Generation failed', 'error')
  }
}

function apply() {
  if (!suggestion.value?.steps?.length) return
  emit('apply', suggestion.value.steps)
  emit('update:open', false)
}
function close() { emit('update:open', false) }
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" @click.self="close">
    <div class="mt-12 w-full max-w-2xl rounded-lg bg-white shadow-xl dark:bg-neutral-900">
      <div class="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800">
        <h2 class="flex items-center gap-2 text-lg font-semibold">
          <SparklesIcon class="h-5 w-5 text-ma-accent" aria-hidden="true" />
          AI journey assist
        </h2>
        <button @click="close" aria-label="Close" class="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <XMarkIcon class="h-5 w-5" />
        </button>
      </div>

      <div class="space-y-3 p-4">
        <div>
          <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">What's your goal?</label>
          <input v-model="goal" class="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800" placeholder="Reduce cart abandonment" />
          <div class="mt-1 flex flex-wrap gap-1">
            <button v-for="e in examples" :key="e" type="button" @click="goal = e"
                    class="rounded-full border border-neutral-300 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700">
              {{ e }}
            </button>
          </div>
        </div>
        <div>
          <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Audience (optional)</label>
          <input v-model="audience" class="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800" placeholder="First-time buyers" />
        </div>

        <div class="flex justify-end pt-1">
          <button @click="run" :disabled="runAction.pending.value"
                  class="inline-flex items-center gap-2 rounded-md bg-ma-accent px-4 py-2 text-sm font-medium text-white hover:bg-ma-accent-hover disabled:opacity-50">
            <SparklesIcon class="h-4 w-4" />
            {{ runAction.pending.value ? 'Thinking…' : 'Suggest' }}
          </button>
        </div>

        <div v-if="suggestion" class="space-y-2 pt-2">
          <div class="text-xs text-neutral-500">
            Suggested {{ suggestion.steps.length }}-step journey
            <span v-if="suggestion.cached" class="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-mono dark:bg-neutral-800">cached</span>
          </div>
          <ol class="space-y-2">
            <li v-for="(s, i) in suggestion.steps" :key="i"
                class="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm dark:border-neutral-700 dark:bg-neutral-800">
              <div class="flex items-center gap-2">
                <span class="font-mono text-xs opacity-60">#{{ i }}</span>
                <span class="rounded bg-white px-1.5 py-0.5 text-[10px] font-mono uppercase shadow-sm dark:bg-neutral-900">{{ s.channel }}</span>
                <span v-if="s.delay_minutes" class="rounded bg-[var(--color-warning-soft)] px-1.5 py-0.5 text-[10px] font-mono dark:bg-amber-900/40 dark:text-amber-200">+{{ s.delay_minutes }}m</span>
                <span class="font-mono text-xs text-neutral-600 dark:text-neutral-300">{{ s.template_key }}</span>
              </div>
              <div class="mt-1 text-xs text-neutral-500">{{ s.rationale }}</div>
              <div v-if="i < suggestion.steps.length - 1" class="mt-1 flex justify-center">
                <ArrowDownIcon class="h-4 w-4 text-neutral-400" aria-hidden="true" />
              </div>
            </li>
          </ol>
          <p v-if="suggestion.notes?.length" class="rounded bg-[var(--color-warning-soft)] p-2 text-xs text-[var(--color-warning-text)] dark:bg-amber-950/40 dark:text-amber-200">
            {{ suggestion.notes.join(' · ') }}
          </p>
          <div class="flex justify-end pt-1">
            <button @click="apply"
                    class="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              Apply to campaign →
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end border-t border-neutral-200 p-4 dark:border-neutral-800">
        <button @click="close" class="rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">Close</button>
      </div>
    </div>
  </div>
</template>
