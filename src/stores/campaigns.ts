import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CampaignDefinition, CampaignRequest } from '@/api/types'
import {
  fetchCampaigns,
  fetchCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  toggleCampaign,
} from '@/api/dashboard'

export const useCampaignsStore = defineStore('campaigns', () => {
  const campaigns = ref<CampaignDefinition[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      campaigns.value = await fetchCampaigns()
    } catch (e: any) {
      error.value = e.response?.data?.error || e.message || 'Failed to load campaigns'
    } finally {
      loading.value = false
    }
  }

  async function get(id: number) {
    try {
      return await fetchCampaign(id)
    } catch (e: any) {
      error.value = e.response?.data?.error || e.message || 'Failed to load campaign'
      throw e
    }
  }

  async function create(req: CampaignRequest) {
    error.value = null
    try {
      const created = await createCampaign(req)
      campaigns.value.unshift(created)
      return created
    } catch (e: any) {
      error.value = e.response?.data?.error || e.message || 'Failed to create campaign'
      throw e
    }
  }

  async function update(id: number, req: CampaignRequest) {
    error.value = null
    try {
      const updated = await updateCampaign(id, req)
      const idx = campaigns.value.findIndex((c) => c.id === id)
      if (idx !== -1) campaigns.value[idx] = updated
      return updated
    } catch (e: any) {
      error.value = e.response?.data?.error || e.message || 'Failed to update campaign'
      throw e
    }
  }

  async function remove(id: number) {
    error.value = null
    try {
      await deleteCampaign(id)
      campaigns.value = campaigns.value.filter((c) => c.id !== id)
    } catch (e: any) {
      error.value = e.response?.data?.error || e.message || 'Failed to delete campaign'
      throw e
    }
  }

  async function toggle(id: number) {
    error.value = null
    try {
      const result = await toggleCampaign(id)
      const campaign = campaigns.value.find((c) => c.id === id)
      if (campaign) campaign.is_active = result.is_active
      return result
    } catch (e: any) {
      error.value = e.response?.data?.error || e.message || 'Failed to toggle campaign'
      throw e
    }
  }

  function $reset() {
    campaigns.value = []
    loading.value = false
    error.value = null
  }

  return { campaigns, loading, error, load, get, create, update, remove, toggle, $reset }
})
