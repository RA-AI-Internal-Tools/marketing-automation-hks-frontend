import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ClientConsent } from '@/api/types'
import { fetchConsents, optOut, optIn } from '@/api/dashboard'

export const useConsentsStore = defineStore('consents', () => {
  const consents = ref<ClientConsent[]>([])
  const loading = ref(false)

  async function loadForClient(clientId: number) {
    loading.value = true
    try {
      consents.value = await fetchConsents(clientId)
    } finally {
      loading.value = false
    }
  }

  async function toggleOptOut(clientId: number, channel: string) {
    await optOut(clientId, channel)
    const consent = consents.value.find((c) => c.channel === channel)
    if (consent) consent.opted_in = false
  }

  async function toggleOptIn(clientId: number, channel: string) {
    await optIn(clientId, channel)
    const consent = consents.value.find((c) => c.channel === channel)
    if (consent) consent.opted_in = true
  }

  return { consents, loading, loadForClient, toggleOptOut, toggleOptIn }
})
