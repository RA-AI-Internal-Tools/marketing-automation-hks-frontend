import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DataTable, { type Column } from '../DataTable.vue'
import SkeletonTable from '../SkeletonTable.vue'
import EmptyState from '../EmptyState.vue'
import ErrorState from '../ErrorState.vue'

const columns: Column[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'status', label: 'Status' },
]

const rows = [
  { id: 1, name: 'Alpha', status: 'active' },
  { id: 2, name: 'Bravo', status: 'active' },
  { id: 3, name: 'Charlie', status: 'inactive' },
]

describe('DataTable', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders columns and rows', () => {
    const w = mount(DataTable, {
      props: { columns, rows, rowKey: 'id' },
    })
    expect(w.text()).toContain('Name')
    expect(w.text()).toContain('Alpha')
    expect(w.text()).toContain('Charlie')
    expect(w.findAll('tbody tr')).toHaveLength(3)
  })

  it('click sortable header emits sort + toggles chevron', async () => {
    const w = mount(DataTable, {
      props: { columns, rows, rowKey: 'id', sortable: true },
    })
    const nameTh = w.findAll('th.is-sortable')[0]
    expect(nameTh.exists()).toBe(true)
    await nameTh.trigger('click')
    expect(w.emitted('sort')).toBeTruthy()
    expect(w.emitted('sort')![0][0]).toMatchObject({ key: 'name', dir: 'asc' })
    await nameTh.trigger('click')
    expect(w.emitted('sort')![1][0]).toMatchObject({ key: 'name', dir: 'desc' })
    await nameTh.trigger('click')
    expect(w.emitted('sort')![2][0]).toMatchObject({ key: 'name', dir: null })
  })

  it('selectable renders checkboxes and select-all toggles all', async () => {
    const w = mount(DataTable, {
      props: { columns, rows, rowKey: 'id', selectable: true },
    })
    const boxes = w.findAll('input[type="checkbox"]')
    // 1 header + 3 rows
    expect(boxes.length).toBe(4)
    await boxes[0].setValue(true)
    const emitted = w.emitted('update:selected')
    expect(emitted).toBeTruthy()
    expect(emitted![emitted!.length - 1][0]).toEqual([1, 2, 3])
  })

  it('shift-click extends selection from last anchor', async () => {
    const w = mount(DataTable, {
      props: { columns, rows, rowKey: 'id', selectable: true },
    })
    const rowBoxes = w.findAll('tbody input[type="checkbox"]')
    // click row 0 (anchor)
    await rowBoxes[0].trigger('click')
    // shift-click row 2 — should select 0..2
    await rowBoxes[2].trigger('click', { shiftKey: true })
    const emitted = w.emitted('update:selected')!
    const last = emitted[emitted.length - 1][0] as number[]
    expect(new Set(last)).toEqual(new Set([1, 2, 3]))
  })

  it('loading shows SkeletonTable', () => {
    const w = mount(DataTable, {
      props: { columns, rows: [], rowKey: 'id', loading: true },
    })
    expect(w.findComponent(SkeletonTable).exists()).toBe(true)
  })

  it('error renders ErrorState and retry emits', async () => {
    const w = mount(DataTable, {
      props: { columns, rows: [], rowKey: 'id', error: 'boom' },
    })
    const es = w.findComponent(ErrorState)
    expect(es.exists()).toBe(true)
    await es.find('.error-state-retry').trigger('click')
    expect(w.emitted('retry')).toBeTruthy()
  })

  it('empty renders EmptyState', () => {
    const w = mount(DataTable, {
      props: { columns, rows: [], rowKey: 'id', emptyTitle: 'Nothing here' },
    })
    expect(w.findComponent(EmptyState).exists()).toBe(true)
    expect(w.text()).toContain('Nothing here')
  })

  it('Delete key emits bulk-delete only when rows are selected', async () => {
    const w = mount(DataTable, {
      props: { columns, rows, rowKey: 'id', selectable: true },
      attachTo: document.body,
    })
    // No selection → no emit
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    expect(w.emitted('bulk-delete')).toBeFalsy()

    // Select rows via the v-model passthrough
    await w.setProps({ selected: [1, 2] })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    const emitted = w.emitted('bulk-delete')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toEqual([1, 2])
    w.unmount()
  })

  it('row-click emits the row', async () => {
    const w = mount(DataTable, {
      props: { columns, rows, rowKey: 'id' },
      attrs: { onRowClick: () => {} },
    })
    await w.findAll('tbody tr')[1].trigger('click')
    const emitted = w.emitted('row-click')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toMatchObject({ id: 2 })
  })
})
