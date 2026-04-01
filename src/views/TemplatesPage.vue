<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useTemplatesStore } from '@/stores/templates'
import { useAuthStore } from '@/stores/auth'
import TestSendModal from '@/components/TestSendModal.vue'
import { PlusIcon, PencilSquareIcon, TrashIcon, PaperAirplaneIcon } from '@heroicons/vue/24/outline'

const router = useRouter()
const store = useTemplatesStore()
const auth = useAuthStore()
const channelFilter = ref('')

const channels = ['', 'email', 'sms', 'whatsapp', 'push']
const testSendOpen = ref(false)

onMounted(() => store.load())

async function filterByChannel(ch: string) {
  channelFilter.value = ch
  await store.load(ch || undefined)
}

async function handleDelete(id: number, name: string) {
  if (!confirm(`Delete template "${name}"?`)) return
  try {
    await store.remove(id)
  } catch (e: any) {
    alert(e.response?.data?.error || 'Failed to delete template')
  }
}

const channelColors: Record<string, string> = {
  email: 'bg-blue-100 text-blue-800',
  sms: 'bg-purple-100 text-purple-800',
  whatsapp: 'bg-green-100 text-green-800',
  push: 'bg-orange-100 text-orange-800',
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <PageHeader title="Templates" description="Message templates for each channel" />
      <div class="flex items-center gap-2">
        <button
          v-if="auth.canWrite"
          @click="testSendOpen = true"
          class="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <PaperAirplaneIcon class="h-4 w-4" /> Test Send
        </button>
        <button
          v-if="auth.canWrite"
          @click="router.push('/templates/new')"
          class="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <PlusIcon class="h-4 w-4" /> New Template
        </button>
      </div>
    </div>

    <!-- Channel filter tabs -->
    <div class="flex gap-2 mb-6">
      <button
        v-for="ch in channels"
        :key="ch"
        @click="filterByChannel(ch)"
        :class="[
          'px-3 py-1.5 text-sm rounded-lg transition-colors',
          channelFilter === ch
            ? 'bg-indigo-100 text-indigo-700 font-medium'
            : 'text-gray-600 hover:bg-gray-100',
        ]"
      >
        {{ ch || 'All' }}
      </button>
    </div>

    <div v-if="store.loading" class="text-center py-12 text-gray-400">Loading templates...</div>

    <div v-else-if="store.templates.length === 0" class="text-center py-12 text-gray-400">
      No templates yet. Create your first template to get started.
    </div>

    <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Name</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Key</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Channel</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Status</th>
            <th class="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="tmpl in store.templates" :key="tmpl.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 font-medium text-gray-900">{{ tmpl.name }}</td>
            <td class="px-4 py-3 text-gray-500">
              <code class="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{{ tmpl.template_key }}</code>
            </td>
            <td class="px-4 py-3">
              <span
                class="text-xs font-medium inline-block px-1.5 py-0.5 rounded"
                :class="channelColors[tmpl.channel] || 'bg-gray-100 text-gray-800'"
              >
                {{ tmpl.channel }}
              </span>
            </td>
            <td class="px-4 py-3">
              <StatusBadge :status="tmpl.is_active ? 'active' : 'inactive'" />
            </td>
            <td class="px-4 py-3 text-right">
              <div v-if="auth.canWrite" class="flex items-center justify-end gap-2">
                <button
                  @click="router.push(`/templates/${tmpl.id}/edit`)"
                  class="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors"
                  title="Edit"
                >
                  <PencilSquareIcon class="h-4 w-4" />
                </button>
                <button
                  @click="handleDelete(tmpl.id, tmpl.name)"
                  class="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                  title="Delete"
                >
                  <TrashIcon class="h-4 w-4" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <TestSendModal :open="testSendOpen" @close="testSendOpen = false" />
  </div>
</template>
