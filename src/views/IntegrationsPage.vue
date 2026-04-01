<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import IntegrationCard from '@/components/IntegrationCard.vue'
import IntegrationForm from '@/components/IntegrationForm.vue'
import { useIntegrationsStore } from '@/stores/integrations'
import { useEnvironmentStore } from '@/stores/environment'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import type { Integration, IntegrationRequest, ProviderType } from '@/api/types'
import {
  PlusIcon,
  LinkIcon,
  MagnifyingGlassIcon,
} from '@heroicons/vue/24/outline'

const store = useIntegrationsStore()
const env = useEnvironmentStore()
const auth = useAuthStore()
const { showToast } = useToast()

const search = ref('')
const activeCategory = ref<ProviderType | 'all'>('all')
const formVisible = ref(false)
const formSaving = ref(false)
const editingIntegration = ref<Integration | null>(null)
const testingIds = ref<Set<number>>(new Set())

const categories: { value: ProviderType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'push', label: 'Push' },
  { value: 'webhook', label: 'Webhooks' },
  { value: 'crm', label: 'CRM' },
  { value: 'analytics', label: 'Analytics' },
]

const filtered = computed(() => {
  let list = store.integrations
  if (activeCategory.value !== 'all') {
    list = list.filter(i => i.provider_type === activeCategory.value)
  }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(i => i.name.toLowerCase().includes(q) || i.provider_type.includes(q))
  }
  return list
})

onMounted(() => store.load())

// Reload when environment changes
watch(() => env.mode, () => store.load())

function openAdd() {
  editingIntegration.value = null
  formVisible.value = true
}

function openEdit(id: number) {
  editingIntegration.value = store.integrations.find(i => i.id === id) || null
  formVisible.value = true
}

async function handleSave(req: IntegrationRequest, id?: number) {
  formSaving.value = true
  try {
    if (id) {
      await store.update(id, req)
      showToast('Integration updated', 'success')
    } else {
      await store.create(req)
      showToast('Integration created', 'success')
    }
    formVisible.value = false
  } catch (e: any) {
    showToast(e.response?.data?.error || 'Failed to save integration', 'error')
  } finally {
    formSaving.value = false
  }
}

async function handleTest(id: number) {
  testingIds.value.add(id)
  try {
    const result = await store.testConnection(id)
    showToast(result.success ? 'Connection successful' : `Connection failed: ${result.message}`, result.success ? 'success' : 'error')
    // Reload to update last_tested_at
    await store.load()
  } catch (e: any) {
    showToast(e.response?.data?.error || 'Test connection failed', 'error')
  } finally {
    testingIds.value.delete(id)
  }
}
</script>

<template>
  <div class="page-enter">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <PageHeader title="Integrations" description="Third-party provider configuration and management" />
      <button
        v-if="auth.canWrite"
        @click="openAdd"
        class="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-hover)] shadow-sm transition-all shrink-0"
      >
        <PlusIcon class="h-4 w-4" /> Add Integration
      </button>
    </div>

    <!-- Environment banner -->
    <div
      :class="[
        'flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium mb-6 border',
        env.isSandbox
          ? 'bg-[var(--env-sandbox-bg)] border-[var(--env-sandbox-border)] text-[var(--env-sandbox-text)]'
          : 'bg-[var(--env-production-bg)] border-[var(--env-production-border)] text-[var(--env-production-text)]',
      ]"
    >
      <span :class="['h-2 w-2 rounded-full', env.isSandbox ? 'bg-[var(--env-sandbox-accent)]' : 'bg-[var(--env-production-accent)]']"></span>
      Showing <span class="font-bold capitalize">{{ env.mode }}</span> integrations only. Switch environment to see {{ env.isSandbox ? 'production' : 'sandbox' }} integrations.
    </div>

    <!-- Filter bar -->
    <div class="flex flex-col sm:flex-row gap-3 mb-6">
      <!-- Category tabs -->
      <div class="flex items-center gap-1 overflow-x-auto pb-1">
        <button
          v-for="cat in categories"
          :key="cat.value"
          @click="activeCategory = cat.value"
          :class="[
            'px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors',
            activeCategory === cat.value
              ? 'bg-[var(--color-primary)] text-white'
              : 'text-[var(--color-text-tertiary)] bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-muted)]',
          ]"
        >
          {{ cat.label }}
        </button>
      </div>

      <!-- Search -->
      <div class="relative flex-1 max-w-xs">
        <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
        <input
          v-model="search"
          type="text"
          placeholder="Search integrations..."
          class="w-full pl-9 pr-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 placeholder:text-[var(--color-text-muted)]"
        />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <div v-for="i in 6" :key="i" class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-5">
        <div class="flex items-center gap-3 mb-4">
          <div class="skeleton h-10 w-10 rounded-lg"></div>
          <div class="space-y-2 flex-1">
            <div class="skeleton h-4 w-32"></div>
            <div class="skeleton h-3 w-20"></div>
          </div>
        </div>
        <div class="skeleton h-6 w-24 rounded-full mb-3"></div>
        <div class="skeleton h-3 w-full"></div>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="store.error" class="bg-[var(--color-error-bg)] border border-[var(--color-error-border)] text-[var(--color-error-text)] px-4 py-3 rounded-xl text-sm">
      {{ store.error }}
    </div>

    <!-- Empty state -->
    <div v-else-if="filtered.length === 0" class="text-center py-16">
      <div class="text-[var(--color-text-muted)] mb-3">
        <LinkIcon class="h-12 w-12 mx-auto" />
      </div>
      <p class="text-[var(--color-text-tertiary)] font-medium">
        {{ search || activeCategory !== 'all' ? 'No matching integrations' : 'No integrations configured' }}
      </p>
      <p class="text-sm text-[var(--color-text-muted)] mt-1">
        {{ search || activeCategory !== 'all' ? 'Try adjusting your filters.' : `Add your first ${env.mode} integration to get started.` }}
      </p>
      <button
        v-if="auth.canWrite && !search && activeCategory === 'all'"
        @click="openAdd"
        class="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-hover)] transition-all"
      >
        <PlusIcon class="h-4 w-4" /> Add Integration
      </button>
    </div>

    <!-- Integration grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <IntegrationCard
        v-for="integration in filtered"
        :key="integration.id"
        :integration="integration"
        :testing="testingIds.has(integration.id)"
        @edit="openEdit"
        @test="handleTest"
      />
    </div>

    <!-- Form modal -->
    <IntegrationForm
      :visible="formVisible"
      :integration="editingIntegration"
      :saving="formSaving"
      @close="formVisible = false"
      @save="handleSave"
    />
  </div>
</template>
