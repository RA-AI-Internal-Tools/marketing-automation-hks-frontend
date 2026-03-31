import api from './client'
import type { ReportSchedule } from './types'

export async function fetchReports(): Promise<ReportSchedule[]> {
  const { data } = await api.get('/api/reports')
  return data
}

export async function createReport(req: Partial<ReportSchedule>): Promise<ReportSchedule> {
  const { data } = await api.post('/api/reports', req)
  return data
}

export async function updateReport(id: number, req: Partial<ReportSchedule>): Promise<ReportSchedule> {
  const { data } = await api.put(`/api/reports/${id}`, req)
  return data
}

export async function deleteReport(id: number): Promise<void> {
  await api.delete(`/api/reports/${id}`)
}

export async function runReport(id: number): Promise<void> {
  await api.post(`/api/reports/${id}/run-now`)
}

export async function downloadReport(id: number): Promise<void> {
  const { data, headers } = await api.get(`/api/reports/${id}/download`, { responseType: 'blob' })
  const match = (headers['content-disposition'] as string | undefined)?.match(/filename=(.+)/)
  const filename = match?.[1] ?? `report-${id}.pdf`
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
