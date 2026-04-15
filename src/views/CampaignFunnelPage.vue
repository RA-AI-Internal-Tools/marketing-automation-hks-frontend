<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { fetchCampaignFunnel, fetchVariantPerformance, fetchCampaigns } from '@/api/dashboard'
import type { CampaignFunnelStats, VariantPerformance, CampaignDefinition } from '@/api/types'
import { chartPalette } from '@/utils/chartColors'
import {
  ChartBarIcon,
  FunnelIcon,
  ArrowTrendingUpIcon,
  CursorArrowRaysIcon,
  EnvelopeOpenIcon,
  PaperAirplaneIcon,
} from '@heroicons/vue/24/outline'

const route = useRoute()
const campaigns = ref<CampaignDefinition[]>([])
const selectedSlug = ref((route.query.slug as string) || '')
const funnel = ref<CampaignFunnelStats | null>(null)
const variants = ref<VariantPerformance[]>([])
const selectedStep = ref(0)
const loading = ref(false)
const error = ref('')

function rate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return (numerator / denominator) * 100
}

const funnelStages = computed(() => {
  if (!funnel.value) return []
  const f = funnel.value
  const enrolled = f.enrolled || 1
  const p = chartPalette()
  return [
    { name: 'Enrolled', count: f.enrolled, rate: 100, color: p.primary, icon: FunnelIcon },
    { name: 'Sent', count: f.sent, rate: rate(f.sent, enrolled), color: p.accent, icon: PaperAirplaneIcon },
    { name: 'Delivered', count: f.delivered, rate: rate(f.delivered, enrolled), color: p.secondary, icon: ArrowTrendingUpIcon },
    { name: 'Opened', count: f.opened, rate: rate(f.opened, enrolled), color: p.warning, icon: EnvelopeOpenIcon },
    { name: 'Clicked', count: f.clicked, rate: rate(f.clicked, enrolled), color: p.success, icon: CursorArrowRaysIcon },
  ]
})

const deliveryRate = computed(() => funnel.value ? rate(funnel.value.delivered, funnel.value.sent) : 0)
const openRate = computed(() => funnel.value ? rate(funnel.value.opened, funnel.value.delivered) : 0)
const clickRate = computed(() => funnel.value ? rate(funnel.value.clicked, funnel.value.opened) : 0)

function variantOpenRate(v: VariantPerformance): number {
  return rate(v.opened, v.delivered)
}
function variantClickRate(v: VariantPerformance): number {
  return rate(v.clicked, v.opened)
}

async function loadCampaigns() {
  try {
    campaigns.value = await fetchCampaigns()
    if (!selectedSlug.value && campaigns.value.length > 0) {
      const firstCampaign = campaigns.value[0]
      if (firstCampaign) {
        selectedSlug.value = firstCampaign.slug
      }
    }
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load campaigns'
  }
}

async function loadFunnel() {
  if (!selectedSlug.value) return
  loading.value = true
  error.value = ''
  try {
    const [f, v] = await Promise.all([
      fetchCampaignFunnel(selectedSlug.value),
      fetchVariantPerformance(selectedSlug.value, selectedStep.value),
    ])
    funnel.value = f
    variants.value = v
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load funnel data'
  } finally {
    loading.value = false
  }
}

async function loadVariants() {
  if (!selectedSlug.value) return
  try {
    variants.value = await fetchVariantPerformance(selectedSlug.value, selectedStep.value)
  } catch (e: any) {
    console.error('Failed to load variants:', e)
    error.value = e.response?.data?.error || 'Failed to load variant data'
  }
}

onMounted(async () => {
  await loadCampaigns()
  await loadFunnel()
})

function onCampaignChange() {
  selectedStep.value = 0
  loadFunnel()
}
</script>

<template>
  <div class="page-enter space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">Campaign Funnel</h1>
        <p class="text-sm text-[var(--color-text-tertiary)] mt-1">Enrollment-to-click conversion funnel with A/B variant performance</p>
      </div>
    </div>

    <!-- Campaign Selector -->
    <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-4 flex items-center gap-4">
      <label class="text-sm font-medium text-[var(--color-text-secondary)]">Campaign:</label>
      <select
        v-model="selectedSlug"
        @change="onCampaignChange"
        class="rounded-lg border-[var(--color-border)] text-sm focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-focus-ring)]"
      >
        <option v-for="c in campaigns" :key="c.slug" :value="c.slug">
          {{ c.name }} ({{ c.slug }})
        </option>
      </select>
    </div>

    <div v-if="loading" class="text-center py-12 text-[var(--color-text-muted)]">Loading funnel data...</div>
    <div v-else-if="error" class="bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-xl p-4 text-[var(--color-error-text)] text-sm">{{ error }}</div>

    <template v-else-if="funnel">
      <!-- Funnel Visualization -->
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
        <h2 class="text-sm font-semibold text-[var(--color-text-primary)] mb-6 flex items-center gap-2">
          <ChartBarIcon class="w-5 h-5 text-[var(--hks-cyan)]" />
          Conversion Funnel
        </h2>
        <div class="space-y-3">
          <div v-for="stage in funnelStages" :key="stage.name" class="flex items-center gap-4">
            <div class="w-24 flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
              <component :is="stage.icon" class="w-4 h-4 text-[var(--color-text-muted)]" />
              {{ stage.name }}
            </div>
            <div class="flex-1">
              <div class="relative h-8 bg-[var(--color-bg-subtle)] rounded-lg overflow-hidden">
                <div
                  class="absolute inset-y-0 left-0 rounded-lg transition-all duration-500"
                  :style="{ width: Math.max(stage.rate, 1) + '%', backgroundColor: stage.color }"
                />
                <div class="absolute inset-0 flex items-center px-3 text-sm font-medium"
                     :class="stage.rate > 30 ? 'text-white' : 'text-[var(--color-text-secondary)]'">
                  {{ stage.count.toLocaleString() }}
                </div>
              </div>
            </div>
            <div class="w-16 text-right text-sm font-semibold" :class="stage.rate >= 50 ? 'text-[var(--color-success-strong)]' : stage.rate >= 20 ? 'text-[var(--color-warning-strong)]' : 'text-[var(--color-error-strong)]'">
              {{ stage.rate.toFixed(1) }}%
            </div>
          </div>
        </div>
      </div>

      <!-- Metric Cards -->
      <p v-if="funnel.enrolled === 0" class="text-xs text-[var(--color-text-muted)]">Funnel metrics populate once campaigns have active enrollments and sent messages. Enable campaigns and wait for the first enrollment to appear.</p>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-4">
          <p class="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wide">Delivery Rate</p>
          <p class="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{{ deliveryRate.toFixed(1) }}%</p>
        </div>
        <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-4">
          <p class="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wide">Open Rate</p>
          <p class="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{{ openRate.toFixed(1) }}%</p>
        </div>
        <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-4">
          <p class="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wide">Click Rate</p>
          <p class="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{{ clickRate.toFixed(1) }}%</p>
        </div>
        <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-4">
          <p class="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wide">Total Enrolled</p>
          <p class="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{{ funnel.enrolled.toLocaleString() }}</p>
        </div>
      </div>

      <!-- A/B Variant Performance -->
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-[var(--color-text-primary)]">A/B Variant Performance</h2>
          <div class="flex items-center gap-2">
            <label class="text-xs text-[var(--color-text-tertiary)]">Step:</label>
            <select
              v-model.number="selectedStep"
              @change="loadVariants"
              class="rounded-lg border-[var(--color-border)] text-xs focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-focus-ring)]"
            >
              <option :value="0">All Steps</option>
              <option v-for="i in (campaigns.find(c => c.slug === selectedSlug)?.steps.length || 3)" :key="i" :value="i">
                Step {{ i }}
              </option>
            </select>
          </div>
        </div>

        <div v-if="variants.length === 0" class="text-center py-8 text-[var(--color-text-muted)] text-sm">
          No A/B variant data yet. Configure variants in the campaign editor.
        </div>
        <table v-else class="w-full text-sm">
          <thead>
            <tr class="text-left text-[var(--color-text-tertiary)] text-xs uppercase tracking-wide">
              <th class="pb-3">Variant</th>
              <th class="pb-3 text-right">Sent</th>
              <th class="pb-3 text-right">Delivered</th>
              <th class="pb-3 text-right">Opened</th>
              <th class="pb-3 text-right">Clicked</th>
              <th class="pb-3 text-right">Open Rate</th>
              <th class="pb-3 text-right">Click Rate</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in variants" :key="v.variant_id" class="border-t border-[var(--color-border-muted)]">
              <td class="py-3 font-medium text-[var(--color-text-primary)]">{{ v.variant_id }}</td>
              <td class="py-3 text-right text-[var(--color-text-secondary)]">{{ v.sent.toLocaleString() }}</td>
              <td class="py-3 text-right text-[var(--color-text-secondary)]">{{ v.delivered.toLocaleString() }}</td>
              <td class="py-3 text-right text-[var(--color-text-secondary)]">{{ v.opened.toLocaleString() }}</td>
              <td class="py-3 text-right text-[var(--color-text-secondary)]">{{ v.clicked.toLocaleString() }}</td>
              <td class="py-3 text-right font-semibold" :class="variantOpenRate(v) > 25 ? 'text-[var(--color-success-strong)]' : 'text-[var(--color-warning-strong)]'">
                {{ variantOpenRate(v).toFixed(1) }}%
              </td>
              <td class="py-3 text-right font-semibold" :class="variantClickRate(v) > 5 ? 'text-[var(--color-success-strong)]' : 'text-[var(--color-warning-strong)]'">
                {{ variantClickRate(v).toFixed(1) }}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
