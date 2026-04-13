<script setup lang="ts">
/**
 * CatalogPage — read-mostly view of the product catalog. Products are
 * sourced from the upstream e-commerce system via
 * /internal/catalog/ingest (service-to-service) or manually via the
 * upsert form here. MA doesn't own the product source of truth, so this
 * page is deliberately lean — list + search + filter + deactivate.
 */
import { ref, computed, onMounted, watch } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useToast } from '@/composables/useToast'
import { useAction } from '@/composables/useAction'
import {
  listProducts, upsertProduct, deactivateProduct,
  type Product, type ProductUpsertRequest,
} from '@/api/catalog'
import {
  MagnifyingGlassIcon, TrashIcon, PencilSquareIcon, PlusIcon, XMarkIcon,
  PhotoIcon,
} from '@heroicons/vue/24/outline'

const { showToast } = useToast()

const rows = ref<Product[]>([])
const total = ref(0)
const loading = ref(true)

// Filters — debounced 300ms on search.
const q = ref('')
const category = ref<string>('')
const activeFilter = ref<'all' | 'active' | 'inactive'>('all')
let searchDebounce: ReturnType<typeof setTimeout> | null = null

const editorOpen = ref(false)
const form = ref<ProductUpsertRequest>({
  external_id: '',
  name: '',
  price: 0,
  currency: 'USD',
})
const editing = ref<Product | null>(null)

const deleteTarget = ref<Product | null>(null)
const deleteOpen = computed({
  get: () => !!deleteTarget.value,
  set: v => { if (!v) deleteTarget.value = null },
})

// Categories derived from the current page — coarse but avoids a separate
// /categories endpoint. Upstream syncs can add categories anytime; they
// surface here on next page load.
const categories = computed(() => {
  const s = new Set<string>()
  for (const p of rows.value) if (p.category) s.add(p.category)
  return Array.from(s).sort()
})

async function load() {
  loading.value = true
  try {
    const active = activeFilter.value === 'all' ? undefined : activeFilter.value === 'active'
    const data = await listProducts({
      q: q.value || undefined,
      category: category.value || undefined,
      active,
      limit: 100,
    })
    rows.value = data.products || []
    total.value = data.total
  } catch {
    showToast('Failed to load products', 'error')
  } finally {
    loading.value = false
  }
}
onMounted(load)

watch(q, () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(load, 300)
})
watch([category, activeFilter], load)

function openCreate() {
  editing.value = null
  form.value = { external_id: '', name: '', price: 0, currency: 'USD', category: '', description: '', image_url: '' }
  editorOpen.value = true
}

function openEdit(p: Product) {
  editing.value = p
  form.value = {
    external_id: p.external_id,
    name: p.name,
    description: p.description,
    image_url: p.image_url,
    price: p.price,
    currency: p.currency,
    category: p.category,
  }
  editorOpen.value = true
}

const saveAction = useAction(async () => {
  if (!form.value.external_id.trim() || !form.value.name.trim()) {
    throw new Error('external_id and name are required')
  }
  await upsertProduct(form.value)
  showToast(editing.value ? 'Product updated' : 'Product created', 'success')
  editorOpen.value = false
  await load()
})

async function confirmDelete() {
  if (!deleteTarget.value) return
  try {
    await deactivateProduct(deleteTarget.value.id)
    showToast('Product deactivated', 'success')
    deleteTarget.value = null
    await load()
  } catch {
    showToast('Deactivate failed', 'error')
  }
}

function priceDisplay(p: Product): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency || 'USD' }).format(p.price)
  } catch {
    return `${p.currency || ''} ${p.price.toFixed(2)}`
  }
}
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-4 p-6">
    <PageHeader
      title="Product catalog"
      description="Products synced from the upstream store. Used for dynamic content, recommendations, and cart-aware segmentation."
    >
      <template #actions>
        <button
          @click="openCreate"
          class="inline-flex items-center gap-2 rounded-md bg-ma-accent px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-ma-accent-hover"
        >
          <PlusIcon class="h-4 w-4" /> New product
        </button>
      </template>
    </PageHeader>

    <!-- Filter row -->
    <div class="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
      <label class="relative flex-1 min-w-[240px]">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-neutral-400" aria-hidden="true" />
        <input
          v-model="q"
          type="search"
          placeholder="Search name or external ID…"
          aria-label="Search products"
          class="w-full rounded-md border border-neutral-300 bg-white pl-8 pr-3 py-2 text-sm focus:border-ma-accent focus:outline-none focus:ring-1 focus:ring-ma-accent dark:border-neutral-700 dark:bg-neutral-800"
        />
      </label>

      <label class="flex items-center gap-2">
        <span class="text-xs uppercase tracking-wide text-neutral-500">Category</span>
        <select v-model="category" class="rounded border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-800">
          <option value="">all</option>
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>

      <label class="flex items-center gap-2">
        <span class="text-xs uppercase tracking-wide text-neutral-500">Status</span>
        <select v-model="activeFilter" class="rounded border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-800">
          <option value="all">all</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
      </label>

      <span class="ml-auto text-xs text-neutral-500">{{ total.toLocaleString() }} total</span>
    </div>

    <div v-if="loading" class="py-10 text-center text-neutral-500" role="status">Loading…</div>

    <div v-else-if="rows.length === 0" class="rounded-lg border border-dashed border-neutral-300 p-10 text-center text-neutral-500 dark:border-neutral-700">
      <PhotoIcon class="mx-auto h-10 w-10 opacity-40" aria-hidden="true" />
      <p class="mt-2 text-sm">No products yet.</p>
      <p class="text-xs opacity-70">Ingest from your e-commerce system via <code class="font-mono">POST /internal/catalog/ingest</code> or add one manually.</p>
    </div>

    <div v-else class="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <table class="w-full text-sm">
        <thead class="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          <tr>
            <th class="px-4 py-3">Product</th>
            <th class="px-4 py-3">External ID</th>
            <th class="px-4 py-3">Category</th>
            <th class="px-4 py-3 text-right">Price</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-100 dark:divide-neutral-800">
          <tr v-for="p in rows" :key="p.id" class="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40">
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <img v-if="p.image_url" :src="p.image_url" :alt="p.name"
                     class="h-10 w-10 flex-shrink-0 rounded object-cover" loading="lazy" />
                <div v-else class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-neutral-100 text-neutral-400 dark:bg-neutral-800">
                  <PhotoIcon class="h-5 w-5" aria-hidden="true" />
                </div>
                <div class="min-w-0">
                  <div class="truncate font-medium">{{ p.name }}</div>
                  <div v-if="p.description" class="truncate text-xs text-neutral-500">{{ p.description }}</div>
                </div>
              </div>
            </td>
            <td class="px-4 py-3 font-mono text-xs text-neutral-600 dark:text-neutral-300">{{ p.external_id }}</td>
            <td class="px-4 py-3">
              <span v-if="p.category" class="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{{ p.category }}</span>
              <span v-else class="text-xs text-neutral-400">—</span>
            </td>
            <td class="px-4 py-3 text-right font-mono">{{ priceDisplay(p) }}</td>
            <td class="px-4 py-3">
              <span v-if="p.is_active" class="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">active</span>
              <span v-else class="inline-flex items-center gap-1 rounded bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">inactive</span>
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-1">
                <button @click="openEdit(p)" aria-label="Edit product"
                        class="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white">
                  <PencilSquareIcon class="h-4 w-4" />
                </button>
                <button v-if="p.is_active" @click="deleteTarget = p" aria-label="Deactivate product"
                        class="rounded p-1.5 text-neutral-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30">
                  <TrashIcon class="h-4 w-4" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Editor modal -->
    <div v-if="editorOpen" class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" @click.self="editorOpen = false">
      <div class="mt-12 w-full max-w-lg rounded-lg bg-white shadow-xl dark:bg-neutral-900">
        <div class="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800">
          <h2 class="text-lg font-semibold">{{ editing ? 'Edit product' : 'New product' }}</h2>
          <button @click="editorOpen = false" aria-label="Close" class="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>
        <div class="space-y-3 p-4">
          <div>
            <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">External ID</label>
            <input v-model="form.external_id" :disabled="!!editing"
                   class="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 font-mono text-sm disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800" />
          </div>
          <div>
            <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Name</label>
            <input v-model="form.name" class="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800" />
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div class="col-span-2">
              <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Price</label>
              <input v-model.number="form.price" type="number" step="0.01" min="0"
                     class="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-800" />
            </div>
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Currency</label>
              <input v-model="form.currency" maxlength="3"
                     class="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 font-mono text-sm uppercase dark:border-neutral-700 dark:bg-neutral-800" />
            </div>
          </div>
          <div>
            <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Category</label>
            <input v-model="form.category" class="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800" />
          </div>
          <div>
            <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Image URL</label>
            <input v-model="form.image_url" class="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-800" />
          </div>
          <div>
            <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Description</label>
            <textarea v-model="form.description" rows="2"
                      class="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800" />
          </div>
        </div>
        <div class="flex items-center justify-end gap-2 border-t border-neutral-200 p-4 dark:border-neutral-800">
          <button @click="editorOpen = false" class="rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">Cancel</button>
          <button @click="saveAction.execute()" :disabled="saveAction.pending.value"
                  class="inline-flex items-center gap-2 rounded-md bg-ma-accent px-4 py-2 text-sm font-medium text-white hover:bg-ma-accent-hover disabled:opacity-50">
            {{ editing ? 'Save' : 'Create' }}
          </button>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :open="deleteOpen" @update:open="(v: boolean) => !v && (deleteTarget = null)"
      title="Deactivate product?"
      :message="`Mark «${deleteTarget?.name}» as inactive. Recommendations + cart-condition evaluators will stop surfacing it.`"
      confirm-label="Deactivate" confirm-variant="danger"
      @confirm="confirmDelete"
    />
  </div>
</template>
