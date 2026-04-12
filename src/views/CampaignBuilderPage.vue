<script setup lang="ts">
/**
 * CampaignBuilderPage — interactive Vue Flow editor for campaign step graphs.
 *
 * Ships:
 *   - Drag to reposition, drag from source handle → target handle to wire
 *   - Palette: click to add Send / Wait / Webhook / Condition nodes
 *   - Properties drawer: click a node, edit its step fields inline
 *   - Delete selected node/edge
 *   - Save: serialize graph → Step[] → PUT /api/campaigns/:id/steps
 *   - Client-side lint: at least one start, no orphans, condition nodes need
 *     both true + false branches wired
 *
 * Deferred (explicitly scoped out — see docs/specs/vue-flow-campaign-builder.md):
 *   - Position persistence on the server. On reload we auto-layout by BFS
 *     depth from start nodes. Your manual positions are forgotten across
 *     reloads. The alternative (adding a `position` field to Step) is
 *     additive to the model and can come later without breaking this build.
 *   - Undo/redo
 *   - Multi-select operations
 */
import { ref, computed, onMounted, markRaw, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VueFlow, useVueFlow, MarkerType, type Connection } from '@vue-flow/core'
// Node / Edge types from @vue-flow/core are deep generics that trip TS's
// recursion limit under the project's strict-mode settings. Everything we
// touch at runtime is shape-stable ({ id, type, position, data }), so we
// use shallow aliases and let the library validate at render time.
type Node = { id: string; type?: string; position: { x: number; y: number }; data: any; [k: string]: any }
type Edge = { id: string; source: string; target: string; sourceHandle?: string | null; [k: string]: any }
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

import PageHeader from '@/components/PageHeader.vue'
import SendNode from '@/components/campaign-builder/SendNode.vue'
import WaitNode from '@/components/campaign-builder/WaitNode.vue'
import WebhookNode from '@/components/campaign-builder/WebhookNode.vue'
import ConditionNode from '@/components/campaign-builder/ConditionNode.vue'
import { fetchCampaignGraph, replaceCampaignSteps, type CampaignGraphNode,
  type CampaignStepPayload } from '@/api/dashboard'
import { useToast } from '@/composables/useToast'
import {
  ArrowLeftIcon, ArrowPathIcon,
  PaperAirplaneIcon, PauseIcon, BoltIcon, ArrowUturnRightIcon,
  TrashIcon, XMarkIcon, PlusIcon,
} from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()

// Register the custom node renderers with Vue Flow. markRaw keeps them out
// of the reactivity system (they're stateless components). The `as any` cast
// is deliberate — Vue Flow's NodeComponent type requires a stricter props
// shape than our custom components declare, but the runtime contract (props
// passed at render: `id` + `data`) is what actually matters and is stable.
const nodeTypes: Record<string, any> = {
  send:      markRaw(SendNode),
  wait:      markRaw(WaitNode),
  webhook:   markRaw(WebhookNode),
  condition: markRaw(ConditionNode),
}

const campaignName = ref<string>('')
const slug = ref<string>('')
const loading = ref(true)
const saving = ref(false)
const dirty = ref(false)

// Graph state. Vue Flow's v-model-style `:nodes` / `:edges` props take reactive
// refs. We manage the shape directly rather than using `useVueFlow().nodes`
// to keep the serialize path trivial.
const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])

const selectedNodeId = ref<string | null>(null)
// Any-typed to dodge deep TS recursion on Node's generic — at runtime the
// shape we care about (id, type, data) is stable.
const selectedNode = computed<any>(() => {
  const id = selectedNodeId.value
  if (!id) return null
  return (nodes.value as any[]).find(n => n.id === id) ?? null
})

// The Vue Flow `useVueFlow` return type is recursively deep enough to trip
// TS 2589 ("Type instantiation is excessively deep") under strict-mode build
// settings. Runtime surface we touch is ~6 stable methods, so silence the
// check on this call specifically rather than widening tsconfig for the
// whole project.
// @ts-ignore — deep generic, runtime-safe
const vf: any = useVueFlow()

// Mark graph dirty whenever nodes or edges mutate. Initial load sets dirty
// back to false after layout settles.
watch([nodes, edges], () => { dirty.value = true }, { deep: true })

let nextId = 1
function newId(prefix: string) { return `${prefix}_${nextId++}` }

// ─────────────────────────────────────────────────────────────────────────
// LOAD: fetch graph → deserialize → auto-layout
// ─────────────────────────────────────────────────────────────────────────

async function load() {
  const id = Number(route.params.id)
  if (!id) return
  loading.value = true
  try {
    const g = await fetchCampaignGraph(id)
    campaignName.value = g.name
    slug.value = g.slug

    // Deserialize. Node type maps from graph.type → our custom types.
    // Action nodes (from backend) become "send" unless they have webhook_url.
    const layouted = layoutBFS(g.nodes, g.edges)
    nodes.value = g.nodes.map((n, idx) => ({
      id: String(n.id),
      type: mapType(n),
      position: layouted[idx] || { x: 400, y: 80 + idx * 140 },
      data: {
        channel:                n.channel,
        template_key:           n.data?.template_key || '',
        delay_minutes:          n.data?.delay_minutes || 0,
        condition:              n.condition || '',
        wait_for_event:         n.data?.wait_for_event || '',
        wait_for_event_timeout: n.data?.wait_for_event_timeout || 0,
        webhook_url:            n.data?.webhook_url || '',
        webhook_method:         n.data?.webhook_method || 'POST',
      },
    }))
    nextId = nodes.value.length + 1

    edges.value = g.edges.map((e, i) => ({
      id: `e${i}_${e.source}_${e.target}`,
      source: String(e.source),
      target: String(e.target),
      sourceHandle: e.label === 'true' || e.label === 'false' ? e.label : undefined,
      label: e.label && e.label !== 'next' ? e.label : '',
      type: 'smoothstep',
      animated: false,
      markerEnd: MarkerType.ArrowClosed,
      style: edgeStyle(e.label || 'next'),
    }))

    // Fit once after paint so the saved structure is fully visible.
    requestAnimationFrame(() => vf.fitView({ padding: 0.2 }))
  } catch {
    showToast('Failed to load campaign graph', 'error')
  } finally {
    loading.value = false
    // initial load: clear dirty after layout settles so Save is disabled
    // until the user actually changes something.
    requestAnimationFrame(() => { dirty.value = false })
  }
}
onMounted(load)

function mapType(n: CampaignGraphNode): 'send' | 'wait' | 'webhook' | 'condition' {
  if (n.type === 'wait') return 'wait'
  if (n.type === 'webhook') return 'webhook'
  if (n.type === 'condition') return 'condition'
  return 'send'
}

function edgeStyle(label: string) {
  switch (label) {
    case 'true':  return { stroke: '#059669', strokeWidth: 2 }
    case 'false': return { stroke: '#dc2626', strokeWidth: 2 }
    default:      return { stroke: '#64748b', strokeWidth: 2 }
  }
}

// Simple BFS layout. Nodes with no incoming edge start at y=80 row. Each
// BFS level goes +160 down. Siblings within a level spread on x centred
// around 420.
function layoutBFS(
  nodesIn: CampaignGraphNode[],
  edgesIn: Array<{ source: number; target: number }>,
): Array<{ x: number; y: number }> {
  const incoming = new Map<number, number[]>()
  const outgoing = new Map<number, number[]>()
  for (const n of nodesIn) { incoming.set(n.id, []); outgoing.set(n.id, []) }
  for (const e of edgesIn) {
    incoming.get(e.target)?.push(e.source)
    outgoing.get(e.source)?.push(e.target)
  }

  const level = new Map<number, number>()
  const queue: number[] = []
  for (const n of nodesIn) {
    if ((incoming.get(n.id) || []).length === 0) {
      level.set(n.id, 0)
      queue.push(n.id)
    }
  }
  while (queue.length) {
    const id = queue.shift()!
    const d = level.get(id)!
    for (const next of (outgoing.get(id) || [])) {
      if (!level.has(next) || (level.get(next) ?? 0) < d + 1) {
        level.set(next, d + 1)
        queue.push(next)
      }
    }
  }
  // Anything still unplaced (disconnected): dump to row 0 at the right.
  for (const n of nodesIn) {
    if (!level.has(n.id)) level.set(n.id, 0)
  }

  // Group by level, assign x by index within level.
  const byLevel = new Map<number, number[]>()
  for (const n of nodesIn) {
    const d = level.get(n.id)!
    if (!byLevel.has(d)) byLevel.set(d, [])
    byLevel.get(d)!.push(n.id)
  }

  const positions = new Map<number, { x: number; y: number }>()
  for (const [d, ids] of byLevel) {
    const spread = Math.max(1, ids.length)
    ids.forEach((id, i) => {
      const x = 420 + (i - (spread - 1) / 2) * 300
      positions.set(id, { x, y: 80 + d * 160 })
    })
  }
  return nodesIn.map(n => positions.get(n.id)!)
}

// ─────────────────────────────────────────────────────────────────────────
// EDITING: add / delete / connect
// ─────────────────────────────────────────────────────────────────────────

function addNode(type: 'send' | 'wait' | 'webhook' | 'condition') {
  const id = newId(type)
  const data: Record<string, unknown> =
    type === 'send'      ? { channel: 'email', template_key: '', delay_minutes: 0 } :
    type === 'wait'      ? { wait_for_event: '', wait_for_event_timeout: 60, delay_minutes: 0 } :
    type === 'webhook'   ? { webhook_url: '', webhook_method: 'POST' } :
                           { condition: 'always_true' }
  // Place below the current crop of nodes so new items don't stack on top
  // of existing ones.
  const maxY = nodes.value.reduce((m, n) => Math.max(m, n.position.y), 0)
  nodes.value.push({
    id, type,
    position: { x: 420 + Math.random() * 80 - 40, y: maxY + 160 },
    data,
  })
  selectedNodeId.value = id
}

function deleteSelected() {
  if (!selectedNodeId.value) return
  vf.removeNodes([selectedNodeId.value])
  selectedNodeId.value = null
}

// Wire an edge from a drag-connect. Vue Flow hands us the connection; we
// style by source handle id and append.
vf.onConnect((params: Connection) => {
  const label = params.sourceHandle === 'true' || params.sourceHandle === 'false'
    ? params.sourceHandle : 'next'
  vf.addEdges([{
    id: `e_${params.source}_${params.target}_${params.sourceHandle || 'n'}_${Date.now()}`,
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle,
    label: label === 'next' ? '' : label,
    type: 'smoothstep',
    markerEnd: MarkerType.ArrowClosed,
    style: edgeStyle(label),
  }])
})

vf.onNodeClick((evt: any) => { selectedNodeId.value = evt.node.id })
vf.onPaneClick(() => { selectedNodeId.value = null })

// ─────────────────────────────────────────────────────────────────────────
// PROPERTIES DRAWER — bindings are keyed by node type
// ─────────────────────────────────────────────────────────────────────────

function updateSelectedData(patch: Record<string, unknown>) {
  if (!selectedNode.value) return
  selectedNode.value.data = { ...selectedNode.value.data, ...patch }
}

// ─────────────────────────────────────────────────────────────────────────
// LINT + SAVE
// ─────────────────────────────────────────────────────────────────────────

interface LintIssue { nodeId?: string; message: string }

function lint(): LintIssue[] {
  const issues: LintIssue[] = []
  if (nodes.value.length === 0) {
    issues.push({ message: 'Campaign has no steps — add at least one Send node.' })
    return issues
  }
  const starts = nodes.value.filter(n => !edges.value.some(e => e.target === n.id))
  if (starts.length === 0) issues.push({ message: 'No start node — every edge has an incoming edge, so the flow is a cycle with no entry.' })
  if (starts.length > 1)  issues.push({ message: `${starts.length} start nodes — only the first will execute.` })

  for (const n of nodes.value) {
    const outs = edges.value.filter(e => e.source === n.id)
    if (n.type === 'condition') {
      const hasTrue  = outs.some(e => e.sourceHandle === 'true')
      const hasFalse = outs.some(e => e.sourceHandle === 'false')
      if (!hasTrue || !hasFalse) {
        issues.push({ nodeId: n.id, message: 'Condition missing ' + (!hasTrue ? 'true' : 'false') + ' branch.' })
      }
    } else if (n.type === 'send' && !n.data.template_key) {
      issues.push({ nodeId: n.id, message: 'Send node missing template_key.' })
    } else if (n.type === 'webhook' && !n.data.webhook_url) {
      issues.push({ nodeId: n.id, message: 'Webhook node missing URL.' })
    }
  }
  return issues
}

const lintIssues = computed(() => lint())

// Convert the Vue Flow graph back to Step[] in BFS order from start node.
// Array index = step index. TrueNext/FalseNext encode edge targets by that
// index so the backend's existing branching semantics apply unchanged.
function serialize(): { steps: CampaignStepPayload[]; error?: string } {
  if (nodes.value.length === 0) return { steps: [], error: 'empty' }
  const starts = nodes.value.filter(n => !edges.value.some(e => e.target === n.id))
  const firstStart = starts[0]
  if (!firstStart) return { steps: [], error: 'no start node (cycle with no entry)' }

  // BFS from the first start, but ensure we visit every reachable node.
  // Unreachable nodes are appended at the end so the user doesn't silently
  // lose them on save (they'll just be dead code downstream).
  const order: string[] = []
  const seen = new Set<string>()
  const queue: string[] = [firstStart.id]
  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id); order.push(id)
    for (const e of edges.value.filter(e => e.source === id)) {
      if (!seen.has(e.target)) queue.push(e.target)
    }
  }
  for (const n of nodes.value) if (!seen.has(n.id)) order.push(n.id)

  const indexOf = new Map(order.map((id, i) => [id, i]))

  const steps: CampaignStepPayload[] = order.map((id) => {
    const n = nodes.value.find(n => n.id === id)!
    const outs = edges.value.filter(e => e.source === id)

    const step: CampaignStepPayload = {
      delay_minutes: Number(n.data.delay_minutes) || 0,
      channel:       String(n.data.channel || ''),
      template_key:  String(n.data.template_key || ''),
      condition:     String(n.data.condition || ''),
    }

    if (n.type === 'wait') {
      step.wait_for_event         = String(n.data.wait_for_event || '')
      step.wait_for_event_timeout = Number(n.data.wait_for_event_timeout) || 0
      step.channel = step.channel || 'wait'
    } else if (n.type === 'webhook') {
      step.webhook_url    = String(n.data.webhook_url || '')
      step.webhook_method = String(n.data.webhook_method || 'POST')
      step.channel = step.channel || 'webhook'
    }

    if (n.type === 'condition') {
      const trueEdge  = outs.find(e => e.sourceHandle === 'true')
      const falseEdge = outs.find(e => e.sourceHandle === 'false')
      step.true_next  = trueEdge  ? (indexOf.get(trueEdge.target)  ?? -1) : -1
      step.false_next = falseEdge ? (indexOf.get(falseEdge.target) ?? -1) : -1
      step.condition = step.condition || 'always_true'
      step.channel = step.channel || 'noop'
    } else {
      // Action nodes: encode sequential flow explicitly. `true_next` is the
      // generic "next" pointer in the model — `override sequential
      // advancement` — and lets the visual graph represent arbitrary jumps
      // without depending on array-order accidents.
      const nextEdge = outs[0]
      step.true_next = nextEdge ? (indexOf.get(nextEdge.target) ?? -1) : -1
      step.condition = step.condition || 'always_true'
    }
    return step
  })
  return { steps }
}

async function save() {
  const issues = lintIssues.value
  if (issues.length) {
    showToast(`Fix ${issues.length} issue${issues.length === 1 ? '' : 's'} before saving`, 'error')
    return
  }
  const { steps, error } = serialize()
  if (error) { showToast(error, 'error'); return }
  const id = Number(route.params.id)
  saving.value = true
  try {
    await replaceCampaignSteps(id, steps)
    showToast('Campaign steps saved', 'success')
    dirty.value = false
  } catch (e: any) {
    showToast(e?.response?.data?.error || 'Save failed', 'error')
  } finally {
    saving.value = false
  }
}

function channelOptions() { return ['email', 'sms', 'whatsapp', 'push', 'onsite'] }
</script>

<template>
  <div class="flex h-screen flex-col bg-neutral-50 dark:bg-neutral-950">
    <PageHeader :title="campaignName || 'Campaign builder'" :subtitle="slug ? `#${slug}` : ''">
      <template #actions>
        <span v-if="dirty" class="text-xs text-amber-700 dark:text-amber-400">● unsaved</span>
        <button @click="router.push(`/campaigns/${route.params.id}/edit`)"
                class="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
          <ArrowLeftIcon class="h-4 w-4" /> List editor
        </button>
        <button @click="save" :disabled="saving || !dirty"
                class="inline-flex items-center gap-2 rounded-md bg-ma-accent px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-ma-accent-hover disabled:opacity-50">
          <ArrowPathIcon v-if="saving" class="h-4 w-4 animate-spin" />
          Save
        </button>
      </template>
    </PageHeader>

    <div class="flex flex-1 min-h-0">
      <!-- Palette -->
      <aside class="w-48 flex-shrink-0 border-r border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 class="mb-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Add step</h3>
        <div class="space-y-2">
          <button @click="addNode('send')"
                  class="flex w-full items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <PaperAirplaneIcon class="h-4 w-4" /> Send
          </button>
          <button @click="addNode('wait')"
                  class="flex w-full items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <PauseIcon class="h-4 w-4" /> Wait
          </button>
          <button @click="addNode('condition')"
                  class="flex w-full items-center gap-2 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-900 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
            <ArrowUturnRightIcon class="h-4 w-4" /> If / else
          </button>
          <button @click="addNode('webhook')"
                  class="flex w-full items-center gap-2 rounded-md border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-900 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
            <BoltIcon class="h-4 w-4" /> Webhook
          </button>
        </div>

        <h3 class="mb-2 mt-6 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Issues</h3>
        <div v-if="lintIssues.length === 0" class="text-[11px] text-emerald-700 dark:text-emerald-400">✓ looks good</div>
        <ul v-else class="space-y-1 text-[11px] text-rose-700 dark:text-rose-400">
          <li v-for="(i, idx) in lintIssues" :key="idx"
              class="cursor-pointer hover:underline"
              @click="i.nodeId && (selectedNodeId = i.nodeId)">
            • {{ i.message }}
          </li>
        </ul>
      </aside>

      <!-- Canvas -->
      <div class="relative flex-1 min-w-0" style="background: var(--color-bg-page, #fafafa)">
        <VueFlow
          :nodes="nodes"
          :edges="edges"
          :node-types="nodeTypes"
          :fit-view-on-init="true"
          :default-viewport="{ x: 0, y: 0, zoom: 0.9 }"
          :min-zoom="0.25"
          :max-zoom="2"
        >
          <Background pattern-color="#cbd5e1" :gap="20" />
          <Controls />
          <MiniMap pannable zoomable />
        </VueFlow>

        <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-neutral-900/70">
          <span class="text-sm text-neutral-500">Loading flow…</span>
        </div>
      </div>

      <!-- Properties drawer -->
      <aside v-if="selectedNode" class="w-80 flex-shrink-0 overflow-y-auto border-l border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-sm font-semibold">Properties</h3>
          <div class="flex gap-1">
            <button @click="deleteSelected" class="rounded p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40" title="Delete node">
              <TrashIcon class="h-4 w-4" />
            </button>
            <button @click="selectedNodeId = null" class="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <XMarkIcon class="h-4 w-4" />
            </button>
          </div>
        </div>

        <div class="space-y-3 text-sm">
          <div class="rounded bg-neutral-50 p-2 text-[11px] dark:bg-neutral-800">
            <span class="font-mono text-neutral-500">{{ selectedNode.type }}</span>
            <span class="ml-2 font-mono">#{{ selectedNode.id }}</span>
          </div>

          <template v-if="selectedNode.type === 'send'">
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Channel</label>
              <select :value="selectedNode.data.channel" @change="updateSelectedData({ channel: ($event.target as HTMLSelectElement).value })"
                      class="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800">
                <option v-for="c in channelOptions()" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Template key</label>
              <input :value="selectedNode.data.template_key" @input="updateSelectedData({ template_key: ($event.target as HTMLInputElement).value })"
                     placeholder="welcome_email"
                     class="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-800" />
            </div>
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Delay (minutes)</label>
              <input type="number" min="0" :value="selectedNode.data.delay_minutes" @input="updateSelectedData({ delay_minutes: Number(($event.target as HTMLInputElement).value) })"
                     class="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800" />
            </div>
          </template>

          <template v-else-if="selectedNode.type === 'wait'">
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Wait for event</label>
              <input :value="selectedNode.data.wait_for_event" @input="updateSelectedData({ wait_for_event: ($event.target as HTMLInputElement).value })"
                     placeholder="order_placed"
                     class="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-800" />
              <p class="mt-1 text-[10px] text-neutral-500">Leave blank for a pure time delay.</p>
            </div>
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Timeout (minutes)</label>
              <input type="number" min="0" :value="selectedNode.data.wait_for_event_timeout" @input="updateSelectedData({ wait_for_event_timeout: Number(($event.target as HTMLInputElement).value) })"
                     class="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800" />
              <p class="mt-1 text-[10px] text-neutral-500">0 = wait forever.</p>
            </div>
          </template>

          <template v-else-if="selectedNode.type === 'condition'">
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Condition expression</label>
              <input :value="selectedNode.data.condition" @input="updateSelectedData({ condition: ($event.target as HTMLInputElement).value })"
                     placeholder="event.opened == true"
                     class="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-800" />
              <p class="mt-1 text-[10px] text-neutral-500">Wire the true and false handles below the node to their respective follow-ups.</p>
            </div>
          </template>

          <template v-else-if="selectedNode.type === 'webhook'">
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">URL</label>
              <input :value="selectedNode.data.webhook_url" @input="updateSelectedData({ webhook_url: ($event.target as HTMLInputElement).value })"
                     placeholder="https://api.example.com/hook"
                     class="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-800" />
            </div>
            <div>
              <label class="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Method</label>
              <select :value="selectedNode.data.webhook_method" @change="updateSelectedData({ webhook_method: ($event.target as HTMLSelectElement).value })"
                      class="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800">
                <option>POST</option><option>PUT</option><option>PATCH</option>
              </select>
            </div>
          </template>
        </div>

        <p class="mt-6 text-[10px] text-neutral-500">
          Drag from the blue dot at a node's bottom to the blue dot at another node's top to wire the flow.
          Condition nodes have two bottom dots — green for <em>true</em>, red for <em>false</em>.
        </p>
      </aside>
    </div>
  </div>
</template>

<style>
.vue-flow__panel { font-family: inherit; }
.vue-flow__minimap { background: rgba(255,255,255,0.85); border-radius: 6px; }
.dark .vue-flow__minimap { background: rgba(23,23,23,0.85); }
</style>
