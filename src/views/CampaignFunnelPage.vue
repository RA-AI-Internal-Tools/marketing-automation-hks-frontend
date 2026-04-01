<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { fetchCampaignFunnel, fetchVariantPerformance, fetchCampaigns } from '@/api/dashboard'
import type { CampaignFunnelStats, VariantPerformance, CampaignDefinition } from '@/api/types'
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

const funnelStages = computed(() => {
  if (!funnel.value) return []
  const f = funnel.value
  return [
    { name: 'Enrolled', count: f.enrolled, rate: 100, color: 'bg-blue-500', icon: FunnelIcon },
    { name: 'Sent', count: f.sent, rate: f.sent_rate, color: 'bg-[#0099db]', icon: PaperAirplaneIcon },
    { name: 'Delivered', count: f.delivered, rate: f.delivery_rate, color: 'bg-purple-500', icon: ArrowTrendingUpIcon },
    { name: 'Opened', count: f.opened, rate: f.open_rate, color: 'bg-amber-500', icon: EnvelopeOpenIcon },
    { name: 'Clicked', count: f.clicked, rate: f.click_rate, color: 'bg-green-500', icon: CursorArrowRaysIcon },
  ]
})

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
        <h1 class="text-2xl font-bold text-gray-900">Campaign Funnel</h1>
        <p class="text-sm text-gray-500 mt-1">Enrollment-to-click conversion funnel with A/B variant performance</p>
      </div>
    </div>

    <!-- Campaign Selector -->
    <div class="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 flex items-center gap-4">
      <label class="text-sm font-medium text-gray-700">Campaign:</label>
      <select
        v-model="selectedSlug"
        @change="onCampaignChange"
        class="rounded-lg border-gray-300 text-sm focus:ring-[#0099db]/40 focus:border-[#0099db]"
      >
        <option v-for="c in campaigns" :key="c.slug" :value="c.slug">
          {{ c.name }} ({{ c.slug }})
        </option>
      </select>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-400">Loading funnel data...</div>
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{{ error }}</div>

    <template v-else-if="funnel">
      <!-- Funnel Visualization -->
      <div class="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
        <h2 class="text-sm font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <ChartBarIcon class="w-5 h-5 text-[#0099db]" />
          Conversion Funnel
        </h2>
        <div class="space-y-3">
          <div v-for="stage in funnelStages" :key="stage.name" class="flex items-center gap-4">
            <div class="w-24 flex items-center gap-2 text-sm font-medium text-gray-700">
              <component :is="stage.icon" class="w-4 h-4 text-gray-400" />
              {{ stage.name }}
            </div>
            <div class="flex-1">
              <div class="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                <div
                  :class="stage.color"
                  class="absolute inset-y-0 left-0 rounded-lg transition-all duration-500"
                  :style="{ width: Math.max(stage.rate, 1) + '%' }"
                />
                <div class="absolute inset-0 flex items-center px-3 text-sm font-medium"
                     :class="stage.rate > 30 ? 'text-white' : 'text-gray-700'">
                  {{ stage.count.toLocaleString() }}
                </div>
              </div>
            </div>
            <div class="w-16 text-right text-sm font-semibold" :class="stage.rate >= 50 ? 'text-green-600' : stage.rate >= 20 ? 'text-amber-600' : 'text-red-500'">
              {{ stage.rate.toFixed(1) }}%
            </div>
          </div>
        </div>
      </div>

      <!-- Metric Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
          <p class="text-xs text-gray-500 uppercase tracking-wide">Delivery Rate</p>
          <p class="text-2xl font-bold text-gray-900 mt-1">{{ funnel.delivery_rate.toFixed(1) }}%</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
          <p class="text-xs text-gray-500 uppercase tracking-wide">Open Rate</p>
          <p class="text-2xl font-bold text-gray-900 mt-1">{{ funnel.open_rate.toFixed(1) }}%</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
          <p class="text-xs text-gray-500 uppercase tracking-wide">Click Rate</p>
          <p class="text-2xl font-bold text-gray-900 mt-1">{{ funnel.click_rate.toFixed(1) }}%</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
          <p class="text-xs text-gray-500 uppercase tracking-wide">Total Enrolled</p>
          <p class="text-2xl font-bold text-gray-900 mt-1">{{ funnel.enrolled.toLocaleString() }}</p>
        </div>
      </div>

      <!-- A/B Variant Performance -->
      <div class="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-gray-900">A/B Variant Performance</h2>
          <div class="flex items-center gap-2">
            <label class="text-xs text-gray-500">Step:</label>
            <select
              v-model.number="selectedStep"
              @change="loadVariants"
              class="rounded-lg border-gray-300 text-xs focus:ring-[#0099db]/40 focus:border-[#0099db]"
            >
              <option :value="0">All Steps</option>
              <option v-for="i in (campaigns.find(c => c.slug === selectedSlug)?.steps.length || 3)" :key="i" :value="i">
                Step {{ i }}
              </option>
            </select>
          </div>
        </div>

        <div v-if="variants.length === 0" class="text-center py-8 text-gray-400 text-sm">
          No A/B variant data yet. Configure variants in the campaign editor.
        </div>
        <table v-else class="w-full text-sm">
          <thead>
            <tr class="text-left text-gray-500 text-xs uppercase tracking-wide">
              <th class="pb-3">Variant</th>
              <th class="pb-3">Template</th>
              <th class="pb-3 text-right">Sent</th>
              <th class="pb-3 text-right">Delivered</th>
              <th class="pb-3 text-right">Opened</th>
              <th class="pb-3 text-right">Clicked</th>
              <th class="pb-3 text-right">Open Rate</th>
              <th class="pb-3 text-right">Click Rate</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in variants" :key="v.variant_id" class="border-t border-gray-100">
              <td class="py-3 font-medium text-gray-900">{{ v.variant_id }}</td>
              <td class="py-3 text-gray-600 font-mono text-xs">{{ v.template_key }}</td>
              <td class="py-3 text-right text-gray-600">{{ v.total_sent.toLocaleString() }}</td>
              <td class="py-3 text-right text-gray-600">{{ v.delivered.toLocaleString() }}</td>
              <td class="py-3 text-right text-gray-600">{{ v.opened.toLocaleString() }}</td>
              <td class="py-3 text-right text-gray-600">{{ v.clicked.toLocaleString() }}</td>
              <td class="py-3 text-right font-semibold" :class="v.open_rate > 25 ? 'text-green-600' : 'text-amber-600'">
                {{ v.open_rate.toFixed(1) }}%
              </td>
              <td class="py-3 text-right font-semibold" :class="v.click_rate > 5 ? 'text-green-600' : 'text-amber-600'">
                {{ v.click_rate.toFixed(1) }}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
