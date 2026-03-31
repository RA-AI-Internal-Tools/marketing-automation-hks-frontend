import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ReportSchedule } from '@/api/types'
import {
  fetchReports,
  createReport,
  updateReport as apiUpdateReport,
  deleteReport as apiDeleteReport,
} from '@/api/reports'

export const useReportsStore = defineStore('reports', () => {
  const reports = ref<ReportSchedule[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      reports.value = await fetchReports()
    } finally {
      loading.value = false
    }
  }

  async function create(data: Omit<ReportSchedule, 'id' | 'created_at' | 'updated_at' | 'last_run_at' | 'next_run_at'>) {
    const report = await createReport(data)
    reports.value.unshift(report)
    return report
  }

  async function update(id: number, data: Partial<ReportSchedule>) {
    const report = await apiUpdateReport(id, data)
    const idx = reports.value.findIndex((r) => r.id === id)
    if (idx >= 0) reports.value[idx] = report
    return report
  }

  async function remove(id: number) {
    await apiDeleteReport(id)
    reports.value = reports.value.filter((r) => r.id !== id)
  }

  return { reports, loading, load, create, update, remove }
})
