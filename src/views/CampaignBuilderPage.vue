<script setup lang="ts">
/**
 * CampaignBuilderPage — visual flow diagram of a campaign's steps.
 *
 * Scope for this iteration: READ-ONLY viewer. Editing the graph (drag-to-add
 * nodes, rewire edges, persist positions) is tracked under the Vue Flow
 * builder spec at docs/specs/vue-flow-campaign-builder.md. The intent here
 * is to give operators a useful spatial mental model of their campaign
 * *today* without pulling in a new frontend dependency — the existing list
 * editor remains the source of truth for changes.
 *
 * Layout algorithm: deliberately simple. Nodes stack vertically at x=center,
 * y=index*stride. Branch targets shown by arrow label ("true"/"false"); a
 * backward jump (target index < source index) bends right so it's obvious
 * it's a loop/revisit rather than a sibling forward edge.
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import { fetchCampaignGraph, type CampaignGraph, type CampaignGraphNode } from '@/api/dashboard'
import { useToast } from '@/composables/useToast'
import {
  ArrowLeftIcon, PaperAirplaneIcon, PauseIcon, BoltIcon,
  ArrowsPointingOutIcon, ArrowsPointingInIcon, ArrowUturnLeftIcon,
} from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()

const graph = ref<CampaignGraph | null>(null)
const loading = ref(true)

// Viewport transform — pan via drag, zoom via buttons or wheel.
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const dragging = ref(false)
let dragStart = { x: 0, y: 0, panX: 0, panY: 0 }

// Node layout constants.
const NODE_W = 260
const NODE_H = 88
const V_STRIDE = 150 // vertical spacing
const CANVAS_W = 800

async function load() {
  const id = Number(route.params.id)
  if (!id) return
  loading.value = true
  try {
    graph.value = await fetchCampaignGraph(id)
  } catch {
    showToast('Failed to load campaign graph', 'error')
  } finally {
    loading.value = false
  }
}
onMounted(load)

interface PlacedNode extends CampaignGraphNode {
  x: number
  y: number
}

// Position nodes. One-column layout by index. Branch "false" targets get a
// slight x-offset hint so split arrows don't overlap straight-through edges.
const placedNodes = computed<PlacedNode[]>(() => {
  if (!graph.value) return []
  return graph.value.nodes.map((n, i) => ({
    ...n,
    x: CANVAS_W / 2 - NODE_W / 2,
    y: 40 + i * V_STRIDE,
  }))
})

const canvasHeight = computed(() => {
  return Math.max(400, 40 + placedNodes.value.length * V_STRIDE + NODE_H)
})

// Resolve edge endpoints into concrete pixel coords + path classification.
interface PlacedEdge {
  key: string
  from: { x: number; y: number }
  to:   { x: number; y: number }
  label: string
  kind: 'next' | 'true' | 'false' | 'loop'
  path: string
}

const placedEdges = computed<PlacedEdge[]>(() => {
  if (!graph.value) return []
  const byId = new Map(placedNodes.value.map(n => [n.id, n]))
  const out: PlacedEdge[] = []
  for (const e of graph.value.edges) {
    const from = byId.get(e.source)
    const to = byId.get(e.target)
    if (!from || !to) continue

    const backwards = e.target <= e.source
    const kind: PlacedEdge['kind'] = backwards
      ? 'loop'
      : (e.label === 'true' || e.label === 'false' ? e.label : 'next')

    const fx = from.x + NODE_W / 2
    const fy = from.y + NODE_H
    const tx = to.x + NODE_W / 2
    const ty = to.y

    let path: string
    if (backwards) {
      // Arc out to the right, loop up, come back in from the top-right.
      const offset = 120
      path = `M ${fx} ${fy}
              C ${fx + offset} ${fy}, ${tx + offset} ${ty}, ${tx} ${ty}`
    } else if (kind === 'true') {
      // Bend slightly left on true.
      const mid = (fy + ty) / 2
      path = `M ${fx} ${fy} C ${fx - 40} ${mid}, ${tx - 40} ${mid}, ${tx} ${ty}`
    } else if (kind === 'false') {
      const mid = (fy + ty) / 2
      path = `M ${fx} ${fy} C ${fx + 40} ${mid}, ${tx + 40} ${mid}, ${tx} ${ty}`
    } else {
      path = `M ${fx} ${fy} L ${tx} ${ty}`
    }

    out.push({
      key: `${e.source}->${e.target}:${e.label || ''}`,
      from: { x: fx, y: fy },
      to:   { x: tx, y: ty },
      label: e.label || '',
      kind,
      path,
    })
  }
  return out
})

function nodeIcon(n: CampaignGraphNode) {
  switch (n.type) {
    case 'wait':     return PauseIcon
    case 'webhook':  return BoltIcon
    case 'condition':return ArrowUturnLeftIcon // reused as branch-y visual
    default:         return PaperAirplaneIcon
  }
}

function nodeAccent(n: CampaignGraphNode): string {
  switch (n.type) {
    case 'wait':     return 'border-amber-400 bg-amber-50 dark:bg-amber-950/40'
    case 'webhook':  return 'border-violet-400 bg-violet-50 dark:bg-violet-950/40'
    case 'condition':return 'border-sky-400 bg-sky-50 dark:bg-sky-950/40'
    default:         return 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
  }
}

function channelChip(n: CampaignGraphNode): string {
  const ch = (n.channel || '').toLowerCase()
  if (!ch) return 'bg-neutral-200 text-neutral-700'
  const colors: Record<string, string> = {
    email:    'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
    sms:      'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
    whatsapp: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
    push:     'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200',
    onsite:   'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/50 dark:text-fuchsia-200',
  }
  return colors[ch] || 'bg-neutral-200 text-neutral-700'
}

function subtitle(n: CampaignGraphNode): string {
  const d = n.data || {}
  const bits: string[] = []
  if (d.delay_minutes) bits.push(`+${d.delay_minutes}m`)
  if (d.template_key) bits.push(String(d.template_key))
  if (d.wait_for_event) bits.push(`wait: ${d.wait_for_event}`)
  if (d.webhook_url) {
    try { bits.push(new URL(String(d.webhook_url)).hostname) }
    catch { bits.push(String(d.webhook_url)) }
  }
  return bits.join(' · ')
}

// Pan + zoom handlers. Mouse-drag to pan on the background (not nodes).
function onBgMouseDown(e: MouseEvent) {
  dragging.value = true
  dragStart = { x: e.clientX, y: e.clientY, panX: panX.value, panY: panY.value }
}
function onMouseMove(e: MouseEvent) {
  if (!dragging.value) return
  panX.value = dragStart.panX + (e.clientX - dragStart.x)
  panY.value = dragStart.panY + (e.clientY - dragStart.y)
}
function onMouseUp() {
  dragging.value = false
}
function onWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY < 0 ? 1.1 : 1 / 1.1
  zoom.value = Math.min(2, Math.max(0.3, zoom.value * delta))
}
function zoomIn()  { zoom.value = Math.min(2, zoom.value * 1.2) }
function zoomOut() { zoom.value = Math.max(0.3, zoom.value / 1.2) }
function reset()   { zoom.value = 1; panX.value = 0; panY.value = 0 }

const transform = computed(() => `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`)
</script>

<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-neutral-950">
    <PageHeader :title="graph?.name || 'Campaign flow'" :subtitle="graph ? `#${graph.slug} · ${graph.nodes.length} step${graph.nodes.length === 1 ? '' : 's'}` : ''">
      <template #actions>
        <button @click="router.push(`/campaigns/${route.params.id}/edit`)"
                class="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
          <ArrowLeftIcon class="h-4 w-4" /> Back to editor
        </button>
      </template>
    </PageHeader>

    <div class="mx-auto max-w-7xl px-4 pb-8">
      <!-- Banner: this is a read-only viewer. Full edit mode is the Vue Flow
           builder tracked in the deferred spec. -->
      <div class="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        <strong>Preview.</strong> Visual flow of the campaign as configured today. Editing
        (drag to rearrange, add branches, persist positions) lands in the next
        iteration of the builder — use <router-link :to="`/campaigns/${route.params.id}/edit`" class="underline font-medium">the step editor</router-link>
        to modify for now.
      </div>

      <div class="relative overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
           :style="{ height: '70vh' }"
           @mousemove="onMouseMove" @mouseup="onMouseUp" @mouseleave="onMouseUp" @wheel.prevent="onWheel">

        <!-- Zoom controls -->
        <div class="absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-md border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
          <button @click="zoomIn" class="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700" title="Zoom in">
            <ArrowsPointingOutIcon class="h-4 w-4" />
          </button>
          <button @click="zoomOut" class="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700" title="Zoom out">
            <ArrowsPointingInIcon class="h-4 w-4" />
          </button>
          <button @click="reset" class="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-xs" title="Reset">1:1</button>
        </div>

        <!-- Background grid + draggable surface -->
        <div class="absolute inset-0 cursor-grab" :class="{ 'cursor-grabbing': dragging }"
             @mousedown="onBgMouseDown"
             style="background-image:
               radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px);
               background-size: 24px 24px;">

          <div class="absolute left-0 top-0 origin-top-left" :style="{ transform }">
            <svg :width="CANVAS_W" :height="canvasHeight" class="pointer-events-none select-none">
              <!-- Arrowhead defs -->
              <defs>
                <marker id="arrow-next" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
                </marker>
                <marker id="arrow-true" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#059669" />
                </marker>
                <marker id="arrow-false" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
                </marker>
                <marker id="arrow-loop" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#9333ea" />
                </marker>
              </defs>

              <!-- Edges -->
              <g v-for="e in placedEdges" :key="e.key">
                <path :d="e.path"
                      :stroke="{
                        next:  '#64748b',
                        true:  '#059669',
                        false: '#dc2626',
                        loop:  '#9333ea',
                      }[e.kind]"
                      stroke-width="2"
                      fill="none"
                      :stroke-dasharray="e.kind === 'loop' ? '6 4' : ''"
                      :marker-end="`url(#arrow-${e.kind})`" />
                <text v-if="e.label && e.label !== 'next'"
                      :x="(e.from.x + e.to.x) / 2"
                      :y="(e.from.y + e.to.y) / 2 - 6"
                      text-anchor="middle"
                      class="fill-current font-mono text-[10px] uppercase"
                      :style="{ fill: { true: '#059669', false: '#dc2626', loop: '#9333ea' }[e.kind] || '#64748b' }">
                  {{ e.label }}
                </text>
              </g>
            </svg>

            <!-- Nodes: absolutely positioned divs overlayed on the SVG -->
            <div v-for="n in placedNodes" :key="n.id"
                 class="absolute rounded-lg border-2 shadow-sm transition-shadow hover:shadow-md"
                 :class="nodeAccent(n)"
                 :style="{ left: n.x + 'px', top: n.y + 'px', width: NODE_W + 'px', height: NODE_H + 'px' }">
              <div class="flex h-full items-start gap-3 p-3">
                <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-white shadow-sm dark:bg-neutral-800">
                  <component :is="nodeIcon(n)" class="h-4 w-4" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-mono opacity-60">#{{ n.id }}</span>
                    <span v-if="n.channel" class="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase" :class="channelChip(n)">
                      {{ n.channel }}
                    </span>
                    <span v-if="n.type === 'wait'" class="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-900">wait</span>
                    <span v-if="n.type === 'webhook'" class="rounded bg-violet-200 px-1.5 py-0.5 text-[10px] font-medium uppercase text-violet-900">webhook</span>
                  </div>
                  <div class="mt-1 truncate text-xs font-mono text-neutral-700 dark:text-neutral-300">
                    {{ subtitle(n) || '—' }}
                  </div>
                  <div v-if="n.condition && n.condition !== 'always_true'" class="mt-0.5 truncate text-[10px] text-neutral-500">
                    if {{ n.condition }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-neutral-900/80">
          <span class="text-sm text-neutral-500">Loading flow…</span>
        </div>
        <div v-else-if="graph && graph.nodes.length === 0" class="absolute inset-0 flex items-center justify-center">
          <p class="text-sm text-neutral-500">This campaign has no steps yet.</p>
        </div>
      </div>

      <!-- Legend -->
      <div class="mt-4 flex flex-wrap items-center gap-4 text-xs text-neutral-600 dark:text-neutral-400">
        <div class="flex items-center gap-1.5"><span class="h-2 w-6 rounded" style="background:#64748b"></span>next</div>
        <div class="flex items-center gap-1.5"><span class="h-2 w-6 rounded" style="background:#059669"></span>true</div>
        <div class="flex items-center gap-1.5"><span class="h-2 w-6 rounded" style="background:#dc2626"></span>false</div>
        <div class="flex items-center gap-1.5"><span class="h-2 w-6 rounded border-t-2 border-dashed" style="border-color:#9333ea;background:transparent"></span>loop / revisit</div>
        <span class="ml-auto text-[11px] opacity-60">Drag to pan · scroll to zoom</span>
      </div>
    </div>
  </div>
</template>
