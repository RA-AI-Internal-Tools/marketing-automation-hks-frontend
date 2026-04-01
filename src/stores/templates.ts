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

  async function load(channel?: string) {
    loading.value = true
    try {
      templates.value = await fetchTemplates(channel)
    } finally {
      loading.value = false
    }
  }

  async function get(id: number) {
    return fetchTemplate(id)
  }

  async function create(req: TemplateRequest) {
    const created = await createTemplate(req)
    templates.value.unshift(created)
    return created
  }

  async function update(id: number, req: TemplateRequest) {
    const updated = await updateTemplate(id, req)
    const idx = templates.value.findIndex((t) => t.id === id)
    if (idx !== -1) templates.value[idx] = updated
    return updated
  }

  async function remove(id: number) {
    await deleteTemplate(id)
    templates.value = templates.value.filter((t) => t.id !== id)
  }

  function $reset() {
    templates.value = []
    loading.value = false
  }

  return { templates, loading, load, get, create, update, remove, $reset }
})
