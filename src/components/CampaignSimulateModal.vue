<script setup lang="ts">
/**
 * CampaignSimulateModal — dry-run predictor modal.
 *
 * Calls POST /api/campaigns/:id/simulate with an operator-chosen audience
 * size. Renders:
 *   - Top-line counters (total sends, max per recipient, end-to-end duration)
 *   - Per-channel + per-template volume tables
 *   - 24-hour send distribution as a sparkline bar chart — when the
 *     campaign has UseSTO on, the bars show the engagement-curve spread
 *     the frontend is approximating; without STO they collapse onto the
 *     single dispatch hour, which visually confirms the toggle's effect.
 *   - Author caveats returned by the backend.
 *
 * Uses useAction so rapid re-runs don't spawn duplicate requests.
 */
import { ref, computed } from 'vue'
import api from '@/api/client'
import { useAction } from '@/composables/useAction'
import { useToast } from '@/composables/useToast'
import { ClockIcon, BoltIcon, BeakerIcon } from '@heroicons/vue/24/outline'
import ModalWrapper from './ModalWrapper.vue'

interface SimulationStep {
  index: number
  delay_minutes: number
  cumulative_minutes: number
  channel: string
  template_key: string
  condition: string
  is_branching: boolean
  estimated_sends: number
}
interface SimulationResult {
  campaign_slug: string
  audience: number
  total_steps: number
  max_sends_per_recipient: number
  total_sends: number
  sends_by_channel: Record<string, number>
  sends_by_template: Record<string, number>
  sends_by_hour: number[]   // length 24
  use_sto: boolean
  steps: SimulationStep[]
  first_send_at_minutes: number
  last_send_at_minutes: number
  notes: string[]
}

const props = defineProps<{
  open: boolean
  campaignId: number
}>()
const emit = defineEmits<{ 'update:open': [v: boolean] }>()

const { showToast } = useToast()

const audience = ref(1000)
const result = ref<SimulationResult | null>(null)

const runAction = useAction(async () => {
  const { data } = await api.post<SimulationResult>(`/api/campaigns/${props.campaignId}/simulate`, {
    audience: audience.value,
  })
  result.value = data
})

async function run() {
  try {
    await runAction.execute()
  } catch (e: any) {
    showToast(e?.response?.data?.error || 'Simulation failed', 'error')
  }
}

function close() { emit('update:open', false) }

// Sparkline scaling — hold each bar's height proportional to the peak.
const hourPeak = computed(() => {
  const bins = result.value?.sends_by_hour || []
  return Math.max(1, ...bins)
})

function barHeight(n: number): string {
  const pct = Math.round((n / hourPeak.value) * 100)
  return `${Math.max(2, pct)}%`
}

function formatHours(min: number): string {
  if (min < 60) return `${min}m`
  const h = min / 60
  if (h < 24) return `${h.toFixed(1)}h`
  return `${(h / 24).toFixed(1)}d`
}
</script>

<template>
  <ModalWrapper
    :model-value="open"
    title="Simulate campaign"
    size="md"
    @update:model-value="(v) => { if (!v) close() }"
    @close="close"
  >
    <template #header-extra>
      <BeakerIcon class="h-5 w-5 text-ma-accent" aria-hidden="true" />
    </template>
    <template #body>
      <div class="space-y-4">
        <div class="flex items-end gap-3">
          <label class="flex-1">
            <span class="block text-xs font-medium uppercase tracking-wide text-neutral-500">Audience size</span>
            <input v-model.number="audience" type="number" min="1" max="10000000" class="form-input font-mono mt-1" />
          </label>
          <button @click="run" :disabled="runAction.pending.value" class="btn btn-primary">
            {{ runAction.pending.value ? 'Running…' : 'Run simulation' }}
          </button>
        </div>

        <div v-if="result" class="space-y-4">
          <!-- Top line counters -->
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div class="rounded border border-neutral-200 p-3 dark:border-neutral-800">
              <div class="text-[11px] uppercase tracking-wide text-neutral-500">Total sends</div>
              <div class="mt-1 text-2xl font-semibold tabular-nums">{{ result.total_sends.toLocaleString() }}</div>
            </div>
            <div class="rounded border border-neutral-200 p-3 dark:border-neutral-800">
              <div class="text-[11px] uppercase tracking-wide text-neutral-500">Max / recipient</div>
              <div class="mt-1 text-2xl font-semibold tabular-nums">{{ result.max_sends_per_recipient }}</div>
            </div>
            <div class="rounded border border-neutral-200 p-3 dark:border-neutral-800">
              <div class="text-[11px] uppercase tracking-wide text-neutral-500">First send</div>
              <div class="mt-1 text-2xl font-semibold tabular-nums">{{ formatHours(result.first_send_at_minutes) }}</div>
            </div>
            <div class="rounded border border-neutral-200 p-3 dark:border-neutral-800">
              <div class="text-[11px] uppercase tracking-wide text-neutral-500">Campaign end</div>
              <div class="mt-1 text-2xl font-semibold tabular-nums">{{ formatHours(result.last_send_at_minutes) }}</div>
            </div>
          </div>

          <!-- 24h hour distribution -->
          <div class="rounded border border-neutral-200 p-3 dark:border-neutral-800">
            <div class="mb-2 flex items-center justify-between">
              <div class="flex items-center gap-2 text-sm font-medium">
                <ClockIcon class="h-4 w-4 text-neutral-500" aria-hidden="true" />
                Projected send distribution · UTC
              </div>
              <span v-if="result.use_sto"
                    class="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
                <BoltIcon class="h-3 w-3" aria-hidden="true" /> STO spread
              </span>
              <span v-else class="text-[11px] text-neutral-500">Single-hour dispatch</span>
            </div>
            <div class="flex items-end gap-0.5" style="height: 96px;" role="img" aria-label="Send volume by hour">
              <div v-for="(n, h) in result.sends_by_hour" :key="h"
                   class="flex-1 rounded-sm bg-ma-accent/70"
                   :style="{ height: barHeight(n) }"
                   :title="`${h}:00 — ${n.toLocaleString()} sends`">
              </div>
            </div>
            <div class="mt-1 flex justify-between text-[10px] font-mono text-neutral-500">
              <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
            </div>
          </div>

          <!-- Channel + template breakdowns -->
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded border border-neutral-200 p-3 dark:border-neutral-800">
              <div class="mb-2 text-sm font-medium">Sends by channel</div>
              <table class="w-full text-sm">
                <tbody>
                  <tr v-for="(v, k) in result.sends_by_channel" :key="k" class="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                    <td class="py-1 font-mono text-xs">{{ k }}</td>
                    <td class="py-1 text-right tabular-nums">{{ v.toLocaleString() }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="rounded border border-neutral-200 p-3 dark:border-neutral-800">
              <div class="mb-2 text-sm font-medium">Sends by template</div>
              <table class="w-full text-sm">
                <tbody>
                  <tr v-for="(v, k) in result.sends_by_template" :key="k" class="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                    <td class="py-1 font-mono text-xs truncate">{{ k || '—' }}</td>
                    <td class="py-1 text-right tabular-nums">{{ v.toLocaleString() }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Caveats -->
          <ul v-if="result.notes?.length" class="space-y-1 rounded bg-[var(--color-warning-soft)] p-3 text-xs text-[var(--color-warning-text)] dark:bg-amber-950/40 dark:text-amber-200">
            <li v-for="(n, i) in result.notes" :key="i">• {{ n }}</li>
          </ul>
        </div>
      </div>
    </template>
    <template #footer>
      <button @click="close" class="btn btn-ghost">Close</button>
    </template>
  </ModalWrapper>
</template>
