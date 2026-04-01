<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import { useTemplatesStore } from '@/stores/templates'
import type { TemplateRequest } from '@/api/types'

const route = useRoute()
const router = useRouter()
const store = useTemplatesStore()

const isEdit = computed(() => !!route.params.id)
const templateId = computed(() => Number(route.params.id))

const templateKey = ref('')
const channel = ref('email')
const name = ref('')
const subject = ref('')
const body = ref('')
const variablesInput = ref('')
const isActive = ref(true)

const saving = ref(false)
const error = ref('')
const loading = ref(false)

const channels = ['email', 'sms', 'whatsapp', 'push']

onMounted(async () => {
  if (isEdit.value) {
    loading.value = true
    try {
      const tmpl = await store.get(templateId.value)
      templateKey.value = tmpl.template_key
      channel.value = tmpl.channel
      name.value = tmpl.name
      subject.value = tmpl.subject || ''
      body.value = tmpl.body
      variablesInput.value = tmpl.variables ? tmpl.variables.join(', ') : ''
      isActive.value = tmpl.is_active
    } catch {
      error.value = 'Failed to load template'
    } finally {
      loading.value = false
    }
  }
})

async function handleSubmit() {
  error.value = ''
  saving.value = true
  try {
    const variables = variablesInput.value
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0)

    const req: TemplateRequest = {
      template_key: templateKey.value,
      channel: channel.value,
      name: name.value,
      subject: channel.value === 'email' ? subject.value || null : null,
      body: body.value,
      variables: variables.length > 0 ? variables : undefined,
      is_active: isActive.value,
    }

    if (isEdit.value) {
      await store.update(templateId.value, req)
    } else {
      await store.create(req)
    }
    router.push('/templates')
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to save template'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page-enter">
    <PageHeader
      :title="isEdit ? 'Edit Template' : 'New Template'"
      :description="isEdit ? 'Modify message template' : 'Create a new message template'"
    />

    <div v-if="loading" class="text-center py-12 text-gray-400">Loading...</div>

    <form v-else @submit.prevent="handleSubmit" class="space-y-6 max-w-2xl">
      <div class="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input v-model="name" required class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-[#0099db]/40" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Template Key</label>
            <input v-model="templateKey" required class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-[#0099db]/40" placeholder="e.g. welcome_email" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Channel</label>
            <select v-model="channel" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-[#0099db]/40">
              <option v-for="ch in channels" :key="ch" :value="ch">{{ ch }}</option>
            </select>
          </div>
          <div class="flex items-center gap-3 pt-6">
            <label class="relative inline-flex items-center cursor-pointer">
              <input v-model="isActive" type="checkbox" class="sr-only peer" />
              <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-[#0099db]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[#020288] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </label>
            <span class="text-sm text-gray-700">Active</span>
          </div>
        </div>

        <div v-if="channel === 'email'">
          <label class="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <input v-model="subject" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-[#0099db]/40" placeholder="Email subject line" />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Body</label>
          <textarea
            v-model="body"
            required
            rows="8"
            class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-[#0099db]/40 font-mono"
            placeholder="Template body content. Use {{variable_name}} for dynamic content."
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Variables (comma-separated)</label>
          <input
            v-model="variablesInput"
            class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-[#0099db]/40"
            placeholder="e.g. first_name, order_id, amount"
          />
        </div>
      </div>

      <div v-if="error" class="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{{ error }}</div>

      <div class="flex items-center gap-3">
        <button
          type="submit"
          :disabled="saving"
          class="px-6 py-2.5 bg-[#020288] text-white text-sm font-medium rounded-lg hover:bg-[#0d35d7] disabled:opacity-50 transition-colors"
        >
          {{ saving ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template' }}
        </button>
        <button
          type="button"
          @click="router.push('/templates')"
          class="px-6 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  </div>
</template>
