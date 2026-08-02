<script setup lang="ts">
// Second half of the opt-in round trip: /preferences/confirm/:shortToken.
//
// The long token in a marketing footer can only turn channels OFF (see
// PreferenceCenterPage.vue). To turn one back ON the server mails a
// short-lived, single-use token; following that link lands here, and pressing
// the button below spends it. That is the only place in the app where
// marketing consent is granted.
//
// NOTHING IS SPENT ON MOUNT. The reasoning that keeps the long token
// one-directional applies with more force here, not less: the confirmation
// email travels through the same link scanners and mail proxies, and the ones
// that execute JavaScript (Safe Links detonation, security-gateway sandboxes)
// will render this component. Because the short token is SINGLE-USE, an
// automatic POST means the scanner burns it — the channel really is turned on,
// and the human who clicks a minute later is told the link "has already been
// used". That is a lie in exactly the opposite direction from the one avoided
// at PreferenceCenterPage.vue:148. So onMounted only inspects the URL; the
// credential is spent from @click and nowhere else.
//
// The channel travels as `?channel=`. Nothing else does: the 365-day token is
// deliberately NOT threaded into this second email just to offer a link back
// to the full preference centre. A long-lived credential in a forwardable
// message, fetched by the same scanners, is a poor trade for one convenience
// link — the copy below points at the footer link the recipient already has.
// Neither the request nor this page ever sees a client id.
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import ErrorState from '@/components/ErrorState.vue'
import {
  classifyPreferenceError,
  confirmOptIn,
  isPreferenceChannel,
  type PreferenceChannel,
} from '@/api/publicPreferences'

const route = useRoute()

const CHANNEL_LABELS: Record<PreferenceChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  push: 'Push notifications',
}

function firstParam(value: unknown): string {
  const v = Array.isArray(value) ? value[0] : value
  return typeof v === 'string' ? v : ''
}

const shortToken = computed(() => firstParam(route.params.shortToken))
const channelParam = computed(() => firstParam(route.query.channel))

const channelLabel = computed(() =>
  isPreferenceChannel(channelParam.value) ? CHANNEL_LABELS[channelParam.value] : '',
)

/**
 * `awaiting` is the landing state: the link is well-formed and the token is
 * still unspent. Every other state is reached only after the user has pressed
 * the button.
 */
type State = 'awaiting' | 'sending' | 'confirmed' | 'invalid' | 'unavailable' | 'failed'
const state = ref<State>('awaiting')

const isAsking = computed(() => state.value === 'awaiting' || state.value === 'sending')

const confirmLabel = computed(() =>
  channelLabel.value ? `Yes, turn ${channelLabel.value} back on` : 'Yes, turn it back on',
)

/** A missing/garbled token or channel means the link itself is broken. */
function linkIsUsable(): boolean {
  return !!shortToken.value && isPreferenceChannel(channelParam.value)
}

/**
 * Mount-time work, and the only thing that may run without a human: read the
 * URL and decide whether it is worth offering a button at all. No request is
 * issued — a broken link is treated exactly like a rejected token rather than
 * firing something we already know the server would refuse.
 */
function inspectLink() {
  if (!linkIsUsable()) state.value = 'invalid'
}

async function confirm() {
  // Re-read and re-narrow here rather than trusting the mount-time check: this
  // is the call that spends the credential, so it validates its own inputs.
  const token = shortToken.value
  const channel = channelParam.value
  if (!token || !isPreferenceChannel(channel)) {
    state.value = 'invalid'
    return
  }
  // A double-tap on a phone must not fire two POSTs at a single-use token.
  if (state.value === 'sending') return
  state.value = 'sending'
  try {
    await confirmOptIn(token, channel)
    state.value = 'confirmed'
  } catch (e) {
    const kind = classifyPreferenceError(e)
    if (kind === 'invalid_token') state.value = 'invalid'
    else if (kind === 'optin_unavailable') state.value = 'unavailable'
    else state.value = 'failed'
  }
}

onMounted(inspectLink)
</script>

<template>
  <div class="confirm-page">
    <div class="confirm-shell">
      <header class="confirm-header">
        <p class="confirm-eyebrow">AR-PAY</p>
        <h1 class="confirm-title">Confirm your preference</h1>
      </header>

      <div v-if="isAsking" class="confirm-ask">
        <p class="confirm-ask-body">
          {{
            channelLabel
              ? `You asked us to start sending ${channelLabel} again. Nothing has changed yet — confirm below and we will turn it back on.`
              : 'You asked us to start sending on this channel again. Nothing has changed yet — confirm below and we will turn it back on.'
          }}
        </p>

        <button
          type="button"
          class="btn btn-primary confirm-cta"
          data-confirm-optin
          :disabled="state === 'sending'"
          @click="confirm"
        >
          {{ state === 'sending' ? 'Confirming…' : confirmLabel }}
        </button>

        <p class="confirm-ask-foot">
          This link can only be used once. If you did not ask for this, close this page — nothing
          will change.
        </p>
      </div>

      <div v-else-if="state === 'confirmed'" class="confirm-ok" role="status">
        <p class="confirm-ok-title">
          {{ channelLabel ? `${channelLabel} is back on.` : 'That channel is back on.' }}
        </p>
        <p class="confirm-ok-body">
          Thank you for confirming — we will start sending again on this channel. You can turn
          it off at any time from the preferences link in any of our emails.
        </p>
      </div>

      <ErrorState
        v-else-if="state === 'invalid'"
        message="This confirmation link has expired or has already been used. Confirmation links are valid for a short time and can only be opened once — request a new one from your preference centre."
      />

      <ErrorState
        v-else-if="state === 'unavailable'"
        message="We cannot complete this confirmation right now because our email service is unavailable. Nothing has changed — please try this link again later."
        retryable
        @retry="confirm"
      />

      <ErrorState
        v-else
        message="We could not complete this confirmation. Nothing has changed — please try again."
        retryable
        @retry="confirm"
      />

      <p v-if="!isAsking" class="confirm-foot">
        You can manage all your preferences from the link at the bottom of any recent email
        from us.
      </p>
    </div>
  </div>
</template>

<style scoped>
.confirm-page {
  min-height: 100vh;
  background: var(--color-bg-page);
  padding: 48px 16px 64px;
  display: flex;
  justify-content: center;
}
@media (max-width: 640px) {
  .confirm-page { padding: 28px 14px 48px; }
}

.confirm-shell {
  width: 100%;
  max-width: 520px;
}

.confirm-header { margin-bottom: 24px; }
.confirm-eyebrow {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
.confirm-title {
  margin-top: 10px;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: clamp(26px, 5.5vw, 36px);
  line-height: 1.08;
  letter-spacing: -0.025em;
  color: var(--color-text-primary);
}

/* ── The ask ────────────────────────────────────────────── */
.confirm-ask {
  padding: 24px 22px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
@media (max-width: 640px) {
  .confirm-ask { padding: 20px 16px; }
}
.confirm-ask-body {
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}
.confirm-cta {
  margin-top: 18px;
  /* Full width on a phone; the whole audience for this page is in a mail
     client on a small screen, and a 44px target is the floor. */
  width: 100%;
  min-height: 44px;
  justify-content: center;
  /* Long channel names ("Push notifications") must wrap rather than push the
     button past the viewport. */
  white-space: normal;
  word-break: break-word;
}
.confirm-ask-foot {
  margin-top: 14px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--color-text-muted);
}

.confirm-ok {
  padding: 28px 22px;
  text-align: center;
  background: var(--color-success-bg);
  border: 1px solid var(--color-success-border);
  border-radius: var(--radius-lg);
  color: var(--color-success-text);
}
.confirm-ok-title {
  font-size: 16px;
  font-weight: 500;
}
.confirm-ok-body {
  margin: 8px auto 0;
  max-width: 400px;
  font-size: 13px;
  line-height: 1.55;
}

.confirm-foot {
  margin-top: 18px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-muted);
}
</style>
