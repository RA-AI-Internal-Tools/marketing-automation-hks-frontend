<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import AnalyticsLayout from '@/components/AnalyticsLayout.vue'
import { useAnalyticsStore } from '@/stores/analytics'
import { fetchProducts } from '@/api/analytics'
import type { ProductsData } from '@/api/types'

const analytics = useAnalyticsStore()
const data = ref<ProductsData | null>(null)
const loading = ref(true)
const error = ref('')

function safeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await fetchProducts(analytics.since, analytics.until)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load product data'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => analytics.queryParams, load)
</script>

<template>
  <AnalyticsLayout title="Products & Catalog" description="Product performance and conversion metrics">
    <div v-if="loading" class="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>
    <div v-else-if="error" class="bg-[var(--color-error-bg)] border border-[var(--color-error-border)] text-[var(--color-error-text)] px-4 py-3 rounded-lg text-sm">{{ error }}</div>
    <div v-else-if="data" class="space-y-4">
      <div class="bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] text-[var(--color-warning-text)] px-4 py-3 rounded-lg text-sm">
        Product metrics are derived from current staging event payloads. Product identity and revenue may be incomplete until upstream tracking sends canonical product fields consistently.
      </div>
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="text-left text-[var(--color-text-tertiary)] text-xs uppercase">
            <th class="pb-2">Product</th>
            <th class="pb-2 text-right">Views</th>
            <th class="pb-2 text-right">Add to Cart</th>
            <th class="pb-2 text-right">Cart Rate</th>
            <th class="pb-2 text-right">Purchases</th>
            <th class="pb-2 text-right">Conv. Rate</th>
            <th class="pb-2 text-right">Revenue</th>
          </tr></thead>
          <tbody>
            <tr v-for="p in data.products" :key="p.product_id" class="border-t border-[var(--color-border-muted)]">
              <td class="py-2 text-[var(--color-text-primary)] font-medium">{{ p.name }}</td>
              <td class="py-2 text-right text-[var(--color-text-secondary)]">{{ safeNumber(p.views).toLocaleString() }}</td>
              <td class="py-2 text-right text-[var(--color-text-secondary)]">{{ safeNumber(p.add_to_cart).toLocaleString() }}</td>
              <td class="py-2 text-right text-[var(--color-info-text)]">{{ safeNumber(p.cart_rate).toFixed(1) }}%</td>
              <td class="py-2 text-right text-[var(--color-text-secondary)]">{{ safeNumber(p.purchases).toLocaleString() }}</td>
              <td class="py-2 text-right text-[var(--color-success-text)]">{{ safeNumber(p.conversion_rate).toFixed(1) }}%</td>
              <td class="py-2 text-right text-[var(--color-text-primary)] font-medium">${{ safeNumber(p.revenue).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!data.products.length" class="text-sm text-[var(--color-text-muted)] text-center py-4">No product data available</p>
      </div>
    </div>
  </AnalyticsLayout>
</template>
