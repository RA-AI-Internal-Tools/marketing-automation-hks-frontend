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

  async function load() {
    loading.value = true
    try {
      campaigns.value = await fetchCampaigns()
    } finally {
      loading.value = false
    }
  }

  async function get(id: number) {
    return fetchCampaign(id)
  }

  async function create(req: CampaignRequest) {
    const created = await createCampaign(req)
    campaigns.value.unshift(created)
    return created
  }

  async function update(id: number, req: CampaignRequest) {
    const updated = await updateCampaign(id, req)
    const idx = campaigns.value.findIndex((c) => c.id === id)
    if (idx !== -1) campaigns.value[idx] = updated
    return updated
  }

  async function remove(id: number) {
    await deleteCampaign(id)
    campaigns.value = campaigns.value.filter((c) => c.id !== id)
  }

  async function toggle(id: number) {
    const result = await toggleCampaign(id)
    const campaign = campaigns.value.find((c) => c.id === id)
    if (campaign) campaign.is_active = result.is_active
    return result
  }

  return { campaigns, loading, load, get, create, update, remove, toggle }
})
