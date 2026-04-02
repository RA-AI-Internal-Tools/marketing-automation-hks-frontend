import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MessageTemplate, TemplateRequest } from '@/api/types'
import {
  fetchTemplates,
  fetchTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '@/api/dashboard'

export const useTemplatesStore = defineStore('templates', () => {
  const templates = ref<MessageTemplate[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load(channel?: string) {
    loading.value = true
    error.value = null
    try {
      templates.value = await fetchTemplates(channel)
    } catch (e: any) {
      error.value = e.response?.data?.error || e.message || 'Failed to load templates'
    } finally {
      loading.value = false
    }
  }

  async function get(id: number) {
    try {
      return await fetchTemplate(id)
    } catch (e: any) {
      error.value = e.response?.data?.error || e.message || 'Failed to load template'
      throw e
    }
  }

  async function create(req: TemplateRequest) {
    error.value = null
    try {
      const created = await createTemplate(req)
      templates.value.unshift(created)
      return created
    } catch (e: any) {
      error.value = e.response?.data?.error || e.message || 'Failed to create template'
      throw e
    }
  }

  async function update(id: number, req: TemplateRequest) {
    error.value = null
    try {
      const updated = await updateTemplate(id, req)
      const idx = templates.value.findIndex((t) => t.id === id)
      if (idx !== -1) templates.value[idx] = updated
      return updated
    } catch (e: any) {
      error.value = e.response?.data?.error || e.message || 'Failed to update template'
      throw e
    }
  }

  async function remove(id: number) {
    error.value = null
    try {
      await deleteTemplate(id)
      templates.value = templates.value.filter((t) => t.id !== id)
    } catch (e: any) {
      error.value = e.response?.data?.error || e.message || 'Failed to delete template'
      throw e
    }
  }

  function $reset() {
    templates.value = []
    loading.value = false
    error.value = null
  }

  return { templates, loading, error, load, get, create, update, remove, $reset }
})
