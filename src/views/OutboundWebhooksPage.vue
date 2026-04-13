<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useToast } from '@/composables/useToast'
import { useAction } from '@/composables/useAction'
import {
  listOutboundWebhooks, createOutboundWebhook, updateOutboundWebhook,
  deleteOutboundWebhook, fireTestWebhook, listWebhookDeliveries,
  retryDelivery, getDeliveryStats,
  type OutboundWebhook, type OutboundWebhookRequest, type WebhookDelivery,
  type DeliveryStats,
} from '@/api/outbound_webhooks'
import {
  PlusIcon, TrashIcon, PencilSquareIcon, XMarkIcon, BoltIcon,
  ClipboardDocumentIcon, CheckCircleIcon, ExclamationTriangleIcon,
  ClockIcon, ArrowPathIcon,
} from '@heroicons/vue/24/outline'

const { showToast } = useToast()

const rows = ref<OutboundWebhook[]>([])
const eventTypeCatalog = ref<string[]>([])
const loading = ref(true)
const stats = ref<DeliveryStats | null>(null)

// Editor
const editorOpen = ref(false)
const editing = ref<OutboundWebhook | null>(null)
const form = ref<OutboundWebhookRequest>({
  name: '', url: '', event_types: [], active: true, description: '',
})
const saving = ref(false)
const revealedSecret = ref<string | null>(null)

// Deliveries panel
const deliveriesOpen = ref(false)
const deliveriesFor = ref<OutboundWebhook | null>(null)
const deliveries = ref<WebhookDelivery[]>([])
const deliveriesLoading = ref(false)

// Delete confirm
const deleteTarget = ref<OutboundWebhook | null>(null)
const deleteOpen = computed({
  get: () => !!deleteTarget.value,
  set: v => { if (!v) deleteTarget.value = null },
})

async function load() {
  loading.value = true
  try {
    // Parallelise the two endpoints — the stats query is cheap but no
    // reason to serialise with the list load.
    const [data, s] = await Promise.all([
      listOutboundWebhooks(),
      getDeliveryStats(24).catch(() => null),
    ])
    rows.value = data.webhooks || []
    eventTypeCatalog.value = data.event_types || []
    stats.value = s
  } catch {
    showToast('Failed to load webhooks', 'error')
  } finally {
    loading.value = false
  }
}
onMounted(load)

function openCreate() {
  editing.value = null
  form.value = { name: '', url: '', event_types: [], active: true, description: '' }
  revealedSecret.value = null
  editorOpen.value = true
}

function openEdit(w: OutboundWebhook) {
  editing.value = w
  form.value = {
    name: w.name, url: w.url,
    event_types: [...w.event_types],
    active: w.active, description: w.description,
  }
  revealedSecret.value = null
  editorOpen.value = true
}

function toggleEvent(ev: string) {
  const arr = form.value.event_types
  const i = arr.indexOf(ev)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(ev)
}

async function save() {
  if (!form.value.name.trim() || !form.value.url.trim()) {
    showToast('Name and URL are required', 'error'); return
  }
  if (!/^https?:\/\//i.test(form.value.url)) {
    showToast('URL must start with http:// or https://', 'error'); return
  }
  if (form.value.event_types.length === 0) {
    showToast('Select at least one event type', 'error'); return
  }
  saving.value = true
  try {
    if (editing.value) {
      await updateOutboundWebhook(editing.value.id, form.value)
      showToast('Webhook updated', 'success')
      editorOpen.value = false
    } else {
      const resp = await createOutboundWebhook(form.value)
      revealedSecret.value = resp.secret
      showToast('Webhook created — copy the secret now', 'success')
      // keep modal open so user can copy the secret
    }
    await load()
  } catch (e: any) {
    showToast(e?.response?.data?.error || 'Save failed', 'error')
  } finally {
    saving.value = false
  }
}

// Wrapped in useAction: a rapid-click on "Test" (icon-only button, no
// visible pending state) could enqueue a duplicate test delivery. The
// composable's in-flight guard short-circuits the second call.
const fireTestAction = useAction(async (w: OutboundWebhook) => {
  const resp = await fireTestWebhook(w.id)
  showToast(`Test ${resp.event_type} queued`, 'success')
})
async function fireTest(w: OutboundWebhook) {
  try { await fireTestAction.execute(w) }
  catch { showToast('Test fire failed', 'error') }
}

async function openDeliveries(w: OutboundWebhook) {
  deliveriesFor.value = w
  deliveriesOpen.value = true
  deliveriesLoading.value = true
  try {
    const data = await listWebhookDeliveries({ webhook_id: w.id, limit: 100 })
    deliveries.value = data.deliveries
  } catch {
    showToast('Failed to load deliveries', 'error')
  } finally {
    deliveriesLoading.value = false
  }
}

async function retryOne(d: WebhookDelivery) {
  try {
    await retryDelivery(d.id)
    showToast('Delivery requeued', 'success')
    // Optimistically mark it pending in the open drawer so the UI reflects
    // state without waiting for a refetch. Worker will pick it up on next tick.
    d.status = 'pending'
    d.error_message = ''
  } catch (e: any) {
    showToast(e?.response?.data?.error || 'Retry failed', 'error')
  }
}

const showSignatureHelp = ref(false)

async function confirmDelete() {
  if (!deleteTarget.value) return
  try {
    await deleteOutboundWebhook(deleteTarget.value.id)
    showToast('Webhook deleted', 'success')
    deleteTarget.value = null
    await load()
  } catch {
    showToast('Delete failed', 'error')
  }
}

async function copyToClipboard(text: string, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(text)
    showToast(label, 'success')
  } catch {
    showToast('Copy failed', 'error')
  }
}

function statusBadgeClass(d: WebhookDelivery) {
  switch (d.status) {
    case 'delivered': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
    case 'failed':    return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
    case 'retrying':  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
    case 'in_flight': return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'
    default:          return 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200'
  }
}

function formatDate(s?: string | null): string {
  if (!s) return '—'
  try { return new Date(s).toLocaleString() } catch { return s }
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6 p-6">
    <PageHeader title="Outbound webhooks" description="HTTP notifications for campaign and consent events.">
      <template #actions>
        <button
          @click="openCreate"
          class="inline-flex items-center gap-2 rounded-md bg-ma-accent px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-ma-accent-hover"
        >
          <PlusIcon class="h-4 w-4" /> New webhook
        </button>
      </template>
    </PageHeader>

    <!-- 24h stats strip. Render even when zero — absence of deliveries in
         the last day IS the signal when you expect traffic. -->
    <div v-if="stats" class="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div class="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <div class="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Delivered · 24h</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{{ stats.delivered.toLocaleString() }}</div>
      </div>
      <div class="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <div class="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Failed · 24h</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums" :class="stats.failed > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-neutral-400'">{{ stats.failed.toLocaleString() }}</div>
      </div>
      <div class="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <div class="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Retrying now</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums" :class="stats.retrying > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-400'">{{ stats.retrying.toLocaleString() }}</div>
      </div>
      <div class="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <div class="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Pending</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums" :class="stats.pending > 10 ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-400'">{{ stats.pending.toLocaleString() }}</div>
      </div>
      <div class="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <div class="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Success rate</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums">
          {{
            (stats.delivered + stats.failed) === 0
              ? '—'
              : Math.round(100 * stats.delivered / (stats.delivered + stats.failed)) + '%'
          }}
        </div>
      </div>
    </div>

    <div v-if="loading" class="py-10 text-center text-neutral-500">Loading…</div>

    <div v-else-if="rows.length === 0" class="rounded-lg border border-dashed border-neutral-300 p-10 text-center text-neutral-500 dark:border-neutral-700">
      <BoltIcon class="mx-auto h-10 w-10 opacity-40" />
      <p class="mt-2 text-sm">No outbound webhooks configured yet.</p>
      <p class="text-xs opacity-70">Create one to forward campaign and consent events to your downstream systems.</p>
    </div>

    <div v-else class="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <table class="w-full text-sm">
        <thead class="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          <tr>
            <th class="px-4 py-3">Name</th>
            <th class="px-4 py-3">URL</th>
            <th class="px-4 py-3">Events</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Last delivery</th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-100 dark:divide-neutral-800">
          <tr v-for="w in rows" :key="w.id" class="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40">
            <td class="px-4 py-3 font-medium">{{ w.name }}</td>
            <td class="px-4 py-3 font-mono text-xs text-neutral-600 dark:text-neutral-300">{{ w.url }}</td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap gap-1">
                <span v-for="ev in w.event_types" :key="ev"
                      class="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-mono text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                  {{ ev }}
                </span>
              </div>
            </td>
            <td class="px-4 py-3">
              <span v-if="w.active" class="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                <CheckCircleIcon class="h-3 w-3" /> Active
              </span>
              <span v-else class="inline-flex items-center gap-1 rounded bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                Paused
              </span>
            </td>
            <td class="px-4 py-3 text-xs">
              <div v-if="w.last_delivery_at" class="flex items-center gap-1">
                <CheckCircleIcon v-if="w.last_delivery_success" class="h-3.5 w-3.5 text-emerald-600" />
                <ExclamationTriangleIcon v-else class="h-3.5 w-3.5 text-rose-600" />
                <span>{{ formatDate(w.last_delivery_at) }}</span>
              </div>
              <span v-else class="text-neutral-400">never</span>
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-1">
                <button @click="fireTest(w)" class="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white" :aria-label="`Fire test event for ${w.name}`" title="Fire test event">
                  <BoltIcon class="h-4 w-4" />
                </button>
                <button @click="openDeliveries(w)" class="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white" :aria-label="`Delivery log for ${w.name}`" title="Delivery log">
                  <ClockIcon class="h-4 w-4" />
                </button>
                <button @click="openEdit(w)" class="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white" :aria-label="`Edit webhook ${w.name}`" title="Edit">
                  <PencilSquareIcon class="h-4 w-4" />
                </button>
                <button @click="deleteTarget = w" class="rounded p-1.5 text-neutral-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30" :aria-label="`Delete webhook ${w.name}`" title="Delete">
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
      <div class="mt-12 w-full max-w-2xl rounded-lg bg-white shadow-xl dark:bg-neutral-900">
        <div class="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800">
          <h2 class="text-lg font-semibold">{{ editing ? 'Edit webhook' : 'New webhook' }}</h2>
          <button @click="editorOpen = false" class="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-4 p-4">
          <div v-if="revealedSecret" class="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
            <p class="text-sm font-medium text-amber-900 dark:text-amber-200">Signing secret (shown once)</p>
            <p class="mt-1 text-xs text-amber-800 dark:text-amber-300">Save this now — it will never be shown again.</p>
            <div class="mt-2 flex items-center gap-2">
              <code class="flex-1 break-all rounded bg-white px-2 py-1 font-mono text-xs dark:bg-neutral-900">{{ revealedSecret }}</code>
              <button @click="copyToClipboard(revealedSecret!, 'Secret copied')" class="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700">
                <ClipboardDocumentIcon class="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium uppercase tracking-wide text-neutral-500">Name</label>
            <input v-model="form.name" class="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-ma-accent focus:outline-none focus:ring-1 focus:ring-ma-accent dark:border-neutral-700 dark:bg-neutral-800" placeholder="CRM sync" />
          </div>

          <div>
            <label class="block text-xs font-medium uppercase tracking-wide text-neutral-500">URL</label>
            <input v-model="form.url" class="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm focus:border-ma-accent focus:outline-none focus:ring-1 focus:ring-ma-accent dark:border-neutral-700 dark:bg-neutral-800" placeholder="https://api.example.com/ma/webhook" />
          </div>

          <div>
            <label class="block text-xs font-medium uppercase tracking-wide text-neutral-500">Event types</label>
            <div class="mt-2 grid grid-cols-2 gap-2">
              <label v-for="ev in eventTypeCatalog" :key="ev"
                     class="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 px-2 py-1.5 text-xs font-mono hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                     :class="{ 'border-ma-accent bg-ma-accent/5 dark:bg-ma-accent/10': form.event_types.includes(ev) }">
                <input type="checkbox" :checked="form.event_types.includes(ev)" @change="toggleEvent(ev)" class="rounded" />
                {{ ev }}
              </label>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium uppercase tracking-wide text-neutral-500">Description</label>
            <textarea v-model="form.description" rows="2" class="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-ma-accent focus:outline-none focus:ring-1 focus:ring-ma-accent dark:border-neutral-700 dark:bg-neutral-800" placeholder="Optional notes" />
          </div>

          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="form.active" class="rounded" />
            Active
          </label>

          <div class="rounded-md bg-neutral-50 p-3 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
            <div class="flex items-center justify-between">
              <p class="font-medium text-neutral-700 dark:text-neutral-300">Signature verification</p>
              <button type="button" @click="showSignatureHelp = !showSignatureHelp" class="text-[11px] font-medium text-ma-accent hover:underline">
                {{ showSignatureHelp ? 'Hide' : 'Show' }} code samples
              </button>
            </div>
            <p class="mt-1">Every delivery sends <code class="font-mono">X-MA-Signature: sha256=…</code> and <code class="font-mono">X-MA-Timestamp</code> headers. Verify as <code class="font-mono">HMAC-SHA256(secret, timestamp + "." + body)</code>.</p>

            <div v-if="showSignatureHelp" class="mt-3 space-y-2">
              <details open>
                <summary class="cursor-pointer font-medium text-neutral-700 dark:text-neutral-300">Node.js</summary>
                <pre class="mt-1 overflow-auto rounded bg-neutral-100 p-2 font-mono text-[11px] dark:bg-neutral-900">import { createHmac, timingSafeEqual } from 'node:crypto'

// Reject if timestamp is &gt; 5 minutes old (replay defence).
const MAX_SKEW_SEC = 300

function verify(rawBody, headers, secret) {
  const sig = (headers['x-ma-signature'] || '').replace(/^sha256=/, '')
  const ts  = headers['x-ma-timestamp']
  if (!sig || !ts) return false
  if (Math.abs(Date.now() / 1000 - Number(ts)) &gt; MAX_SKEW_SEC) return false

  const expected = createHmac('sha256', secret)
    .update(`${ts}.${rawBody}`)
    .digest('hex')
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
}</pre>
              </details>
              <details>
                <summary class="cursor-pointer font-medium text-neutral-700 dark:text-neutral-300">Python</summary>
                <pre class="mt-1 overflow-auto rounded bg-neutral-100 p-2 font-mono text-[11px] dark:bg-neutral-900">import hmac, hashlib, time

MAX_SKEW_SEC = 300

def verify(raw_body: bytes, headers: dict, secret: str) -&gt; bool:
    sig = (headers.get('x-ma-signature') or '').removeprefix('sha256=')
    ts  = headers.get('x-ma-timestamp')
    if not sig or not ts:
        return False
    if abs(time.time() - int(ts)) &gt; MAX_SKEW_SEC:
        return False
    msg = f"{ts}.".encode() + raw_body
    expected = hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig, expected)</pre>
              </details>
              <details>
                <summary class="cursor-pointer font-medium text-neutral-700 dark:text-neutral-300">Go</summary>
                <pre class="mt-1 overflow-auto rounded bg-neutral-100 p-2 font-mono text-[11px] dark:bg-neutral-900">const maxSkew = 5 * time.Minute

func verify(rawBody []byte, h http.Header, secret string) bool {
    sig := strings.TrimPrefix(h.Get("X-MA-Signature"), "sha256=")
    ts, err := strconv.ParseInt(h.Get("X-MA-Timestamp"), 10, 64)
    if sig == "" || err != nil {
        return false
    }
    if d := time.Since(time.Unix(ts, 0)); d &gt; maxSkew || d &lt; -maxSkew {
        return false
    }
    mac := hmac.New(sha256.New, []byte(secret))
    fmt.Fprintf(mac, "%d.%s", ts, rawBody)
    expected := hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(sig), []byte(expected))
}</pre>
              </details>
              <p class="opacity-70">
                Reject requests older than ~5 minutes — the timestamp prefix is the replay defence;
                a delivery captured and replayed later will fail the skew check even though its
                signature is still cryptographically valid.
              </p>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-neutral-200 p-4 dark:border-neutral-800">
          <button @click="editorOpen = false" class="rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">Close</button>
          <button @click="save" :disabled="saving" class="inline-flex items-center gap-2 rounded-md bg-ma-accent px-4 py-2 text-sm font-medium text-white hover:bg-ma-accent-hover disabled:opacity-50">
            <ArrowPathIcon v-if="saving" class="h-4 w-4 animate-spin" />
            {{ editing ? 'Save' : 'Create' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Deliveries drawer -->
    <div v-if="deliveriesOpen" class="fixed inset-0 z-40 flex justify-end bg-black/50" @click.self="deliveriesOpen = false">
      <div class="h-full w-full max-w-3xl overflow-y-auto bg-white shadow-xl dark:bg-neutral-900">
        <div class="sticky top-0 flex items-center justify-between border-b border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div>
            <h2 class="text-lg font-semibold">Delivery log</h2>
            <p class="text-xs text-neutral-500">{{ deliveriesFor?.name }}</p>
          </div>
          <button @click="deliveriesOpen = false" class="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>

        <div v-if="deliveriesLoading" class="p-10 text-center text-neutral-500">Loading…</div>
        <div v-else-if="deliveries.length === 0" class="p-10 text-center text-neutral-500">No deliveries yet.</div>
        <div v-else class="divide-y divide-neutral-100 dark:divide-neutral-800">
          <div v-for="d in deliveries" :key="d.id" class="p-4 text-sm">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="rounded px-2 py-0.5 text-xs font-medium" :class="statusBadgeClass(d)">{{ d.status }}</span>
                <span class="font-mono text-xs text-neutral-600 dark:text-neutral-300">{{ d.event_type }}</span>
                <span v-if="d.http_status" class="font-mono text-xs text-neutral-500">HTTP {{ d.http_status }}</span>
              </div>
              <span class="text-xs text-neutral-500">{{ formatDate(d.created_at) }}</span>
            </div>
            <div class="mt-1 flex gap-4 text-xs text-neutral-500">
              <span>Attempt {{ d.attempts }}</span>
              <span v-if="d.delivered_at">delivered {{ formatDate(d.delivered_at) }}</span>
              <span v-else-if="d.next_attempt_at">next attempt {{ formatDate(d.next_attempt_at) }}</span>
            </div>
            <p v-if="d.error_message" class="mt-1 font-mono text-xs text-rose-600 dark:text-rose-400">{{ d.error_message }}</p>
            <details v-if="d.response_body" class="mt-1">
              <summary class="cursor-pointer text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white">Response body</summary>
              <pre class="mt-1 max-h-48 overflow-auto rounded bg-neutral-50 p-2 text-[11px] dark:bg-neutral-800">{{ d.response_body }}</pre>
            </details>
            <div v-if="d.status === 'failed'" class="mt-2">
              <button @click="retryOne(d)"
                      class="inline-flex items-center gap-1 rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700">
                <ArrowPathIcon class="h-3.5 w-3.5" /> Retry now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :open="deleteOpen" @update:open="(v: boolean) => !v && (deleteTarget = null)"
      title="Delete webhook?" :message="`Permanently remove «${deleteTarget?.name}»? Deliveries in flight will be buried as failed.`"
      confirm-label="Delete" confirm-variant="danger" @confirm="confirmDelete"
    />
  </div>
</template>
