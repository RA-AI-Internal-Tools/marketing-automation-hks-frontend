<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useTemplatesStore } from '@/stores/templates'
import { useAuthStore } from '@/stores/auth'
import TestSendModal from '@/components/TestSendModal.vue'
import { PlusIcon, PencilSquareIcon, TrashIcon, PaperAirplaneIcon, LanguageIcon } from '@heroicons/vue/24/outline'
import { TEMPLATE_LANGUAGES } from '@/utils/email-template'

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

async function handleCloneVariant(id: number, name: string) {
  const options = TEMPLATE_LANGUAGES.map((l) => `${l.value} — ${l.label}`).join('\n')
  const input = prompt(
    `Create a locale variant of "${name}".\n\n` +
    `Enter the target locale (e.g. en, ar, ar-iq):\n\n${options}`,
    'ar-iq',
  )
  if (!input) return
  const locale = input.trim().toLowerCase()
  if (!/^[a-z]{2}(-[a-z]{2})?$/.test(locale)) {
    alert(`Invalid locale: ${locale}\nUse format: lang or lang-region (e.g. en, ar-iq).`)
    return
  }
  try {
    const variant = await store.cloneVariant(id, locale)
    // Open the new variant in the editor for immediate translation.
    router.push(`/templates/${variant.id}/edit`)
  } catch (e: any) {
    alert(e.response?.data?.error || 'Failed to clone variant')
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
  <div class="page-enter">
    <div class="flex items-center justify-between mb-6">
      <PageHeader title="Templates" description="Message templates for each channel" />
      <div class="flex items-center gap-2">
        <button
          v-if="auth.canWrite"
          @click="testSendOpen = true"
          class="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] text-sm font-medium rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors"
        >
          <PaperAirplaneIcon class="h-4 w-4" /> Test Send
        </button>
        <button
          v-if="auth.canWrite"
          @click="router.push('/templates/new')"
          class="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors"
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
            ? 'bg-blue-100 text-[#020288] font-medium'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]',
        ]"
      >
        {{ ch || 'All' }}
      </button>
    </div>

    <div v-if="store.loading" class="text-center py-12 text-[var(--color-text-muted)]">Loading templates...</div>

    <div v-else-if="store.templates.length === 0" class="text-center py-12 text-[var(--color-text-muted)]">
      No templates yet. Create your first template to get started.
    </div>

    <div v-else class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-[var(--color-bg-page)] border-b border-[var(--color-border)]">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-[var(--color-text-tertiary)]">Name</th>
            <th class="text-left px-4 py-3 font-medium text-[var(--color-text-tertiary)]">Key</th>
            <th class="text-left px-4 py-3 font-medium text-[var(--color-text-tertiary)]">Channel</th>
            <th class="text-left px-4 py-3 font-medium text-[var(--color-text-tertiary)]">Status</th>
            <th class="text-right px-4 py-3 font-medium text-[var(--color-text-tertiary)]">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--color-border-muted)]">
          <tr v-for="tmpl in store.templates" :key="tmpl.id" class="hover:bg-[var(--color-bg-hover)] transition-colors">
            <td class="px-4 py-3 font-medium text-[var(--color-text-primary)]">{{ tmpl.name }}</td>
            <td class="px-4 py-3 text-[var(--color-text-tertiary)]">
              <code class="bg-[var(--color-bg-subtle)] px-1.5 py-0.5 rounded text-xs">{{ tmpl.template_key }}</code>
            </td>
            <td class="px-4 py-3">
              <span
                class="text-xs font-medium inline-block px-1.5 py-0.5 rounded"
                :class="channelColors[tmpl.channel] || 'bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)]'"
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
                  class="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                  title="Edit"
                >
                  <PencilSquareIcon class="h-4 w-4" />
                </button>
                <button
                  @click="handleCloneVariant(tmpl.id, tmpl.name)"
                  class="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                  title="Clone as locale variant"
                >
                  <LanguageIcon class="h-4 w-4" />
                </button>
                <button
                  @click="handleDelete(tmpl.id, tmpl.name)"
                  class="p-1.5 text-[var(--color-text-muted)] hover:text-red-600 transition-colors"
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
