<script setup lang="ts">
/**
 * CatalogPage — read-mostly view of the product catalog. Products
 * are sourced from the upstream e-commerce system via
 * /internal/catalog/ingest (service-to-service) or manually via the
 * upsert form. MA doesn't own the product source of truth, so the
 * page stays lean: list + search + filter + deactivate + ad-hoc
 * upsert for manual additions.
 */
import { ref, computed, onMounted, watch } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonTable from '@/components/SkeletonTable.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ModalWrapper from '@/components/ModalWrapper.vue'
import { useToast } from '@/composables/useToast'
import { useAction } from '@/composables/useAction'
import {
  listProducts, upsertProduct, deactivateProduct,
  type Product, type ProductUpsertRequest,
} from '@/api/catalog'
import {
  MagnifyingGlassIcon, TrashIcon, PencilSquareIcon, PlusIcon,
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

// Categories derived from the current page — avoids a separate
// /categories endpoint; upstream additions surface on next load.
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
  <div class="page-enter">
    <PageHeader
      kicker="Inventory"
      title="Product catalog"
      description="Products synced from the upstream store. Used for dynamic content, recommendations, and cart-aware segmentation."
    >
      <button @click="openCreate" class="btn btn-primary">
        <PlusIcon class="h-4 w-4" aria-hidden="true" /> New product
      </button>
    </PageHeader>

    <!-- Meta strip -->
    <div v-if="!loading && rows.length" class="cat-meta">
      <span class="rule-dot">Products</span>
      <span class="cat-meta-num num-tabular">{{ total.toLocaleString() }}</span>
      <span class="cat-meta-lbl">total</span>
      <span class="cat-meta-rule" />
    </div>

    <!-- Editorial toolbar -->
    <div class="cat-toolbar">
      <div class="cat-search">
        <MagnifyingGlassIcon class="cat-search-icon" aria-hidden="true" />
        <input
          v-model="q"
          type="search"
          placeholder="Search name or external ID…"
          aria-label="Search products"
          class="cat-search-input"
        />
      </div>

      <select v-model="category" class="cat-select" aria-label="Category filter">
        <option value="">All categories</option>
        <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
      </select>

      <select v-model="activeFilter" class="cat-select" aria-label="Status filter">
        <option value="all">All statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    </div>

    <!-- Loading -->
    <SkeletonTable v-if="loading" :rows="6" :columns="5" />

    <!-- Empty -->
    <EmptyState
      v-else-if="rows.length === 0"
      :icon="PhotoIcon"
      title="No products yet."
    >
      <template #description>
        <span>
          Ingest from your e-commerce system via
          <code class="cat-code-inline">POST /internal/catalog/ingest</code>
          or add one manually.
        </span>
      </template>
    </EmptyState>

    <!-- Table -->
    <div v-else class="cat-card table-scroll">
      <table class="cat-table">
        <thead>
          <tr>
            <th class="cat-th">Product</th>
            <th class="cat-th">External ID</th>
            <th class="cat-th">Category</th>
            <th class="cat-th cat-th-right">Price</th>
            <th class="cat-th cat-th-center">Status</th>
            <th class="cat-th cat-th-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in rows" :key="p.id" class="cat-row">
            <td class="cat-td">
              <div class="cat-product">
                <img
                  v-if="p.image_url"
                  :src="p.image_url"
                  :alt="p.name"
                  class="cat-thumb"
                  loading="lazy"
                />
                <div v-else class="cat-thumb cat-thumb-empty">
                  <PhotoIcon class="h-5 w-5" aria-hidden="true" />
                </div>
                <div class="cat-product-text">
                  <div class="cat-product-name">{{ p.name }}</div>
                  <div v-if="p.description" class="cat-product-desc">{{ p.description }}</div>
                </div>
              </div>
            </td>
            <td class="cat-td">
              <code class="cat-code">{{ p.external_id }}</code>
            </td>
            <td class="cat-td">
              <span v-if="p.category" class="cat-chip">{{ p.category }}</span>
              <span v-else class="cat-dim">—</span>
            </td>
            <td class="cat-td cat-td-right">
              <span class="cat-price num-tabular">{{ priceDisplay(p) }}</span>
            </td>
            <td class="cat-td cat-td-center">
              <StatusBadge :status="p.is_active ? 'active' : 'inactive'" />
            </td>
            <td class="cat-td cat-td-right">
              <div class="cat-actions">
                <button
                  @click="openEdit(p)"
                  class="cat-action"
                  :aria-label="`Edit product ${p.name}`"
                  title="Edit"
                >
                  <PencilSquareIcon class="h-4 w-4" />
                </button>
                <button
                  v-if="p.is_active"
                  @click="deleteTarget = p"
                  class="cat-action cat-action-danger"
                  :aria-label="`Deactivate product ${p.name}`"
                  title="Deactivate"
                >
                  <TrashIcon class="h-4 w-4" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Editor modal -->
    <ModalWrapper
      :model-value="editorOpen"
      :title="editing ? 'Edit product' : 'New product'"
      size="md"
      @update:model-value="(v) => { if (!v) editorOpen = false }"
    >
      <template #body>
        <form id="cat-product-form" @submit.prevent="saveAction.execute()" class="cat-form">
            <div class="cat-field">
              <label>External ID</label>
              <input
                v-model="form.external_id"
                :disabled="!!editing"
                class="mono"
                required
                placeholder="sku-1234"
              />
            </div>
            <div class="cat-field">
              <label>Name</label>
              <input v-model="form.name" required placeholder="e.g. Vault 120ml" />
            </div>

            <div class="cat-grid-2">
              <div class="cat-field">
                <label>Price</label>
                <input v-model.number="form.price" type="number" step="0.01" min="0" class="mono" />
              </div>
              <div class="cat-field">
                <label>Currency</label>
                <input v-model="form.currency" maxlength="3" class="mono cat-upper" />
              </div>
            </div>

            <div class="cat-field">
              <label>Category</label>
              <input v-model="form.category" placeholder="e.g. perfume, gift" />
            </div>

            <div class="cat-field">
              <label>Image URL</label>
              <input v-model="form.image_url" class="mono" placeholder="https://…" />
            </div>

            <div class="cat-field">
              <label>Description</label>
              <textarea v-model="form.description" rows="2" placeholder="Optional customer-facing description…" />
            </div>

        </form>
      </template>
      <template #footer>
        <button type="button" @click="editorOpen = false" class="btn btn-ghost">Cancel</button>
        <button
          type="submit"
          form="cat-product-form"
          :disabled="saveAction.pending.value"
          class="btn btn-primary"
        >
          {{ saveAction.pending.value ? 'Saving…' : (editing ? 'Save' : 'Create') }}
        </button>
      </template>
    </ModalWrapper>

    <ConfirmDialog
      :open="deleteOpen"
      :title="`Deactivate ${deleteTarget?.name || ''}?`"
      :message="`Mark this product inactive. Recommendations and cart-condition evaluators will stop surfacing it. Upstream ingestion can re-activate on next sync.`"
      confirm-text="Deactivate"
      cancel-text="Keep"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="deleteTarget = null"
    />
  </div>
</template>

<style scoped>
/* ── Meta strip ── */
.cat-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 18px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-tertiary);
  letter-spacing: 0.02em;
}
.cat-meta-num { color: var(--color-text-primary); font-weight: 500; font-size: 12px; }
.cat-meta-lbl { color: var(--color-text-muted); }
.cat-meta-rule { flex: 1; height: 1px; background: var(--color-divider); margin-left: 8px; }

/* ── Toolbar ── */
.cat-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  margin-bottom: 18px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.cat-search {
  position: relative;
  flex: 1;
  min-width: 220px;
  max-width: 360px;
}
.cat-search-icon {
  position: absolute;
  left: 9px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  color: var(--color-text-muted);
  pointer-events: none;
}
.cat-search-input {
  width: 100%;
  font-family: var(--font-sans);
  font-size: 12.5px;
  color: var(--color-text-secondary);
  background: var(--color-bg-page);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 6px 10px 6px 28px;
  transition: border-color var(--transition-fast);
}
.cat-search-input:focus {
  outline: none;
  border-color: var(--hks-cyan);
  box-shadow: 0 0 0 2px var(--color-accent-light);
}
.cat-select {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg-page);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 6px 10px;
  transition: border-color var(--transition-fast);
}
.cat-select:hover { border-color: var(--color-border-strong); }
.cat-select:focus {
  outline: none;
  border-color: var(--hks-cyan);
  box-shadow: 0 0 0 2px var(--color-accent-light);
}

/* ── Table ── */
.cat-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.cat-table { width: 100%; border-collapse: collapse; font-family: var(--font-sans); }
.cat-th {
  padding: 12px 16px;
  text-align: left;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  background: var(--color-bg-table-header);
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}
.cat-th-right { text-align: right; }
.cat-th-center { text-align: center; }

.cat-row { transition: background var(--transition-fast); }
.cat-row:hover { background: var(--color-bg-subtle); }
.cat-td {
  padding: 13px 16px;
  font-size: 13px;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-divider);
  vertical-align: middle;
}
.cat-row:last-child .cat-td { border-bottom: 0; }
.cat-td-right { text-align: right; }
.cat-td-center { text-align: center; }

.cat-product { display: flex; align-items: center; gap: 12px; }
.cat-thumb {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-muted);
}
.cat-thumb-empty {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}
.cat-product-text { min-width: 0; flex: 1; }
.cat-product-name {
  font-family: var(--font-sans);
  font-weight: 500;
  font-size: 13.5px;
  color: var(--color-text-primary);
  letter-spacing: -0.005em;
}
.cat-product-desc {
  margin-top: 2px;
  font-size: 11.5px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 340px;
}

.cat-code {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 11.5px;
  padding: 2px 7px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-muted);
  border-radius: var(--radius-sm);
  color: var(--color-text-tertiary);
}
.cat-code-inline {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 5px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-muted);
  border-radius: var(--radius-sm);
  color: var(--color-text-tertiary);
}

.cat-chip {
  font-family: var(--font-mono);
  font-size: 10.5px;
  padding: 2px 7px;
  background: var(--color-info-bg);
  color: var(--color-info-text);
  border: 1px solid var(--color-info-border);
  border-radius: var(--radius-sm);
  letter-spacing: 0.01em;
}
.cat-dim { color: var(--color-text-muted); font-family: var(--font-mono); font-size: 11px; }

.cat-price {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 15px;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums lining-nums;
  letter-spacing: -0.01em;
}

.cat-actions { display: inline-flex; gap: 2px; justify-content: flex-end; }
.cat-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px; height: 30px;
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast);
}
.cat-action:hover {
  color: var(--hks-deep-blue);
  background: var(--color-bg-subtle);
  border-color: var(--color-border);
}
.cat-action-danger:hover { color: var(--color-error); border-color: var(--color-error-border); }

/* ── Modal ── */
.cat-modal-root {
  position: fixed; inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: catFadeIn 0.2s ease-out;
}
@keyframes catFadeIn { from { opacity: 0; } to { opacity: 1; } }
.cat-modal-scrim {
  position: absolute; inset: 0;
  background: rgba(10, 13, 24, 0.55);
  backdrop-filter: blur(4px);
}
.cat-modal {
  position: relative;
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  animation: catSlideUp 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes catSlideUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.cat-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 22px 24px 16px;
  border-bottom: 1px solid var(--color-divider);
}
.cat-modal-title {
  margin-top: 6px;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 26px;
  letter-spacing: -0.02em;
  color: var(--color-text-primary);
  font-variation-settings: 'opsz' 72, 'SOFT' 30;
}
.cat-modal-close {
  width: 32px; height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast);
}
.cat-modal-close:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-subtle);
}

.cat-form {
  padding: 18px 24px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cat-field { display: flex; flex-direction: column; gap: 5px; }
.cat-field > label {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
}
.cat-field input, .cat-field textarea, .cat-field select {
  font-family: var(--font-sans);
  font-size: 13.5px;
  padding: 9px 11px;
  color: var(--color-text-primary);
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.cat-field input.mono, .cat-field textarea.mono { font-family: var(--font-mono); font-size: 12.5px; }
.cat-field input.cat-upper { text-transform: uppercase; }
.cat-field input:focus, .cat-field textarea:focus {
  outline: none;
  border-color: var(--hks-cyan);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}
.cat-field input:disabled { opacity: 0.6; cursor: not-allowed; }
.cat-field input::placeholder, .cat-field textarea::placeholder { color: var(--color-text-muted); }

.cat-grid-2 {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 14px;
}
@media (max-width: 540px) { .cat-grid-2 { grid-template-columns: 1fr; } }

.cat-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 14px;
  margin-top: 6px;
  border-top: 1px solid var(--color-divider);
}
</style>
