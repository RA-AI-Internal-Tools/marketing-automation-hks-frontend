import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Integration, IntegrationRequest } from '@/api/types'
import {
  fetchIntegrations,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  testIntegrationConnection,
} from '@/api/integrations'

export const useIntegrationsStore = defineStore('integrations', () => {
  const integrations = ref<Integration[]>([])
  const loading = ref(false)
  const error = ref('')

  async function load() {
    loading.value = true
    error.value = ''
    try {
      integrations.value = await fetchIntegrations()
    } catch (e: any) {
      error.value = e.response?.data?.error || 'Failed to load integrations'
    } finally {
      loading.value = false
    }
  }

  async function create(req: IntegrationRequest) {
    const created = await createIntegration(req)
    integrations.value.unshift(created)
    return created
  }

  async function update(id: number, req: IntegrationRequest) {
    const updated = await updateIntegration(id, req)
    const idx = integrations.value.findIndex((i) => i.id === id)
    if (idx !== -1) integrations.value[idx] = updated
    return updated
  }

  async function remove(id: number) {
    await deleteIntegration(id)
    integrations.value = integrations.value.filter((i) => i.id !== id)
  }

  async function testConnection(id: number) {
    return testIntegrationConnection(id)
  }

  const byCategory = computed(() => {
    const map: Record<string, Integration[]> = {}
    for (const i of integrations.value) {
      if (!map[i.provider_type]) map[i.provider_type] = []
      map[i.provider_type]!.push(i)
    }
    return map
  })

  function $reset() {
    integrations.value = []
    loading.value = false
    error.value = ''
  }

  return { integrations, loading, error, byCategory, load, create, update, remove, testConnection, $reset }
})
