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
    <div v-if="loading" class="text-center py-12 text-gray-400">Loading...</div>
    <div v-else-if="data" class="bg-white rounded-xl border border-gray-200 p-6">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="text-left text-gray-500 text-xs uppercase">
            <th class="pb-2">Product</th>
            <th class="pb-2 text-right">Views</th>
            <th class="pb-2 text-right">Add to Cart</th>
            <th class="pb-2 text-right">Cart Rate</th>
            <th class="pb-2 text-right">Purchases</th>
            <th class="pb-2 text-right">Conv. Rate</th>
            <th class="pb-2 text-right">Revenue</th>
          </tr></thead>
          <tbody>
            <tr v-for="p in data.products" :key="p.product_id" class="border-t border-gray-100">
              <td class="py-2 text-gray-900 font-medium">{{ p.name }}</td>
              <td class="py-2 text-right text-gray-600">{{ p.views.toLocaleString() }}</td>
              <td class="py-2 text-right text-gray-600">{{ p.add_to_cart.toLocaleString() }}</td>
              <td class="py-2 text-right text-blue-600">{{ p.cart_rate.toFixed(1) }}%</td>
              <td class="py-2 text-right text-gray-600">{{ p.purchases.toLocaleString() }}</td>
              <td class="py-2 text-right text-green-600">{{ p.conversion_rate.toFixed(1) }}%</td>
              <td class="py-2 text-right text-gray-900 font-medium">${{ p.revenue.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!data.products.length" class="text-sm text-gray-400 text-center py-4">No product data available</p>
    </div>
  </AnalyticsLayout>
</template>
