import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CampaignEnrollment } from '@/api/types'
import { fetchEnrollments } from '@/api/dashboard'

export const useEnrollmentsStore = defineStore('enrollments', () => {
  const enrollments = ref<CampaignEnrollment[]>([])
  const total = ref(0)
  const loading = ref(false)

  async function load(params: Record<string, any> = {}) {
    loading.value = true
    try {
      const result = await fetchEnrollments(params)
      enrollments.value = result.data || []
      total.value = result.total
    } finally {
      loading.value = false
    }
  }

  return { enrollments, total, loading, load }
})
