<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import IntegrationCard from '@/components/IntegrationCard.vue'
import IntegrationForm from '@/components/IntegrationForm.vue'
import { useIntegrationsStore } from '@/stores/integrations'
import { useEnvironmentStore } from '@/stores/environment'
import { useAuthStore } from '@/stores/auth'
import type { Integration, ProviderType } from '@/api/types'
import { listCredentials, type CredentialRow, type Environment } from '@/api/integrations'
import { getKeyFields } from '@/api/integrationKeys'
import {
  LinkIcon,
  MagnifyingGlassIcon,
} from '@heroicons/vue/24/outline'

const store = useIntegrationsStore()
const env = useEnvironmentStore()
const auth = useAuthStore()

const search = ref('')
const activeCategory = ref<ProviderType | 'all'>('all')
const formVisible = ref(false)
const editingIntegration = ref<Integration | null>(null)
const credentials = ref<CredentialRow[]>([])
// Admin-scoped credential environment toggle. Non-admins fall back to the
// global env store (which is what the read-only catalog view has always used).
const credEnv = ref<Environment>('sandbox')

async function reloadCredentials() {
  if (!auth.isAdmin) return
  try {
    // Scope to the currently-selected env tab. Env-backed credentials
    // live only under the running instance's env (MA_ENVIRONMENT), so
    // asking the backend for the active tab gives an unambiguous view.
    credentials.value = await listCredentials(credEnv.value)
  } catch {
    // non-fatal — the page still renders the catalog
  }
}

// Refetch whenever the operator flips the env tab.
watch(credEnv, () => { reloadCredentials() })

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

onMounted(() => {
  store.load()
  reloadCredentials()
})

// Reload when environment changes
watch(() => env.mode, () => store.load())

function openEdit(id: number) {
  editingIntegration.value = store.integrations.find(i => i.id === id) || null
  formVisible.value = true
}

async function handleSaved() {
  // Credential form saved — refresh the credential metadata so cards
  // reflect the new "Configured (env)" state without a full page reload.
  await reloadCredentials()
}

function providerKeyFor(i: Integration): string {
  // Backend now sends provider_slug (openai, fcm, ses, …). Fall back to
  // slugifying the display name for compatibility with older builds.
  return i.provider_slug
    || i.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function editingProviderKey(): string {
  return editingIntegration.value ? providerKeyFor(editingIntegration.value) : ''
}

type CredStatus = 'none' | 'partial' | 'full'

function credStatusFor(providerKey: string, environment: Environment): CredStatus {
  const fields = getKeyFields(providerKey)
  if (fields.length === 0) {
    // Unknown schema — fall back to "any key present = configured" so older
    // providers not listed in integrationKeys.ts don't regress to "none".
    return credentials.value.some(c => c.provider === providerKey && c.environment === environment)
      ? 'full'
      : 'none'
  }
  const present = new Set(
    credentials.value
      .filter(c => c.provider === providerKey && c.environment === environment)
      .map(c => c.key_name),
  )
  if (present.size === 0) return 'none'
  const allPresent = fields.every(f => present.has(f.key_name))
  return allPresent ? 'full' : 'partial'
}

</script>

<template>
  <div class="page-enter">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <PageHeader title="Integrations" description="Third-party provider configuration and management" />
      <!-- Admin credential environment toggle — separate from the global env
           store which governs the read-only catalog view. Only admins can
           store credentials, so this control is hidden for everyone else. -->
      <div v-if="auth.isAdmin" role="tablist" aria-label="Credential environment" class="inline-flex items-center gap-1 p-1 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)]">
        <button
          v-for="envOpt in (['sandbox', 'production'] as Environment[])"
          :key="envOpt"
          type="button"
          role="tab"
          :aria-selected="credEnv === envOpt"
          @click="credEnv = envOpt"
          :class="[
            'px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors',
            credEnv === envOpt
              ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
              : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]',
          ]"
        >
          {{ envOpt }}
        </button>
      </div>
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
    </div>

    <!-- Integration grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <IntegrationCard
        v-for="integration in filtered"
        :key="integration.id"
        :integration="integration"
        :credential-environment="credEnv"
        :credential-status="credStatusFor(providerKeyFor(integration), credEnv)"
        @edit="openEdit"
      />
    </div>

    <!-- Form modal -->
    <IntegrationForm
      :visible="formVisible"
      :integration="editingIntegration"
      :provider="editingProviderKey()"
      :initial-environment="credEnv"
      @close="formVisible = false"
      @saved="handleSaved"
    />
  </div>
</template>
