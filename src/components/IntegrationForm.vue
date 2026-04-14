<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { XMarkIcon, EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'
import ConfirmDialog from './ConfirmDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import {
  listCredentials,
  upsertCredential,
  deleteCredential,
  testIntegration,
  type CredentialRow,
  type Environment,
} from '@/api/integrations'
import { getKeyFields, type KeyField } from '@/api/integrationKeys'
import type { Integration } from '@/api/types'

const props = defineProps<{
  visible: boolean
  /**
   * Provider key (e.g. "openai", "ses") — must match a key in INTEGRATION_KEYS.
   * If omitted, derived from integration.name via lower-case + snake_case.
   */
  provider?: string
  /** Optional: the catalog row, used for displaying title/metadata only. */
  integration?: Integration | null
  /** Initial env tab to open (defaults to sandbox). */
  initialEnvironment?: Environment
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
}>()

const auth = useAuthStore()
const { showToast } = useToast()

// ---- Provider resolution --------------------------------------------------
function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}
// Prefer the backend-provided provider_slug (stable, matches
// integrationKeys.ts). Fall back to slugifying the name only for
// older responses that don't yet carry the field.
const providerKey = computed<string>(() =>
  props.provider
    || props.integration?.provider_slug
    || (props.integration ? slugify(props.integration.name) : ''),
)
const fields = computed<KeyField[]>(() => getKeyFields(providerKey.value))
const title = computed(() =>
  props.integration?.name ? `Configure ${props.integration.name}` : `Configure ${providerKey.value || 'Integration'}`,
)

// ---- Environment tab ------------------------------------------------------
const environment = ref<Environment>('sandbox')

// ---- Credential metadata --------------------------------------------------
const rows = ref<CredentialRow[]>([])
const loadingRows = ref(false)
// Monotonic sequence to drop stale reloadRows() responses (rapid env tab flips)
// before they overwrite the current view.
const reloadSeq = ref(0)

async function reloadRows() {
  if (!auth.isAdmin) return
  const mySeq = ++reloadSeq.value
  loadingRows.value = true
  try {
    const res = await listCredentials(environment.value)
    if (mySeq !== reloadSeq.value) return
    rows.value = res
  } catch (e: any) {
    if (mySeq !== reloadSeq.value) return
    showToast(e.response?.data?.error || 'Failed to load credentials', 'error')
  } finally {
    if (mySeq === reloadSeq.value) loadingRows.value = false
  }
}

function rowFor(keyName: string): CredentialRow | undefined {
  return rows.value.find(
    r => r.provider === providerKey.value && r.environment === environment.value && r.key_name === keyName,
  )
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diffMs / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

// ---- Form state -----------------------------------------------------------
// keyed by `${environment}:${key_name}` so switching env tabs doesn't wipe
// the other env's unsaved input.
const values = ref<Record<string, string>>({})
const revealed = ref<Record<string, boolean>>({})

function valKey(keyName: string): string {
  return `${environment.value}:${keyName}`
}
function getValue(keyName: string): string {
  return values.value[valKey(keyName)] ?? ''
}
function setValue(keyName: string, v: string) {
  values.value[valKey(keyName)] = v
}
function toggleReveal(keyName: string) {
  const k = valKey(keyName)
  revealed.value[k] = !revealed.value[k]
}
function isRevealed(keyName: string): boolean {
  return !!revealed.value[valKey(keyName)]
}

// ---- Lifecycle ------------------------------------------------------------
// Remember the provider key from the last time the modal was opened, so
// reopening the same provider (e.g. after an accidental backdrop click)
// preserves typed-but-unsaved values.
const lastShownProviderKey = ref<string | null>(null)
watch(() => props.visible, (v) => {
  if (v) {
    if (lastShownProviderKey.value !== providerKey.value) {
      values.value = {}
      revealed.value = {}
      lastShownProviderKey.value = providerKey.value
    }
    environment.value = props.initialEnvironment ?? 'sandbox'
    reloadRows()
  }
})

// Refetch credentials when the env tab flips inside the modal.
watch(environment, () => {
  if (props.visible) reloadRows()
})

// ---- Actions --------------------------------------------------------------
const saving = ref(false)
const testing = ref(false)
const testResult = ref<{ status: string; detail: string } | null>(null)

async function handleSave() {
  if (!auth.isAdmin) {
    showToast('Admin role required', 'error')
    return
  }
  const touched = fields.value.filter(f => getValue(f.key_name).trim() !== '')
  if (touched.length === 0) {
    showToast('Nothing to save — enter at least one value', 'info')
    return
  }
  saving.value = true
  try {
    // Use allSettled so a mid-list failure doesn't silently hide successful
    // writes to earlier fields — previously a field-2 error would surface
    // only that error while field 1 was already persisted.
    const results = await Promise.allSettled(
      touched.map(f =>
        upsertCredential({
          provider: providerKey.value,
          environment: environment.value,
          key_name: f.key_name,
          value: getValue(f.key_name),
        }),
      ),
    )
    const succeeded: typeof touched = []
    const failed: { field: string; reason: string }[] = []
    let restartRequired = false
    let restartNote = ''
    results.forEach((r, i) => {
      const f = touched[i]!
      if (r.status === 'fulfilled') {
        succeeded.push(f)
        if (r.value?.requires_restart) {
          restartRequired = true
          if (r.value.note) restartNote = r.value.note
        }
      } else {
        const err: any = r.reason
        failed.push({
          field: f.key_name,
          reason: err?.response?.data?.error || err?.message || 'request failed',
        })
      }
    })
    // clear typed values for fields that actually persisted
    for (const f of succeeded) setValue(f.key_name, '')
    if (failed.length === 0) {
      showToast(`Saved ${succeeded.length} credential${succeeded.length === 1 ? '' : 's'}`, 'success')
    } else if (succeeded.length === 0) {
      showToast(`Failed to save: ${failed.map(f => `${f.field} (${f.reason})`).join('; ')}`, 'error')
    } else {
      const failedList = failed.map(f => `${f.field} (${f.reason})`).join('; ')
      showToast(
        `Saved ${succeeded.length} of ${touched.length} fields. Failed: ${failedList}`,
        'warning',
      )
    }
    // Only surface the restart hint when at least one field actually
    // persisted — otherwise the modal just showed an error toast.
    if (succeeded.length > 0 && restartRequired) {
      showToast(
        restartNote
          || 'Saved. Channel senders read credentials at boot — restart the api container to use the new value.',
        'warning',
        8000,
      )
    }
    await reloadRows()
    if (succeeded.length > 0) emit('saved')
  } finally {
    saving.value = false
  }
}

async function handleTest() {
  if (!auth.isAdmin) {
    showToast('Admin role required', 'error')
    return
  }
  testing.value = true
  testResult.value = null
  try {
    testResult.value = await testIntegration(providerKey.value, environment.value)
  } catch (e: any) {
    testResult.value = {
      status: 'failed',
      detail: e.response?.data?.error || e.message || 'Request failed',
    }
  } finally {
    testing.value = false
  }
}

const confirmDeleteOpen = ref(false)
function openDelete() { confirmDeleteOpen.value = true }
async function handleDelete() {
  confirmDeleteOpen.value = false
  if (!auth.isAdmin) {
    showToast('Admin role required', 'error')
    return
  }
  const existing = rows.value.filter(
    r => r.provider === providerKey.value && r.environment === environment.value,
  )
  if (existing.length === 0) {
    showToast('No stored credentials to delete for this environment', 'info')
    return
  }
  // Use allSettled so partial delete failures surface per-field rather
  // than aborting on the first rejection.
  const results = await Promise.allSettled(
    existing.map(r =>
      deleteCredential({
        provider: providerKey.value,
        environment: environment.value,
        key_name: r.key_name,
      }),
    ),
  )
  const failed: { field: string; reason: string }[] = []
  let succeeded = 0
  let restartRequired = false
  let restartNote = ''
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      succeeded++
      if (r.value?.requires_restart) {
        restartRequired = true
        if (r.value.note) restartNote = r.value.note
      }
    } else {
      const err: any = r.reason
      failed.push({
        field: existing[i]!.key_name,
        reason: err?.response?.data?.error || err?.message || 'request failed',
      })
    }
  })
  if (failed.length === 0) {
    showToast(`Deleted ${succeeded} credential${succeeded === 1 ? '' : 's'}`, 'success')
  } else if (succeeded === 0) {
    showToast(`Failed to delete: ${failed.map(f => `${f.field} (${f.reason})`).join('; ')}`, 'error')
  } else {
    const failedList = failed.map(f => `${f.field} (${f.reason})`).join('; ')
    showToast(
      `Deleted ${succeeded} of ${existing.length} fields. Failed: ${failedList}`,
      'warning',
    )
  }
  if (succeeded > 0 && restartRequired) {
    showToast(
      restartNote
        || 'Saved. Channel senders read credentials at boot — restart the api container to use the new value.',
      'warning',
      8000,
    )
  }
  await reloadRows()
  if (succeeded > 0) emit('saved')
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="visible" class="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center p-4 pt-20">
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')" />
        <div class="relative bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-xl w-full max-w-xl max-h-[85vh] overflow-y-auto">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
            <h2 class="text-base font-semibold text-[var(--color-text-primary)]">{{ title }}</h2>
            <button @click="emit('close')" class="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors" aria-label="Close">
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <!-- Environment tab bar -->
          <div class="px-6 pt-4">
            <div role="tablist" aria-label="Environment" class="inline-flex items-center gap-1 p-1 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)]">
              <button
                v-for="envOpt in (['sandbox', 'production'] as Environment[])"
                :key="envOpt"
                type="button"
                role="tab"
                :aria-selected="environment === envOpt"
                :data-test="`env-tab-${envOpt}`"
                @click="environment = envOpt"
                :class="[
                  'px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors',
                  environment === envOpt
                    ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                    : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]',
                ]"
              >
                {{ envOpt }}
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="p-6 space-y-4">
            <div v-if="!auth.isAdmin" class="px-3 py-2 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-xs text-[var(--color-text-tertiary)]">
              Credentials are managed by admins. This view is read-only.
            </div>

            <div v-if="fields.length === 0" class="px-3 py-4 rounded-lg border border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-tertiary)]">
              No credential schema is defined for provider
              <code class="font-mono">{{ providerKey || '(unknown)' }}</code>.
            </div>

            <div v-for="f in fields" :key="f.key_name" class="space-y-1">
              <div class="flex items-baseline justify-between gap-2">
                <label class="block text-sm font-medium text-[var(--color-text-secondary)]">
                  {{ f.label }}
                </label>
                <span v-if="rowFor(f.key_name)" class="text-[11px] text-[var(--color-text-muted)]">
                  Rotated: {{ relativeTime(rowFor(f.key_name)!.updated_at) }}
                </span>
              </div>

              <!-- Multiline secret -->
              <template v-if="f.multiline">
                <textarea
                  :value="getValue(f.key_name)"
                  @input="(e) => setValue(f.key_name, (e.target as HTMLTextAreaElement).value)"
                  :disabled="!auth.isAdmin"
                  rows="5"
                  :placeholder="rowFor(f.key_name) ? '•••••••• (stored)' : (f.hint || '')"
                  class="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 placeholder:text-[var(--color-text-muted)] disabled:opacity-60"
                />
              </template>

              <!-- Single-line -->
              <template v-else>
                <div class="relative">
                  <input
                    :value="getValue(f.key_name)"
                    @input="(e) => setValue(f.key_name, (e.target as HTMLInputElement).value)"
                    :disabled="!auth.isAdmin"
                    :type="f.secret && !isRevealed(f.key_name) ? 'password' : 'text'"
                    :placeholder="rowFor(f.key_name) ? '•••••••• (stored)' : (f.hint || '')"
                    :class="[
                      'w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 placeholder:text-[var(--color-text-muted)] disabled:opacity-60',
                      f.secret ? 'pr-10' : '',
                    ]"
                  />
                  <button
                    v-if="f.secret"
                    type="button"
                    @click="toggleReveal(f.key_name)"
                    class="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    :aria-label="isRevealed(f.key_name) ? 'Hide' : 'Show'"
                    :title="isRevealed(f.key_name) ? 'Hide' : 'Show'"
                  >
                    <EyeSlashIcon v-if="isRevealed(f.key_name)" class="h-4 w-4" />
                    <EyeIcon v-else class="h-4 w-4" />
                  </button>
                </div>
              </template>
            </div>

            <!-- Test result -->
            <div
              v-if="testResult"
              :class="[
                'text-xs px-3 py-2 rounded-lg border',
                testResult.status === 'ok'
                  ? 'bg-[var(--color-success-bg)] border-[var(--color-success-border)] text-[var(--color-success-text)]'
                  : testResult.status === 'not_supported'
                    ? 'bg-[var(--color-bg-subtle)] border-[var(--color-border)] text-[var(--color-text-tertiary)]'
                    : 'bg-[var(--color-error-bg)] border-[var(--color-error-border)] text-[var(--color-error-text)]',
              ]"
            >
              <strong class="capitalize">{{ testResult.status.replace('_', ' ') }}:</strong>
              {{ testResult.detail }}
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between gap-2 px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-page)]">
            <button
              v-if="auth.isAdmin"
              type="button"
              data-test="delete-all-btn"
              class="btn btn-danger btn-sm"
              @click="openDelete"
            >
              Delete all for this environment
            </button>
            <span v-else />

            <div class="flex items-center gap-2">
              <button type="button" class="btn btn-ghost" @click="emit('close')">Close</button>
              <button
                v-if="auth.isAdmin"
                type="button"
                data-test="test-connection-btn"
                class="btn btn-ghost"
                :disabled="testing || !providerKey"
                @click="handleTest"
              >
                {{ testing ? 'Testing…' : 'Test connection' }}
              </button>
              <button
                v-if="auth.isAdmin"
                type="button"
                data-test="save-btn"
                class="btn btn-primary"
                :disabled="saving || fields.length === 0"
                @click="handleSave"
              >
                {{ saving ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <ConfirmDialog
    :open="confirmDeleteOpen"
    title="Delete all credentials?"
    :message="`This removes every stored credential for ${providerKey} in the ${environment} environment. This cannot be undone.`"
    variant="danger"
    confirm-text="Delete"
    @confirm="handleDelete"
    @cancel="confirmDeleteOpen = false"
  />
</template>
