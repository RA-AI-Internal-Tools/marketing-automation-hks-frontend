import { defineStore } from 'pinia'

// Session-only UI preferences (page-size default etc.). Not persisted
// to localStorage per brief — Pinia's in-memory state is enough; if the
// operator reloads they get the 50-default again, which is fine.
export const usePreferencesStore = defineStore('preferences', {
  state: () => ({
    pageSize: 50 as number,
  }),
  actions: {
    setPageSize(n: number) {
      this.pageSize = n
    },
  },
})
