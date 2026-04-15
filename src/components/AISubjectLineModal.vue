<script setup lang="ts">
/**
 * AISubjectLineModal — GPT-backed subject-line brainstorm.
 *
 * Opens from a "Generate with AI" button on the template settings panel.
 * Collects just enough context (audience, tone, product focus, brand
 * voice) to produce five distinct angles, then emits the chosen line
 * so the parent can drop it into the subject input.
 */
import { ref } from 'vue'
import { useAction } from '@/composables/useAction'
import { useToast } from '@/composables/useToast'
import { generateSubjectLines, type SubjectLineResponse } from '@/api/ai'
import { XMarkIcon, SparklesIcon, CheckIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
  open: boolean
  // Pre-seed the campaign name from the template context so the user
  // doesn't retype it.
  campaignName?: string
}>()
const emit = defineEmits<{
  'update:open': [v: boolean]
  'pick':        [line: string]
}>()

const { showToast } = useToast()

const form = ref({
  campaign_name: props.campaignName || '',
  audience: '',
  tone: 'friendly',
  product_context: '',
  brand_voice: 'warm, confident, uncluttered',
})
const tones = ['friendly', 'professional', 'playful', 'urgent', 'direct', 'witty']

const result = ref<SubjectLineResponse | null>(null)
const generateAction = useAction(async () => {
  const out = await generateSubjectLines(form.value)
  result.value = out
})

async function run() {
  try { await generateAction.execute() }
  catch (e: any) {
    const code = e?.response?.data?.error
    if (code === 'ai_disabled') {
      showToast('AI features not configured on this server', 'error')
    } else {
      showToast(e?.response?.data?.message || 'Generation failed', 'error')
    }
  }
}

function pick(line: string) {
  emit('pick', line)
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
          Generate subject lines
        </h2>
        <button @click="close" aria-label="Close" class="btn-icon">
          <XMarkIcon class="h-5 w-5" />
        </button>
      </div>

      <div class="space-y-3 p-4">
        <div>
          <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Campaign name</label>
          <input v-model="form.campaign_name" class="form-input mt-1" placeholder="e.g. Spring sale 2026" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Audience</label>
            <input v-model="form.audience" class="form-input mt-1" placeholder="VIP customers" />
          </div>
          <div>
            <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Tone</label>
            <select v-model="form.tone" class="form-select mt-1">
              <option v-for="t in tones" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Product / offer</label>
          <input v-model="form.product_context" class="form-input mt-1" placeholder="20% off sitewide with code SPRING20" />
        </div>
        <div>
          <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Brand voice</label>
          <input v-model="form.brand_voice" class="form-input mt-1" />
        </div>

        <div class="flex justify-end pt-2">
          <button @click="run" :disabled="generateAction.pending.value" class="btn btn-primary">
            <SparklesIcon class="h-4 w-4" />
            {{ generateAction.pending.value ? 'Generating…' : 'Generate' }}
          </button>
        </div>

        <div v-if="result" class="space-y-2 pt-2">
          <div class="flex items-center justify-between text-xs text-neutral-500">
            <span>5 variants — pick one, or iterate the inputs above</span>
            <span v-if="result.cached" class="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-mono dark:bg-neutral-800">cached</span>
          </div>
          <ul class="space-y-2">
            <li v-for="(line, i) in result.variants" :key="i"
                class="flex items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-700 dark:bg-neutral-800">
              <span class="flex-1 text-sm">{{ line }}</span>
              <button @click="pick(line)"
                      class="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-ma-accent border border-neutral-300 hover:bg-neutral-50 dark:bg-neutral-900 dark:border-neutral-700 dark:hover:bg-neutral-800">
                <CheckIcon class="h-3.5 w-3.5" /> Use
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div class="flex items-center justify-end border-t border-neutral-200 p-4 dark:border-neutral-800">
        <button @click="close" class="rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">Close</button>
      </div>
    </div>
  </div>
</template>
