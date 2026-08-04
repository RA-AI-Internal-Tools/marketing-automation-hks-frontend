<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { XMarkIcon, EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'
import ConfirmDialog from './ConfirmDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import {
  INTEGRATION_TEST_STATUS,
  classifyTestProbeError,
  type IntegrationTestOutcome,
} from '@/constants/integrationTestStatus'
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
  /** Initial env tab to open (defaults to production — the only writable env). */
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
// The live deployment is a SINGLE api container pinned to
// MA_ENVIRONMENT=production (collapsed 2026-07-30). enforceEnvScope
// (internal/api/routes_integrations.go:440) rejects every credential read AND
// write whose `environment` != the instance's own env with a 400
// ("this instance manages env=production; refusing to write to sandbox"), so a
// sandbox tab cannot succeed at anything. Default to production and disable the
// sandbox tab rather than offering an option that only ever errors.
const WRITABLE_ENVIRONMENTS: Environment[] = ['production']
function envSelectable(env: Environment): boolean {
  return WRITABLE_ENVIRONMENTS.includes(env)
}
const environment = ref<Environment>('production')

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

// Stable DOM id per (provider, env, field) so each <label> can be associated
// with its control via for/id. Without the association the visible label text
// is not the control's accessible name: screen readers announce an unnamed
// textbox, clicking the label doesn't focus the input, and `getByLabel()` —
// which e2e/README.md tells every spec to prefer — matches nothing. e2e/
// credentials.spec.ts relied on `getByLabel(/api.?key/i)` and silently found
// no field.
function fieldId(keyName: string): string {
  return `cred-${providerKey.value || 'unknown'}-${environment.value}-${keyName}`
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
    // Ignore a caller-supplied env that this instance cannot serve.
    const requested = props.initialEnvironment
    environment.value = requested && envSelectable(requested) ? requested : 'production'
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
const testResult = ref<IntegrationTestOutcome | null>(null)

// ---- Throttle countdown ---------------------------------------------------
// Both probe routes are capped at 5 requests/minute per (principal, provider)
// by `testLimiter` (internal/api/routes_integrations.go). On refusal the
// middleware returns 429 + retry_after; we hold the button closed for that long
// rather than only printing a message.
//
// Disabling is the right shape here for two reasons. (1) It matches how this
// component already expresses "this action cannot succeed right now" — the
// sandbox env tab and the Test button under test_supported:false are both
// :disabled + :title, not prose. (2) It is not merely cosmetic: the middleware
// runs `INCR` and then `EXPIRE key window` unconditionally, BEFORE the
// `count > max` check, so every refused request refreshes the Redis TTL to the
// full window. An operator hammering a still-enabled button would keep pushing
// their own unlock further away and never understand why.
//
// The countdown only engages when the server actually supplied a duration.
// A 429 with no retry_after leaves the button live and shows the message alone
// — better than inventing a number that expires early into another refusal.
const retryAfterAt = ref<number | null>(null)
const nowMs = ref(Date.now())
let retryTicker: ReturnType<typeof setInterval> | null = null

function stopRetryTicker() {
  if (retryTicker !== null) {
    clearInterval(retryTicker)
    retryTicker = null
  }
}

const retryAfterSeconds = computed(() => {
  if (retryAfterAt.value === null) return 0
  return Math.max(0, Math.ceil((retryAfterAt.value - nowMs.value) / 1000))
})
const throttled = computed(() => retryAfterSeconds.value > 0)

function startRetryCountdown(seconds: number | undefined) {
  if (seconds === undefined) return
  stopRetryTicker()
  nowMs.value = Date.now()
  retryAfterAt.value = nowMs.value + seconds * 1000
  retryTicker = setInterval(() => {
    nowMs.value = Date.now()
    if (retryAfterAt.value !== null && nowMs.value >= retryAfterAt.value) {
      clearRetryCountdown()
    }
  }, 1000)
}

function clearRetryCountdown() {
  stopRetryTicker()
  retryAfterAt.value = null
  // The banner sentence is frozen into `detail` at classification time
  // (rateLimitedDetail), unlike the button label which reads the live
  // retryAfterSeconds computed. So without this the button recovers to "Test
  // connection" while the banner still reads "Try again in 7s." — drop the
  // throttle result outright, since once the window has passed there is
  // nothing left to report. Only the throttle result: a real ok/error/
  // not_configured/not_supported outcome is still the last thing that
  // happened and must survive.
  if (testResult.value?.status === INTEGRATION_TEST_STATUS.RATE_LIMITED) {
    testResult.value = null
  }
}

// The throttle bucket is keyed per (principal, provider) server-side, so a
// countdown earned on provider A must not disable the button for provider B.
// It deliberately DOES survive closing and reopening the modal on the same
// provider — the server-side window does.
watch(providerKey, () => clearRetryCountdown())
onUnmounted(() => stopRetryTicker())

// Tone per probe outcome, keyed by the shared vocabulary so a state cannot be
// styled here under a name the vocabulary does not have. rate_limited gets the
// info (blue) tokens already used elsewhere for transient, non-fault states
// (StatusBadge: waiting / processing / gate_unavailable) — it is neither a
// fault (red `error`) nor something the operator must supply (amber
// `not_configured`); it is "come back shortly".
//
// The fallback below is load-bearing: `status` on the 200 path is whatever the
// server sent, unvalidated, so an unrecognised value must read as a failure
// rather than fall through to an unstyled div.
const TEST_RESULT_TONES: Readonly<Record<string, string>> = Object.freeze({
  [INTEGRATION_TEST_STATUS.OK]:
    'bg-[var(--color-success-bg)] border-[var(--color-success-border)] text-[var(--color-success-text)]',
  [INTEGRATION_TEST_STATUS.NOT_SUPPORTED]:
    'bg-[var(--color-bg-subtle)] border-[var(--color-border)] text-[var(--color-text-tertiary)]',
  [INTEGRATION_TEST_STATUS.NOT_CONFIGURED]:
    'bg-[var(--color-warning-bg)] border-[var(--color-warning-border)] text-[var(--color-warning-text)]',
  [INTEGRATION_TEST_STATUS.RATE_LIMITED]:
    'bg-[var(--color-info-bg)] border-[var(--color-info-border)] text-[var(--color-info-text)]',
  [INTEGRATION_TEST_STATUS.ERROR]:
    'bg-[var(--color-error-bg)] border-[var(--color-error-border)] text-[var(--color-error-text)]',
})
const FAILURE_TONE = TEST_RESULT_TONES[INTEGRATION_TEST_STATUS.ERROR]!
const testResultTone = computed(() => {
  const status = testResult.value?.status
  if (status === undefined) return FAILURE_TONE
  return TEST_RESULT_TONES[status] ?? FAILURE_TONE
})

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
  // Belt to the :disabled brace. A click that the throttle would refuse must
  // not reach the server at all: the middleware re-EXPIREs the bucket on every
  // request it rejects, so an extra probe here lengthens the operator's wait.
  if (throttled.value) return
  testing.value = true
  testResult.value = null
  try {
    testResult.value = await testIntegration(providerKey.value, environment.value)
  } catch (e: unknown) {
    // classifyTestProbeError owns the 429-vs-everything-else decision. It
    // answers `rate_limited` for a throttled probe (NOT a failed test — the
    // integration was never contacted) and `error` for a genuine fault. Note
    // src/api/client.ts's response interceptor branches on 401 only, so a 429
    // arrives here untouched with its body and headers intact.
    const outcome = classifyTestProbeError(e)
    testResult.value = outcome
    if (outcome.status === INTEGRATION_TEST_STATUS.RATE_LIMITED) {
      startRetryCountdown(outcome.retryAfterSeconds)
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
        <div data-test="integration-form" class="relative bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-xl w-full max-w-xl max-h-[85vh] overflow-y-auto">
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
              <!-- Sandbox is rendered but disabled: this instance manages
                   production only, so selecting it would just produce 400s
                   from enforceEnvScope. Kept visible (rather than removed) so
                   operators can see why it is unavailable. -->
              <button
                v-for="envOpt in (['sandbox', 'production'] as Environment[])"
                :key="envOpt"
                type="button"
                role="tab"
                :aria-selected="environment === envOpt"
                :disabled="!envSelectable(envOpt)"
                :aria-disabled="!envSelectable(envOpt)"
                :title="envSelectable(envOpt)
                  ? undefined
                  : 'This deployment manages the production environment only.'"
                :data-test="`env-tab-${envOpt}`"
                @click="envSelectable(envOpt) && (environment = envOpt)"
                :class="[
                  'px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors',
                  !envSelectable(envOpt)
                    ? 'text-[var(--color-text-muted)] opacity-50 cursor-not-allowed'
                    : environment === envOpt
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
                <label :for="fieldId(f.key_name)" class="block text-sm font-medium text-[var(--color-text-secondary)]">
                  {{ f.label }}
                </label>
                <!-- Present iff the SERVER returned a stored row for this key
                     on the last reloadRows(). That makes it the honest
                     "the write persisted" / "the delete took" signal for
                     e2e/credentials.spec.ts — it survives a re-read, unlike a
                     toast. -->
                <span
                  v-if="rowFor(f.key_name)"
                  :data-test="`cred-stored-${f.key_name}`"
                  class="text-[11px] text-[var(--color-text-muted)]"
                >
                  Rotated: {{ relativeTime(rowFor(f.key_name)!.updated_at) }}
                </span>
              </div>

              <!-- Multiline secret -->
              <template v-if="f.multiline">
                <textarea
                  :id="fieldId(f.key_name)"
                  :data-test="`cred-field-${f.key_name}`"
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
                    :id="fieldId(f.key_name)"
                    :data-test="`cred-field-${f.key_name}`"
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
            <!-- POST /credentials/:provider/test (probeProvider,
                 internal/api/routes_integrations.go) answers exactly one of
                 four `status` values: ok | error | not_configured |
                 not_supported. not_configured means "no probe ran because
                 the credential is empty" — not a failure, so it must not
                 render in the same red as `error`. It is deliberately
                 distinct from not_supported (grey, "no probe exists for this
                 provider at all"): amber here says the operator can fix it
                 by filling in the field above.

                 A fifth outcome, rate_limited, exists only on the client: it
                 is synthesised from the 429 the shared testLimiter returns
                 (see src/constants/integrationTestStatus.ts), because a probe
                 the throttle refused to run is not a probe result and the
                 server therefore has no `status` to report. Blue, not red:
                 nothing about the integration is broken. Tone lookup lives in
                 <script> so the chain does not grow a branch per state. -->
            <div
              v-if="testResult"
              data-test="test-result"
              role="status"
              :class="['text-xs px-3 py-2 rounded-lg border', testResultTone]"
            >
              <!-- Falls back to the error vocabulary member rather than
                   dereferencing `status` directly: the 200 path assigns the
                   server's `status` through unvalidated, so an absent one used
                   to throw HERE — before testResultTone's `status === undefined
                   -> FAILURE_TONE` guard could colour anything — taking the
                   whole banner down with an unhandled rejection. -->
              <strong class="capitalize"
                >{{ (testResult.status || INTEGRATION_TEST_STATUS.ERROR).replace('_', ' ') }}:</strong
              >
              {{ testResult.detail }}
            </div>

            <!-- Passive "why is Test disabled" note — visible before the
                 operator ever clicks, not just after (see test-result above,
                 which only appears post-click). Uses the DTO fields carried
                 on the catalog row itself (test_supported /
                 test_unsupported_reason), independent of whatever the last
                 click returned. -->
            <div
              v-if="integration && integration.test_supported === false"
              data-test="test-unsupported-note"
              class="text-xs px-3 py-2 rounded-lg border bg-[var(--color-bg-subtle)] border-[var(--color-border)] text-[var(--color-text-tertiary)]"
            >
              Testing is not supported for this integration<template v-if="integration.test_unsupported_reason">: {{ integration.test_unsupported_reason }}</template>.
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
                :disabled="testing || !providerKey || integration?.test_supported === false || throttled"
                :title="integration?.test_supported === false
                  ? (integration.test_unsupported_reason || 'No automated test is supported for this integration')
                  : throttled
                    ? `Rate limited — this integration allows 5 tests per minute. Try again in ${retryAfterSeconds}s.`
                    : undefined"
                @click="handleTest"
              >
                {{ testing ? 'Testing…' : throttled ? `Retry in ${retryAfterSeconds}s` : 'Test connection' }}
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
