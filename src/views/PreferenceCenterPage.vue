<script setup lang="ts">
// Public preference centre — reached from the footer of a marketing email.
//
// IDENTITY COMES FROM THE TOKEN, NOTHING ELSE. The previous version read
// `?client_id=` off the query string and posted it as the subject of every
// consent write, which let anyone edit anyone's preferences by incrementing
// an integer. There is no client id anywhere in this file or in
// @/api/publicPreferences; the server resolves the subject from the token.
//
// A LONG TOKEN CANNOT GRANT CONSENT. The token in a marketing footer lives
// for 365 days, is mailed to everyone, and gets dereferenced by link scanners
// and mail proxies that follow URLs without a human involved. So it is
// one-directional: it can read state and turn channels OFF. Turning a channel
// back ON always goes through a confirm-by-email round trip
// (request-optin -> emailed short token -> PreferenceConfirmPage). The toggle
// therefore does NOT flip when the user switches something on — the change
// has not happened yet, and showing it as done would be a lie.
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ErrorState from '@/components/ErrorState.vue'
import {
  PREFERENCE_CHANNELS,
  classifyPreferenceError,
  fetchPreferences,
  optOutChannel,
  requestOptIn,
  type ChannelStates,
  type PreferenceChannel,
} from '@/api/publicPreferences'

const route = useRoute()

const CHANNEL_META: Record<PreferenceChannel, { label: string; description: string }> = {
  email: {
    label: 'Email',
    description: 'Offers, product news, cart reminders and order updates by email.',
  },
  sms: {
    label: 'SMS',
    description: 'Text-message alerts and time-sensitive offers.',
  },
  whatsapp: {
    label: 'WhatsApp',
    description: 'Order updates and support conversations on WhatsApp.',
  },
  push: {
    label: 'Push notifications',
    description: 'Browser and mobile push notifications.',
  },
}

/**
 * `/preferences/:token` is canonical. `?token=` is still accepted because
 * emails sent before the path form existed are in inboxes for a year.
 */
const token = computed(() => {
  const fromPath = route.params.token
  const path = Array.isArray(fromPath) ? fromPath[0] : fromPath
  if (path) return path
  const fromQuery = route.query.token
  const query = Array.isArray(fromQuery) ? fromQuery[0] : fromQuery
  return typeof query === 'string' ? query : ''
})

type LoadState = 'loading' | 'ready' | 'expired' | 'failed'
const loadState = ref<LoadState>('loading')

const states = ref<ChannelStates>({ email: false, sms: false, whatsapp: false, push: false })

/**
 * Per-channel, not page-wide. A single shared `saving` flag would let a slow
 * SMS request block the email toggle, and — worse — let two clicks on the
 * same row interleave. Each row is independently locked while its own
 * request is open.
 */
const pending = ref<Record<PreferenceChannel, boolean>>({
  email: false, sms: false, whatsapp: false, push: false,
})

type Notice = { kind: 'saved' | 'confirm-sent' | 'unavailable' | 'error'; text: string }
const notices = ref<Record<PreferenceChannel, Notice | null>>({
  email: null, sms: null, whatsapp: null, push: null,
})

/**
 * A confirmation email has gone out for this channel and the round trip is
 * now the user's to finish in their inbox.
 *
 * `pending` clears the moment the request settles, which used to leave a live
 * switch under the "check your email" notice — one more tap and another email
 * goes out, and another, with nothing on screen suggesting the first one
 * worked. The backend rate limiter is the real control; this stops the
 * accidental repeat entirely by retiring the switch for that row and offering
 * one deliberate, quieter "resend" instead. No timer: the point is to prevent
 * a mis-tap, not to lock anyone out of a mail that genuinely never arrived.
 */
const requested = ref<Record<PreferenceChannel, boolean>>({
  email: false, sms: false, whatsapp: false, push: false,
})

const channels = computed(() =>
  PREFERENCE_CHANNELS.map((channel) => {
    const label = CHANNEL_META[channel].label
    const on = states.value[channel]
    const awaitingConfirm = requested.value[channel]
    return {
      channel,
      ...CHANNEL_META[channel],
      on,
      busy: pending.value[channel],
      notice: notices.value[channel],
      awaitingConfirm,
      ariaLabel: awaitingConfirm
        ? `${label} is off — a confirmation email has been sent`
        : on
          ? `Turn off ${label}`
          : `Turn on ${label}`,
    }
  }),
)

async function load() {
  if (!token.value) {
    // No token at all is indistinguishable, from the user's side, from a
    // token the server rejected — same message, same next action.
    loadState.value = 'expired'
    return
  }
  loadState.value = 'loading'
  // A reload re-reads the truth from the server, so any "we emailed you"
  // state from the previous render is stale by definition.
  requested.value = { email: false, sms: false, whatsapp: false, push: false }
  try {
    states.value = await fetchPreferences(token.value)
    loadState.value = 'ready'
  } catch (e) {
    loadState.value = classifyPreferenceError(e) === 'invalid_token' ? 'expired' : 'failed'
  }
}

function onToggle(channel: PreferenceChannel) {
  if (pending.value[channel]) return
  // The switch is retired once a confirmation email is out; the only way to
  // fire another is the explicit resend control.
  if (requested.value[channel]) return
  return states.value[channel] ? turnOff(channel) : askToTurnOn(channel)
}

async function turnOff(channel: PreferenceChannel) {
  const label = CHANNEL_META[channel].label
  pending.value[channel] = true
  notices.value[channel] = null
  // Optimistic: switching something off should feel instant, and the revert
  // below puts it back if the server disagrees.
  states.value[channel] = false
  try {
    await optOutChannel(token.value, channel)
    notices.value[channel] = { kind: 'saved', text: `${label} turned off.` }
  } catch (e) {
    states.value[channel] = true
    const kind = classifyPreferenceError(e)
    if (kind === 'invalid_token') {
      loadState.value = 'expired'
    } else {
      notices.value[channel] = {
        kind: 'error',
        text: `We could not turn off ${label}. Nothing has changed — please try again.`,
      }
    }
  } finally {
    pending.value[channel] = false
  }
}

async function askToTurnOn(channel: PreferenceChannel, opts: { resend?: boolean } = {}) {
  const label = CHANNEL_META[channel].label
  pending.value[channel] = true
  notices.value[channel] = null
  try {
    await requestOptIn(token.value, channel)
    // NOTE: states.value[channel] stays false. The opt-in is not complete
    // until the emailed link is followed.
    requested.value[channel] = true
    notices.value[channel] = opts.resend
      ? {
          kind: 'confirm-sent',
          text: `Sent again — we have sent another confirmation link for ${label} to your inbox. It stays off until you open that link.`,
        }
      : {
          kind: 'confirm-sent',
          text: `Check your email — we have sent a confirmation to your inbox to turn on ${label}. It stays off until you open that link.`,
        }
  } catch (e) {
    const kind = classifyPreferenceError(e)
    if (kind === 'invalid_token') {
      loadState.value = 'expired'
    } else if (kind === 'optin_unavailable') {
      // Say so plainly. Rendering a cheerful "check your email" for a mail
      // sender that is down leaves the user waiting for a message that will
      // never arrive.
      notices.value[channel] = {
        kind: 'unavailable',
        text: `We cannot send confirmation emails at the moment, so ${label} has not been turned on. Please try again later.`,
      }
    } else {
      notices.value[channel] = {
        kind: 'error',
        text: `We could not request confirmation for ${label}. Please try again.`,
      }
    }
  } finally {
    pending.value[channel] = false
  }
}

onMounted(load)
// The confirm page routes back here with the same long token; re-read when it
// changes so the page does not show stale state after that round trip.
watch(token, load)
</script>

<template>
  <div class="pref-page">
    <div class="pref-shell">
      <header class="pref-header">
        <p class="pref-eyebrow">AR-PAY</p>
        <h1 class="pref-title">Notification preferences</h1>
        <p class="pref-sub">Choose how we get in touch. Changes save as you make them.</p>
      </header>

      <p v-if="loadState === 'loading'" class="pref-loading" role="status">
        Loading your preferences…
      </p>

      <ErrorState
        v-else-if="loadState === 'expired'"
        message="This link has expired or is no longer valid. Open the preferences link in any recent email from us to manage your notifications."
      />

      <ErrorState
        v-else-if="loadState === 'failed'"
        message="We could not load your preferences just now. This is a problem on our side, not a change to your settings."
        retryable
        @retry="load"
      />

      <div v-else class="pref-list">
        <div
          v-for="row in channels"
          :key="row.channel"
          class="pref-row"
          :data-channel="row.channel"
        >
          <div class="pref-row-main">
            <div class="pref-row-text">
              <div class="pref-row-label">{{ row.label }}</div>
              <p class="pref-row-desc">{{ row.description }}</p>
            </div>

            <button
              type="button"
              role="switch"
              class="pref-switch"
              :class="{ 'is-on': row.on, 'is-busy': row.busy, 'is-settled': row.awaitingConfirm }"
              :aria-checked="row.on"
              :aria-label="row.ariaLabel"
              :disabled="row.busy || row.awaitingConfirm"
              :data-channel-toggle="row.channel"
              @click="onToggle(row.channel)"
            >
              <span class="pref-switch-knob" aria-hidden="true" />
            </button>
          </div>

          <div
            v-if="row.notice"
            class="pref-notice"
            :class="`is-${row.notice.kind}`"
            :role="row.notice.kind === 'error' || row.notice.kind === 'unavailable' ? 'alert' : 'status'"
          >
            <p>{{ row.notice.text }}</p>
            <button
              v-if="row.awaitingConfirm"
              type="button"
              class="pref-resend"
              :disabled="row.busy"
              :data-channel-resend="row.channel"
              @click="askToTurnOn(row.channel, { resend: true })"
            >
              {{ row.busy ? 'Sending…' : `Resend the ${row.label} confirmation` }}
            </button>
          </div>
        </div>
      </div>

      <p v-if="loadState === 'ready'" class="pref-foot">
        Turning a channel back on needs one extra step: we email you a link to confirm it is
        really you. Transactional messages about orders you place are always sent.
      </p>
    </div>
  </div>
</template>

<style scoped>
.pref-page {
  min-height: 100vh;
  background: var(--color-bg-page);
  padding: 48px 16px 64px;
  display: flex;
  justify-content: center;
}
@media (max-width: 640px) {
  .pref-page { padding: 28px 14px 48px; }
}

.pref-shell {
  width: 100%;
  max-width: 560px;
}

/* ── Header ─────────────────────────────────────────────── */
.pref-eyebrow {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
.pref-title {
  margin-top: 10px;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: clamp(28px, 6vw, 40px);
  line-height: 1.05;
  letter-spacing: -0.025em;
  color: var(--color-text-primary);
}
.pref-sub {
  margin-top: 10px;
  font-size: 14px;
  line-height: 1.55;
  color: var(--color-text-tertiary);
}
.pref-header { margin-bottom: 28px; }

.pref-loading {
  padding: 40px 0;
  text-align: center;
  font-size: 13.5px;
  color: var(--color-text-muted);
}

/* ── Channel list ───────────────────────────────────────── */
.pref-list {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.pref-row + .pref-row {
  border-top: 1px solid var(--color-border-muted);
}
.pref-row { padding: 18px 20px; }
@media (max-width: 640px) {
  .pref-row { padding: 16px 14px; }
}

.pref-row-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.pref-row-text { min-width: 0; }
.pref-row-label {
  font-size: 14.5px;
  font-weight: 500;
  color: var(--color-text-primary);
}
.pref-row-desc {
  margin-top: 4px;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--color-text-tertiary);
}

/* ── Switch ─────────────────────────────────────────────── */
.pref-switch {
  position: relative;
  flex-shrink: 0;
  /* 44px tall hit area on touch, drawn as a 26px track. */
  width: 46px;
  height: 44px;
  padding: 9px 0;
  background: none;
  border: none;
  cursor: pointer;
}
.pref-switch::before {
  content: '';
  position: absolute;
  inset: 9px 0;
  border-radius: var(--radius-full);
  background: var(--color-border-strong);
  transition: background var(--transition-fast);
}
.pref-switch.is-on::before { background: var(--color-success); }
.pref-switch:disabled { cursor: progress; }
.pref-switch.is-busy { opacity: 0.55; }
/* Retired, not loading: the channel is genuinely still off and the next move
   is in the user's inbox, so no spinner cursor and no dimming. */
.pref-switch.is-settled { cursor: default; }
.pref-switch:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
  border-radius: var(--radius-full);
}
.pref-switch-knob {
  position: relative;
  display: block;
  width: 22px;
  height: 22px;
  margin-left: 2px;
  border-radius: var(--radius-full);
  background: #fff;
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-fast);
}
.pref-switch.is-on .pref-switch-knob { transform: translateX(20px); }

/* ── Per-channel notice ─────────────────────────────────── */
.pref-notice {
  margin-top: 12px;
  padding: 9px 11px;
  border-radius: var(--radius-md);
  font-size: 12.5px;
  line-height: 1.5;
  border: 1px solid transparent;
}
.pref-notice.is-saved {
  background: var(--color-success-bg);
  border-color: var(--color-success-border);
  color: var(--color-success-text);
}
.pref-notice.is-confirm-sent {
  background: var(--color-info-bg);
  border-color: var(--color-info-border);
  color: var(--color-info-text);
}
.pref-notice.is-unavailable {
  background: var(--color-warning-bg);
  border-color: var(--color-warning-border);
  color: var(--color-warning-text);
}
.pref-notice.is-error {
  background: var(--color-error-bg);
  border-color: var(--color-error-border);
  color: var(--color-error-text);
}

/* Deliberately quieter than the switch it replaces — a second confirmation
   email should be a decision, not a reflex. Still a 44px touch target. */
.pref-resend {
  margin-top: 6px;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0;
  background: none;
  border: none;
  font-size: 12.5px;
  font-weight: 500;
  color: inherit;
  text-align: left;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.pref-resend:hover { opacity: 0.75; }
.pref-resend:disabled { cursor: progress; opacity: 0.6; text-decoration: none; }
.pref-resend:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.pref-foot {
  margin-top: 20px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-muted);
}
</style>
