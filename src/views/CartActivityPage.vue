<script setup lang="ts">
/**
 * CartActivityPage — real-time cart-abandonment feed + top-abandoned
 * products. Drives prioritisation of re-engagement templates.
 *
 * Polling (not SSE) for now — the cart event firehose would be noisy on
 * the shared SSE channel and the 30-second refresh already gives "good
 * enough" recency for this use case. SSE upgrade is additive when needed.
 */
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import { fetchAbandonedCarts, fetchTopAbandonedProducts,
  type AbandonedCart, type TopAbandonedProduct } from '@/api/catalog'
import { useToast } from '@/composables/useToast'
import {
  ShoppingCartIcon, ArrowPathIcon, ClockIcon, UserIcon, PhotoIcon,
} from '@heroicons/vue/24/outline'

const router = useRouter()
const { showToast } = useToast()

const loading = ref(true)
const withinMinutes = ref(60)
const carts = ref<AbandonedCart[]>([])
const aggregate = ref({ total_count: 0, total_value: 0, avg_value: 0 })
const topProducts = ref<TopAbandonedProduct[]>([])

// Nullable so the visibility handler can toggle the timer without
// double-starts and so unmount cleanup is a no-op when already stopped.
let refreshTimer: ReturnType<typeof setInterval> | null = null

function startPolling() {
  if (refreshTimer) return
  refreshTimer = setInterval(load, 30_000)
}
function stopPolling() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null }
}
// Mirrors HealthPage: don't burn requests while the tab is hidden, and
// force an immediate refetch on visibility to close the gap caused by a
// long background pause (e.g. laptop resumed from sleep).
function onVisibilityChange() {
  if (document.hidden) stopPolling()
  else { load(); startPolling() }
}

async function load() {
  loading.value = true
  try {
    const [a, t] = await Promise.all([
      fetchAbandonedCarts({ within_minutes: withinMinutes.value, limit: 100 }),
      fetchTopAbandonedProducts(24),
    ])
    carts.value = a.abandoned || []
    aggregate.value = a.aggregate
    topProducts.value = t.products || []
  } catch {
    showToast('Failed to refresh cart activity', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  startPolling()
  document.addEventListener('visibilitychange', onVisibilityChange)
})
onUnmounted(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

function parsedItems(raw?: string): Array<{ name?: string; quantity?: number }> {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m ago`
}

function money(n: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n)
}

const windowOptions = [15, 30, 60, 120, 360, 1440]
const currentLabel = computed(() =>
  withinMinutes.value < 60 ? `${withinMinutes.value}m` : `${Math.round(withinMinutes.value / 60)}h`,
)
</script>

<template>
  <div class="page-enter mx-auto max-w-7xl space-y-4 p-6">
    <PageHeader
      title="Cart activity"
      description="Abandoned carts by client, refreshed every 30 seconds. Jump to a client's journey timeline for full context."
    >
      <template #actions>
        <button @click="load" :disabled="loading"
                class="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800 disabled:opacity-50"
                aria-label="Refresh now">
          <ArrowPathIcon class="h-4 w-4" :class="{ 'animate-spin': loading }" /> Refresh
        </button>
      </template>
    </PageHeader>

    <!-- Window selector + KPIs -->
    <div class="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div class="flex items-center gap-2">
        <span class="text-xs uppercase tracking-wide text-neutral-500">Window</span>
        <div class="inline-flex rounded-md border border-neutral-200 p-0.5 dark:border-neutral-700" role="group" aria-label="Time window">
          <button v-for="opt in windowOptions" :key="opt"
                  @click="withinMinutes = opt; load()"
                  :aria-pressed="withinMinutes === opt"
                  :class="[
                    'px-2 py-1 text-xs font-medium rounded',
                    withinMinutes === opt
                      ? 'bg-ma-accent text-white'
                      : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
                  ]">
            {{ opt < 60 ? opt + 'm' : Math.round(opt / 60) + 'h' }}
          </button>
        </div>
      </div>
      <span class="ml-auto text-xs text-neutral-500" role="status" aria-live="polite">
        Auto-refresh every 30s
      </span>
    </div>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div class="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <div class="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Abandoned · last {{ currentLabel }}</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-error-text)] dark:text-rose-400">{{ aggregate.total_count.toLocaleString() }}</div>
      </div>
      <div class="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <div class="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Total abandoned value</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums">{{ money(aggregate.total_value) }}</div>
      </div>
      <div class="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <div class="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Avg. abandoned cart</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums">{{ money(aggregate.avg_value) }}</div>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-3">
      <!-- Feed -->
      <div class="lg:col-span-2">
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Recent abandoned carts</h3>
        <div v-if="carts.length === 0" class="rounded-lg border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500 dark:border-neutral-700">
          <ShoppingCartIcon class="mx-auto h-8 w-8 opacity-40" aria-hidden="true" />
          <p class="mt-2">Nothing abandoned in this window.</p>
        </div>
        <ul v-else class="space-y-2">
          <li v-for="c in carts" :key="`${c.client_id}-${c.started_at}`"
              class="rounded-lg border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div class="flex items-center justify-between">
              <button
                @click="router.push(`/clients/${c.client_id}/journey`)"
                class="flex items-center gap-2 font-medium hover:underline"
                :aria-label="`Open journey for client ${c.client_id}`"
              >
                <UserIcon class="h-4 w-4 text-neutral-500" aria-hidden="true" />
                Client #{{ c.client_id }}
              </button>
              <div class="flex items-center gap-3 text-xs text-neutral-500">
                <span class="flex items-center gap-1"><ClockIcon class="h-3 w-3" aria-hidden="true" />{{ timeAgo(c.started_at) }}</span>
                <span class="font-mono text-neutral-700 dark:text-neutral-300">{{ money(c.cart_total) }}</span>
              </div>
            </div>
            <div v-if="parsedItems(c.cart_items).length > 0" class="mt-1.5 text-xs text-neutral-600 dark:text-neutral-400">
              <span v-for="(it, i) in parsedItems(c.cart_items).slice(0, 4)" :key="i">
                {{ it.name || '—' }}<span v-if="it.quantity && it.quantity > 1">×{{ it.quantity }}</span><span v-if="i < Math.min(3, parsedItems(c.cart_items).length - 1)">, </span>
              </span>
              <span v-if="parsedItems(c.cart_items).length > 4" class="opacity-60">
                +{{ parsedItems(c.cart_items).length - 4 }} more
              </span>
            </div>
          </li>
        </ul>
      </div>

      <!-- Top abandoned products -->
      <div>
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Top abandoned products · 24h</h3>
        <ul v-if="topProducts.length > 0" class="space-y-2">
          <li v-for="p in topProducts.slice(0, 10)" :key="p.product_id"
              class="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2 text-sm dark:border-neutral-800 dark:bg-neutral-900">
            <img v-if="p.image_url" :src="p.image_url" :alt="p.name"
                 class="h-10 w-10 flex-shrink-0 rounded object-cover" loading="lazy" />
            <div v-else class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-neutral-100 dark:bg-neutral-800">
              <PhotoIcon class="h-5 w-5 text-neutral-400" aria-hidden="true" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate font-medium">{{ p.name }}</div>
              <div class="font-mono text-[11px] text-neutral-500">{{ money(p.price) }}</div>
            </div>
            <span class="rounded bg-[var(--color-error-soft)] px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--color-error-text)] dark:bg-rose-900/40 dark:text-rose-200">{{ p.abandon_count }}</span>
          </li>
        </ul>
        <div v-else class="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-xs text-neutral-500 dark:border-neutral-700">
          No abandoned products in the last 24h.
        </div>
      </div>
    </div>
  </div>
</template>
