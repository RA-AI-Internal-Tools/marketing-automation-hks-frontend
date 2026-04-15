<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import SkeletonTable from '@/components/SkeletonTable.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import { useAuthStore } from '@/stores/auth'
import { fetchSettings, changePassword, flushCache } from '@/api/dashboard'
import {
  listFeatureFlags,
  setFeatureFlag,
  resetFeatureFlag,
  type FeatureFlag,
} from '@/api/featureFlags'

const auth = useAuthStore()

const settings = ref<any>(null)
const loading = ref(true)

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref('')
const passwordSuccess = ref('')
const saving = ref(false)
const flushing = ref(false)
const flushSuccess = ref('')
const flushError = ref('')

// Feature flags — admin-only read-only view into every operational env var.
// Useful for verifying staging vs prod diverge only where intended.
const featureFlags = ref<FeatureFlag[]>([])
const flagsLoading = ref(false)
const flagsError = ref('')

// "numeric"/"info" statuses render as plain text; everything else renders as a
// StatusBadge. Sensitive values already come back redacted so no masking here.
const nonBadgeStatuses = new Set(['info'])

const groupedFlags = computed(() => {
  const order = ['environment', 'credentials', 'sto', 'queue', 'broadcasts', 'webhooks', 'compliance', 'ai']
  const buckets: Record<string, FeatureFlag[]> = {}
  for (const f of featureFlags.value) {
    ;(buckets[f.category] ||= []).push(f)
  }
  const known = order.filter((c) => buckets[c]).map((c) => ({ category: c, flags: buckets[c] }))
  const extras = Object.keys(buckets)
    .filter((c) => !order.includes(c))
    .sort()
    .map((c) => ({ category: c, flags: buckets[c] }))
  return [...known, ...extras]
})

function categoryLabel(c: string): string {
  const map: Record<string, string> = {
    environment: 'Environment',
    credentials: 'Credentials',
    sto: 'Send-Time Optimization',
    queue: 'Queue',
    broadcasts: 'Broadcasts',
    webhooks: 'Webhooks',
    compliance: 'Compliance',
    ai: 'AI',
  }
  return map[c] || c.charAt(0).toUpperCase() + c.slice(1)
}

// Per-flag edit state. Keyed by flag.key so each input has its own
// local draft value + save state without rerunning the whole list.
const flagDrafts = ref<Record<string, string>>({})
const flagSaving = ref<Record<string, boolean>>({})
const flagFeedback = ref<Record<string, { type: 'ok' | 'err'; message: string }>>({})

// inputTypeFor decides which control to render. Matches the backend's
// allowlist: enum (allowed_values present) → select; value==="true"/"false"
// → bool toggle; numeric value → number input; otherwise text.
function inputTypeFor(flag: FeatureFlag): 'enum' | 'bool' | 'int' | 'text' {
  if (flag.allowed_values && flag.allowed_values.length > 0) return 'enum'
  if (flag.value === 'true' || flag.value === 'false') return 'bool'
  if (/^-?\d+$/.test(flag.value)) return 'int'
  return 'text'
}

function draftFor(flag: FeatureFlag): string {
  return flagDrafts.value[flag.key] ?? flag.value
}

function setDraft(key: string, value: string) {
  flagDrafts.value = { ...flagDrafts.value, [key]: value }
}

function replaceFlag(updated: FeatureFlag) {
  const idx = featureFlags.value.findIndex((f) => f.key === updated.key)
  if (idx >= 0) {
    featureFlags.value.splice(idx, 1, updated)
  }
  // Clear draft so inputs re-sync to the new authoritative value.
  delete flagDrafts.value[updated.key]
  flagDrafts.value = { ...flagDrafts.value }
}

async function saveFlag(flag: FeatureFlag) {
  const draft = draftFor(flag)
  if (draft === flag.value) {
    flagFeedback.value = { ...flagFeedback.value, [flag.key]: { type: 'ok', message: 'No change' } }
    return
  }
  flagSaving.value = { ...flagSaving.value, [flag.key]: true }
  try {
    const res = await setFeatureFlag(flag.key, draft)
    replaceFlag(res.flag)
    const msg = res.requires_restart
      ? (res.note || 'Saved. Requires server restart to take effect.')
      : 'Saved'
    flagFeedback.value = { ...flagFeedback.value, [flag.key]: { type: 'ok', message: msg } }
  } catch (e: any) {
    flagFeedback.value = {
      ...flagFeedback.value,
      [flag.key]: { type: 'err', message: e?.response?.data?.error || 'Failed to save' },
    }
  } finally {
    flagSaving.value = { ...flagSaving.value, [flag.key]: false }
  }
}

async function revertFlag(flag: FeatureFlag) {
  flagSaving.value = { ...flagSaving.value, [flag.key]: true }
  try {
    const res = await resetFeatureFlag(flag.key)
    replaceFlag(res.flag)
    const msg = res.requires_restart
      ? (res.note || 'Reset. Requires server restart to take effect.')
      : 'Reset to default'
    flagFeedback.value = { ...flagFeedback.value, [flag.key]: { type: 'ok', message: msg } }
  } catch (e: any) {
    flagFeedback.value = {
      ...flagFeedback.value,
      [flag.key]: { type: 'err', message: e?.response?.data?.error || 'Failed to reset' },
    }
  } finally {
    flagSaving.value = { ...flagSaving.value, [flag.key]: false }
  }
}

async function loadFeatureFlags() {
  if (!auth.isAdmin) return
  flagsLoading.value = true
  flagsError.value = ''
  try {
    featureFlags.value = await listFeatureFlags()
  } catch (e: any) {
    flagsError.value = e?.response?.data?.error || 'Failed to load feature flags'
  } finally {
    flagsLoading.value = false
  }
}

onMounted(async () => {
  try {
    settings.value = await fetchSettings()
  } finally {
    loading.value = false
  }
  loadFeatureFlags()
})

// Flushing the analytics cache evicts every cached aggregate and forces
// the next page-load everywhere to hit the DB cold — a non-trivial cost
// the user should confirm. Gated to admins in the template.
const flushConfirmOpen = ref(false)
function requestFlushCache() { flushConfirmOpen.value = true }

async function handleFlushCache() {
  flushConfirmOpen.value = false
  flushing.value = true
  flushSuccess.value = ''
  flushError.value = ''
  try {
    await flushCache()
    flushSuccess.value = 'Analytics cache flushed successfully'
  } catch (e: any) {
    flushError.value = e.response?.data?.error || 'Failed to flush cache'
  } finally {
    flushing.value = false
  }
}

async function handleChangePassword() {
  passwordError.value = ''
  passwordSuccess.value = ''

  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Passwords do not match'
    return
  }
  if (newPassword.value.length < 6) {
    passwordError.value = 'Password must be at least 6 characters'
    return
  }

  saving.value = true
  try {
    await changePassword(currentPassword.value, newPassword.value)
    passwordSuccess.value = 'Password updated successfully'
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e: any) {
    passwordError.value = e.response?.data?.error || 'Failed to change password'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page-enter">
    <PageHeader title="Settings" description="Application configuration and account settings" />

    <div v-if="loading" class="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>

    <div v-else class="space-y-6 max-w-2xl">
      <!-- Account info -->
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Account</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-[var(--color-text-tertiary)]">Email</span>
            <span class="text-[var(--color-text-primary)]">{{ auth.email }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-tertiary)]">Token Expiry</span>
            <span class="text-[var(--color-text-primary)]">{{ settings?.jwt_expiry_hours || 24 }} hours</span>
          </div>
        </div>
      </div>

      <!-- Change password -->
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Change Password</h3>
        <form @submit.prevent="handleChangePassword" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Current Password</label>
            <input
              v-model="currentPassword"
              type="password"
              required
              class="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">New Password</label>
            <input
              v-model="newPassword"
              type="password"
              required
              class="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Confirm New Password</label>
            <input
              v-model="confirmPassword"
              type="password"
              required
              class="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
            />
          </div>

          <div v-if="passwordError" class="text-sm text-[var(--color-error-text)] bg-[var(--color-error-bg)] px-3 py-2 rounded-lg">
            {{ passwordError }}
          </div>
          <div v-if="passwordSuccess" class="text-sm text-[var(--color-success-text)] bg-[var(--color-success-bg)] px-3 py-2 rounded-lg">
            {{ passwordSuccess }}
          </div>

          <button
            type="submit"
            :disabled="saving"
            class="px-6 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
          >
            {{ saving ? 'Updating...' : 'Update Password' }}
          </button>
        </form>
      </div>

      <!-- Flush cache — admin-only. Evicting the analytics cache makes
           every subsequent dashboard request cold; gate behind a confirm. -->
      <div v-if="auth.isAdmin" class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Analytics Cache</h3>
        <p class="text-sm text-[var(--color-text-tertiary)] mb-4">Clear all cached analytics data. The next page load will fetch fresh results from the database.</p>

        <div v-if="flushError" class="text-sm text-[var(--color-error-text)] bg-[var(--color-error-bg)] px-3 py-2 rounded-lg mb-3">
          {{ flushError }}
        </div>
        <div v-if="flushSuccess" class="text-sm text-[var(--color-success-text)] bg-[var(--color-success-bg)] px-3 py-2 rounded-lg mb-3">
          {{ flushSuccess }}
        </div>

        <button
          @click="requestFlushCache"
          :disabled="flushing"
          class="px-6 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
        >
          {{ flushing ? 'Flushing...' : 'Flush Analytics Cache' }}
        </button>
      </div>

      <!-- Feature flags — admin-only read-only operational surface.
           Grouped by category so related switches sit next to each other
           and divergence from defaults is visible at a glance. -->
      <div v-if="auth.isAdmin" class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-1">Feature Flags</h3>
        <p class="text-sm text-[var(--color-text-tertiary)] mb-4">Current values of every operational env var. Editable flags can be overridden at runtime; boot-scope flags require a restart to take effect.</p>

        <SkeletonTable v-if="flagsLoading" :rows="6" />
        <ErrorState v-else-if="flagsError" :message="flagsError" :retryable="true" @retry="loadFeatureFlags" />
        <EmptyState
          v-else-if="!featureFlags.length"
          title="No feature flags"
          description="The backend registry is empty."
        />
        <div v-else class="space-y-6">
          <div v-for="group in groupedFlags" :key="group.category">
            <h4 class="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)] mb-2">
              {{ categoryLabel(group.category) }}
            </h4>
            <div class="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-lg overflow-hidden">
              <div
                v-for="flag in group.flags"
                :key="flag.key"
                class="flex items-start gap-4 px-4 py-3 bg-[var(--color-bg-card)]"
              >
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <div class="font-mono text-xs text-[var(--color-text-primary)]">{{ flag.key }}</div>
                    <span
                      v-if="flag.source === 'override'"
                      class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--color-info-soft)] text-[var(--color-info-text)] dark:bg-blue-900/30 dark:text-blue-300"
                      title="Value is overridden in the database"
                    >
                      Source: override
                    </span>
                    <span
                      v-if="flag.scope === 'boot'"
                      class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--color-warning-soft)] text-[var(--color-warning-text)] dark:bg-amber-900/30 dark:text-amber-300"
                      title="Requires a server restart to take effect"
                    >
                      Requires restart
                    </span>
                  </div>
                  <div class="text-xs text-[var(--color-text-tertiary)] mt-1 leading-relaxed">{{ flag.description }}</div>
                  <div
                    v-if="flagFeedback[flag.key]"
                    class="text-[11px] mt-1"
                    :class="flagFeedback[flag.key]!.type === 'ok' ? 'text-[var(--color-success-text)]' : 'text-[var(--color-error-text)]'"
                  >
                    {{ flagFeedback[flag.key]!.message }}
                  </div>
                </div>
                <div class="flex-shrink-0 flex flex-col items-end gap-1 min-w-[180px]">
                  <!-- Read-only flag: show current value + status only -->
                  <template v-if="!flag.editable">
                    <StatusBadge v-if="!nonBadgeStatuses.has(flag.status)" :status="flag.status" />
                    <span v-else class="font-mono text-xs text-[var(--color-text-primary)]">{{ flag.value }}</span>
                  </template>

                  <!-- Editable flag: inline control matched to value type -->
                  <template v-else>
                    <div class="flex items-center gap-2">
                      <!-- Enum: select -->
                      <select
                        v-if="inputTypeFor(flag) === 'enum'"
                        :value="draftFor(flag)"
                        @change="setDraft(flag.key, ($event.target as HTMLSelectElement).value)"
                        class="px-2 py-1 text-xs font-mono border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded"
                      >
                        <option v-for="opt in flag.allowed_values" :key="opt" :value="opt">{{ opt }}</option>
                      </select>
                      <!-- Bool: select true/false (simpler than a custom toggle) -->
                      <select
                        v-else-if="inputTypeFor(flag) === 'bool'"
                        :value="draftFor(flag)"
                        @change="setDraft(flag.key, ($event.target as HTMLSelectElement).value)"
                        class="px-2 py-1 text-xs font-mono border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded"
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                      <!-- Int -->
                      <input
                        v-else-if="inputTypeFor(flag) === 'int'"
                        type="number"
                        :value="draftFor(flag)"
                        @input="setDraft(flag.key, ($event.target as HTMLInputElement).value)"
                        class="w-24 px-2 py-1 text-xs font-mono border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded"
                      />
                      <!-- Text -->
                      <input
                        v-else
                        type="text"
                        :value="draftFor(flag)"
                        @input="setDraft(flag.key, ($event.target as HTMLInputElement).value)"
                        class="w-40 px-2 py-1 text-xs font-mono border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded"
                      />
                      <button
                        type="button"
                        :disabled="flagSaving[flag.key] || draftFor(flag) === flag.value"
                        @click="saveFlag(flag)"
                        class="px-2 py-1 text-[11px] font-medium rounded bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {{ flagSaving[flag.key] ? 'Saving...' : 'Save' }}
                      </button>
                    </div>
                    <button
                      v-if="flag.source === 'override'"
                      type="button"
                      :disabled="flagSaving[flag.key]"
                      @click="revertFlag(flag)"
                      class="text-[10px] text-[var(--color-text-muted)] underline hover:text-[var(--color-text-primary)]"
                    >
                      Reset to default
                    </button>
                  </template>
                  <span
                    v-if="flag.value !== flag.default"
                    class="text-[10px] text-[var(--color-text-muted)]"
                  >
                    Default: {{ flag.default }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :open="flushConfirmOpen"
      title="Flush analytics cache?"
      message="Every cached dashboard aggregate will be evicted. The next load of every analytics page will hit the database cold until the cache warms back up. Proceed?"
      confirm-text="Flush cache"
      cancel-text="Cancel"
      variant="danger"
      @confirm="handleFlushCache"
      @cancel="flushConfirmOpen = false"
    />
  </div>
</template>
