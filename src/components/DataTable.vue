<script setup lang="ts" generic="T extends Record<string, any>">
// Reusable table surface. Replaces the per-page `<table>` markup and
// the duplicated skeleton/empty/error/pagination plumbing from
// UsersPage, LogsPage, EnrollmentsPage, AuditLogsPage, ConsentsPage and
// PushAudiencePage. Sort-state, page-state and selection are all
// v-modeled so each page can mirror them into its own API params (or
// let DataTable manage it client-side via defaults).

import { computed, ref, watch, getCurrentInstance } from 'vue'
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/vue/24/outline'
import SkeletonTable from './SkeletonTable.vue'
import EmptyState from './EmptyState.vue'
import ErrorState from './ErrorState.vue'
import { usePreferencesStore } from '@/stores/preferences'

export interface Column {
  key: string
  label: string
  sortable?: boolean
  width?: string
  align?: 'left' | 'right' | 'center'
}

type SortDir = 'asc' | 'desc' | null
type RowId = string | number

const props = withDefaults(defineProps<{
  columns: Column[]
  rows: T[]
  loading?: boolean
  error?: string
  emptyTitle?: string
  emptyDescription?: string
  rowKey: string
  sortable?: boolean
  selectable?: boolean
  paginated?: boolean
  total?: number
  pageSizes?: number[]
  stickyFirstColumn?: boolean
  // v-model passthroughs
  sortKey?: string | null
  sortDir?: SortDir
  selected?: RowId[]
  page?: number
  pageSize?: number
}>(), {
  loading: false,
  error: '',
  emptyTitle: 'No data',
  emptyDescription: '',
  sortable: false,
  selectable: false,
  paginated: false,
  pageSizes: () => [25, 50, 100],
  stickyFirstColumn: false,
  sortKey: null,
  sortDir: null,
  selected: () => [],
  page: 1,
  pageSize: undefined,
})

const emit = defineEmits<{
  (e: 'update:sortKey', v: string | null): void
  (e: 'update:sortDir', v: SortDir): void
  (e: 'update:selected', v: RowId[]): void
  (e: 'update:page', v: number): void
  (e: 'update:pageSize', v: number): void
  (e: 'sort', v: { key: string; dir: SortDir }): void
  (e: 'row-click', row: T): void
  (e: 'retry'): void
}>()

const prefs = usePreferencesStore()

// Local mirrors for uncontrolled usage
const localSortKey = ref<string | null>(props.sortKey)
const localSortDir = ref<SortDir>(props.sortDir)
const localSelected = ref<RowId[]>([...props.selected])
const localPage = ref<number>(props.page)
const localPageSize = ref<number>(props.pageSize ?? prefs.pageSize)

watch(() => props.sortKey, v => { localSortKey.value = v })
watch(() => props.sortDir, v => { localSortDir.value = v })
watch(() => props.selected, v => { localSelected.value = [...v] }, { deep: true })
watch(() => props.page, v => { localPage.value = v })
watch(() => props.pageSize, v => { if (v != null) localPageSize.value = v })

const effectiveTotal = computed(() => props.total ?? props.rows.length)
const showStart = computed(() => {
  if (!props.rows.length) return 0
  return (localPage.value - 1) * localPageSize.value + 1
})
const showEnd = computed(() => {
  return Math.min(localPage.value * localPageSize.value, effectiveTotal.value)
})
const totalPages = computed(() => Math.max(1, Math.ceil(effectiveTotal.value / localPageSize.value)))

// Sort handling
function onHeaderClick(col: Column) {
  if (!props.sortable || !col.sortable) return
  let nextDir: SortDir
  if (localSortKey.value !== col.key) {
    nextDir = 'asc'
  } else if (localSortDir.value === 'asc') {
    nextDir = 'desc'
  } else if (localSortDir.value === 'desc') {
    nextDir = null
  } else {
    nextDir = 'asc'
  }
  const nextKey = nextDir === null ? null : col.key
  localSortKey.value = nextKey
  localSortDir.value = nextDir
  emit('update:sortKey', nextKey)
  emit('update:sortDir', nextDir)
  emit('sort', { key: col.key, dir: nextDir })
}

// Selection (shift-click extends from last anchor)
const lastAnchor = ref<number | null>(null)

function rowId(row: T): RowId {
  return row[props.rowKey]
}

const selectedSet = computed(() => new Set(localSelected.value))

const allVisibleSelected = computed(() => {
  if (!props.rows.length) return false
  return props.rows.every(r => selectedSet.value.has(rowId(r)))
})

function commitSelection(next: RowId[]) {
  localSelected.value = next
  emit('update:selected', next)
}

function toggleAllVisible() {
  if (allVisibleSelected.value) {
    const visibleIds = new Set(props.rows.map(rowId))
    commitSelection(localSelected.value.filter(id => !visibleIds.has(id)))
  } else {
    const merged = new Set(localSelected.value)
    for (const r of props.rows) merged.add(rowId(r))
    commitSelection(Array.from(merged))
  }
}

function onRowCheckbox(row: T, index: number, ev: MouseEvent | KeyboardEvent) {
  const id = rowId(row)
  const isShift = (ev as MouseEvent).shiftKey
  if (isShift && lastAnchor.value != null) {
    const sorted = [lastAnchor.value, index].sort((x, y) => x - y)
    const a = sorted[0] as number
    const b = sorted[1] as number
    const rangeIds = props.rows.slice(a, b + 1).map(rowId)
    const merged = new Set(localSelected.value)
    // decide desired state based on current row's state at click time
    const turningOn = !selectedSet.value.has(id)
    for (const rid of rangeIds) {
      if (turningOn) merged.add(rid); else merged.delete(rid)
    }
    commitSelection(Array.from(merged))
  } else {
    const merged = new Set(localSelected.value)
    if (merged.has(id)) merged.delete(id); else merged.add(id)
    commitSelection(Array.from(merged))
  }
  lastAnchor.value = index
}

// Pagination
function setPage(p: number) {
  const clamped = Math.max(1, Math.min(totalPages.value, p))
  localPage.value = clamped
  emit('update:page', clamped)
}
function setPageSize(s: number) {
  localPageSize.value = s
  prefs.setPageSize(s)
  emit('update:pageSize', s)
  // Reset to first page since offsets shift under the new size.
  setPage(1)
}

const _instance = getCurrentInstance()
const hasRowClickListener = computed(() => {
  return !!(_instance?.vnode?.props as any)?.onRowClick
})
</script>

<template>
  <div class="data-table-wrap">
    <!-- Filters / actions above the table -->
    <div v-if="$slots.actions" class="data-table-actions">
      <slot name="actions" />
    </div>

    <!-- Bulk-action bar (slides in when rows selected) -->
    <Transition name="bulk-bar">
      <div
        v-if="selectable && localSelected.length > 0 && $slots['bulk-actions']"
        class="data-table-bulk-bar"
      >
        <span class="data-table-bulk-count">{{ localSelected.length }} selected</span>
        <slot name="bulk-actions" :selected="localSelected" />
      </div>
    </Transition>

    <!-- Loading -->
    <SkeletonTable v-if="loading" :rows="6" :columns="columns.length" />

    <!-- Error -->
    <ErrorState
      v-else-if="error"
      :message="error"
      retryable
      @retry="$emit('retry')"
    />

    <!-- Empty -->
    <EmptyState
      v-else-if="!rows.length"
      :title="emptyTitle"
      :description="emptyDescription"
    />

    <!-- Real table -->
    <div v-else class="data-table-surface">
      <div class="data-table-scroll" :class="{ 'sticky-first-col': stickyFirstColumn }">
        <table class="data-table">
          <thead>
            <tr>
              <th v-if="selectable" class="data-table-check-cell">
                <input
                  type="checkbox"
                  :checked="allVisibleSelected"
                  @change="toggleAllVisible"
                  class="data-table-checkbox"
                  aria-label="Select all visible rows"
                />
              </th>
              <th
                v-for="col in columns"
                :key="col.key"
                :class="[
                  'data-table-th',
                  `align-${col.align || 'left'}`,
                  { 'is-sortable': sortable && col.sortable },
                ]"
                :style="col.width ? { width: col.width } : undefined"
                @click="onHeaderClick(col)"
              >
                <span class="data-table-th-inner">
                  {{ col.label }}
                  <span
                    v-if="sortable && col.sortable"
                    class="data-table-sort-ind"
                    :class="{
                      'is-asc': localSortKey === col.key && localSortDir === 'asc',
                      'is-desc': localSortKey === col.key && localSortDir === 'desc',
                    }"
                  >
                    <ChevronUpIcon class="sort-chev sort-up" />
                    <ChevronDownIcon class="sort-chev sort-down" />
                  </span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, idx) in rows"
              :key="row[rowKey]"
              :class="[
                'data-table-row',
                { 'is-clickable': hasRowClickListener, 'is-selected': selectable && selectedSet.has(row[rowKey]) },
              ]"
              @click="hasRowClickListener ? $emit('row-click', row) : undefined"
            >
              <td v-if="selectable" class="data-table-check-cell" @click.stop>
                <input
                  type="checkbox"
                  :checked="selectedSet.has(row[rowKey])"
                  class="data-table-checkbox"
                  :aria-label="`Select row ${row[rowKey]}`"
                  @click="(e) => onRowCheckbox(row, idx, e as MouseEvent)"
                />
              </td>
              <td
                v-for="col in columns"
                :key="col.key"
                :class="['data-table-td', `align-${col.align || 'left'}`]"
              >
                <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
                  {{ row[col.key] ?? '—' }}
                </slot>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="paginated" class="data-table-footer">
        <div class="data-table-footer-left">
          <label class="data-table-pagesize-label">Rows per page</label>
          <select
            class="form-select data-table-pagesize"
            :value="localPageSize"
            @change="(e) => setPageSize(Number((e.target as HTMLSelectElement).value))"
          >
            <option v-for="s in pageSizes" :key="s" :value="s">{{ s }}</option>
          </select>
          <span class="data-table-footer-range">
            Showing {{ showStart }}–{{ showEnd }} of {{ effectiveTotal }}
          </span>
        </div>
        <div class="data-table-footer-right">
          <button
            class="btn btn-ghost btn-sm"
            :disabled="localPage <= 1"
            @click="setPage(localPage - 1)"
          >Prev</button>
          <span class="data-table-page-indicator">Page {{ localPage }} / {{ totalPages }}</span>
          <button
            class="btn btn-ghost btn-sm"
            :disabled="localPage >= totalPages"
            @click="setPage(localPage + 1)"
          >Next</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.data-table-wrap { display: flex; flex-direction: column; gap: var(--space-4); }
.data-table-actions { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: flex-end; }

.data-table-bulk-bar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 10px 16px;
  background: var(--color-primary-light);
  border: 1px solid var(--color-primary-border);
  border-radius: var(--radius-md);
  color: var(--color-primary-text);
  font-size: 13px;
}
.data-table-bulk-count { font-weight: 600; }

.bulk-bar-enter-active, .bulk-bar-leave-active {
  transition: transform 180ms ease, opacity 180ms ease;
}
.bulk-bar-enter-from, .bulk-bar-leave-to {
  opacity: 0; transform: translateY(-6px);
}

.data-table-surface {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.data-table-scroll { overflow-x: auto; }
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.data-table thead {
  background: var(--color-bg-table-header);
}
.data-table-th {
  padding: 10px 16px;
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
  color: var(--color-text-tertiary);
  user-select: none;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}
.data-table-th.is-sortable { cursor: pointer; }
.data-table-th.is-sortable:hover { color: var(--color-text-secondary); }
.data-table-th-inner { display: inline-flex; align-items: center; gap: 6px; }
.align-left { text-align: left; }
.align-right { text-align: right; }
.align-center { text-align: center; }

.data-table-sort-ind {
  display: inline-flex;
  flex-direction: column;
  line-height: 0;
  color: var(--color-text-muted);
  opacity: 0.55;
}
.sort-chev { width: 10px; height: 10px; }
.sort-up { margin-bottom: -2px; }
.data-table-sort-ind.is-asc { opacity: 1; color: var(--color-accent); }
.data-table-sort-ind.is-asc .sort-down { opacity: 0.25; }
.data-table-sort-ind.is-desc { opacity: 1; color: var(--color-accent); }
.data-table-sort-ind.is-desc .sort-up { opacity: 0.25; }

.data-table-td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border-muted);
  color: var(--color-text-secondary);
  vertical-align: middle;
}
.data-table-row.is-clickable {
  cursor: pointer;
}
.data-table-row.is-clickable:hover,
.data-table-row:hover {
  background: var(--color-bg-hover);
  transition: background-color 120ms ease;
}
.data-table-row.is-selected {
  background: var(--color-primary-soft);
}

.data-table-check-cell {
  width: 40px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border-muted);
}
.data-table-checkbox {
  width: 14px; height: 14px;
  border-radius: 3px;
  border: 1px solid var(--color-border-strong);
  accent-color: var(--color-accent);
  cursor: pointer;
}

.data-table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-page);
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.data-table-footer-left, .data-table-footer-right {
  display: flex; align-items: center; gap: 10px;
}
.data-table-pagesize-label {
  font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.06em;
}
.data-table-pagesize { padding: 4px 8px; font-size: 12px; }
.data-table-page-indicator { min-width: 80px; text-align: center; }

.sticky-first-col .data-table th:first-child,
.sticky-first-col .data-table td:first-child {
  position: sticky;
  left: 0;
  background: var(--color-bg-card);
  z-index: 1;
}
.sticky-first-col .data-table thead th:first-child {
  background: var(--color-bg-table-header);
}
</style>
