// useSortable — click-to-sort table helper. Caller passes a reactive source
// + an optional default key/direction; gets back a `sorted` computed + a
// `toggle(key)` action that flips the direction on re-click.
//
// Kept deliberately unopinionated about key naming: the compare function
// falls back to localeCompare for strings, numeric compare for numbers,
// and Date compare for anything that parses.
import { computed, ref, type Ref } from 'vue'

export type SortDirection = 'asc' | 'desc'

export interface SortableOptions<K> {
  defaultKey?: K
  defaultDir?: SortDirection
}

export function useSortable<T, K extends keyof T>(
  items: Ref<T[]>,
  opts: SortableOptions<K> = {},
) {
  const key = ref<K | null>(opts.defaultKey ?? null) as Ref<K | null>
  const dir = ref<SortDirection>(opts.defaultDir ?? 'asc')

  function toggle(next: K) {
    if (key.value === next) {
      dir.value = dir.value === 'asc' ? 'desc' : 'asc'
    } else {
      key.value = next
      dir.value = 'asc'
    }
  }

  function compare(a: unknown, b: unknown): number {
    if (a == null && b == null) return 0
    if (a == null) return -1
    if (b == null) return 1
    if (typeof a === 'number' && typeof b === 'number') return a - b
    if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, undefined, { numeric: true })
    if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
    return String(a).localeCompare(String(b), undefined, { numeric: true })
  }

  const sorted = computed<T[]>(() => {
    if (key.value === null) return items.value
    const k = key.value
    const mul = dir.value === 'asc' ? 1 : -1
    // Copy before sort — Array.prototype.sort mutates.
    return [...items.value].sort((a, b) => mul * compare(a[k], b[k]))
  })

  return { sorted, key, dir, toggle }
}
