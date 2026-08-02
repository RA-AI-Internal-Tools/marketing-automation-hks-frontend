/**
 * Public preference centre — the anonymous surface reached from a marketing
 * email footer.
 *
 * Two defects are pinned here, and both are about a token that must not be
 * trusted to do more than it can:
 *
 *   1. IDOR. The old page took the subject from `?client_id=` and posted that
 *      integer as the identity on every consent write. Every request the page
 *      makes is captured below and asserted to carry no client id at all —
 *      identity is resolved server-side from the token.
 *
 *   2. Consent-by-link-scanner. The 365-day token is mass-distributed and
 *      routinely dereferenced by mail proxies, so it can only turn channels
 *      OFF. Switching one ON must go through request-optin + a confirmation
 *      email; it must NOT hit the opt-out endpoint with `opted_in: true`, and
 *      the toggle must not render as though the change already happened.
 *
 *      The same hazard applies to the SHORT token on PreferenceConfirmPage,
 *      which is single-use: a scanner that renders that page must not be able
 *      to spend it, or the human who clicks a minute later is told the link
 *      "has already been used" while the channel really did get switched on.
 *      So the confirm page must issue nothing at all on mount.
 *
 * Requests are captured at the axios adapter, not by stubbing the api module,
 * so the assertions are about the bytes on the wire — exact URL, exact body,
 * exact headers — rather than about how we happened to call our own wrapper.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { enableAutoUnmount, mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'

// ── Route mock ───────────────────────────────────────────────────────────
// Mutable so each test can place the token on the path or in the query, and
// reactive like the real `useRoute()` object so a token change mid-test drives
// the component's `watch(token, load)` exactly as an in-app navigation would.
const routeState: { params: Record<string, string>; query: Record<string, string> } = reactive({
  params: {},
  query: {},
})

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
}))

import { publicApi } from '@/api/publicPreferences'
import ErrorState from '@/components/ErrorState.vue'
import PreferenceCenterPage from '../PreferenceCenterPage.vue'
import PreferenceConfirmPage from '../PreferenceConfirmPage.vue'

// ── Adapter capture ──────────────────────────────────────────────────────

interface Captured {
  method: string
  url: string
  body: any
  headers: string
}

type Reply = { status: number; data?: unknown }

const requests: Captured[] = []
let handler: (config: InternalAxiosRequestConfig) => Reply
/** When set, the adapter parks here before replying — lets us hold a request open. */
let gate: Promise<void> | null = null

const CHANNELS_OK = { channels: { email: true, sms: false, whatsapp: false, push: true } }

function defaultHandler(config: InternalAxiosRequestConfig): Reply {
  const method = (config.method || 'get').toLowerCase()
  if (method === 'get') return { status: 200, data: CHANNELS_OK }
  if ((config.url || '').endsWith('/request-optin')) return { status: 202, data: { ok: true } }
  return { status: 200, data: { ok: true } }
}

const stubs = { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } }
const mountOpts = { global: { stubs } }

// A wrapper left mounted keeps its `watch(token, load)` alive, so with a
// reactive route mock every stale page from an earlier test would re-fetch the
// moment the next test set a token — polluting the request capture that half
// the assertions in this file are built on. Tear each one down.
enableAutoUnmount(afterEach)

beforeEach(() => {
  requests.length = 0
  routeState.params = {}
  routeState.query = {}
  handler = defaultHandler
  gate = null

  publicApi.defaults.adapter = async (config) => {
    const c = config as InternalAxiosRequestConfig
    requests.push({
      method: (c.method || 'get').toLowerCase(),
      url: c.url || '',
      body: typeof c.data === 'string' && c.data ? JSON.parse(c.data) : c.data,
      headers: JSON.stringify(c.headers ?? {}),
    })
    if (gate) await gate
    const reply = handler(c)
    const response = {
      data: reply.data ?? {},
      status: reply.status,
      statusText: '',
      headers: {},
      config: c,
    }
    // status 0 models "no response at all" — offline, DNS, timeout.
    if (reply.status === 0) throw new AxiosError('Network Error', 'ERR_NETWORK', c)
    if (reply.status >= 400) {
      throw new AxiosError('Request failed', String(reply.status), c, {}, response as any)
    }
    return response as any
  }
})

const posts = () => requests.filter((r) => r.method === 'post')
const toggle = (w: any, channel: string) => w.get(`[data-channel-toggle="${channel}"]`)
const resend = (w: any, channel: string) => w.get(`[data-channel-resend="${channel}"]`)
const confirmButton = (w: any) => w.get('[data-confirm-optin]')

// ─────────────────────────────────────────────────────────────────────────

describe('PreferenceCenterPage — reading state', () => {
  it('renders one toggle per channel, reflecting the GET response', async () => {
    routeState.params = { token: 'long-token-abc' }
    const w = mount(PreferenceCenterPage, mountOpts)
    await flushPromises()

    const toggles = w.findAll('[data-channel-toggle]')
    expect(toggles).toHaveLength(4)
    expect(toggles.map((t) => t.attributes('data-channel-toggle'))).toEqual([
      'email', 'sms', 'whatsapp', 'push',
    ])

    expect(requests).toHaveLength(1)
    expect(requests[0]!.method).toBe('get')
    expect(requests[0]!.url).toBe('/api/public/preferences/long-token-abc')

    expect(toggle(w, 'email').attributes('aria-checked')).toBe('true')
    expect(toggle(w, 'sms').attributes('aria-checked')).toBe('false')
    expect(toggle(w, 'whatsapp').attributes('aria-checked')).toBe('false')
    expect(toggle(w, 'push').attributes('aria-checked')).toBe('true')
  })

  it('accepts the legacy ?token= form for links already in inboxes', async () => {
    routeState.query = { token: 'legacy-token' }
    const w = mount(PreferenceCenterPage, mountOpts)
    await flushPromises()

    expect(requests[0]!.url).toBe('/api/public/preferences/legacy-token')
    expect(w.findAll('[data-channel-toggle]')).toHaveLength(4)
  })

  it('does not drop the "personalization" toggle back in — only four channels exist', async () => {
    routeState.params = { token: 'long-token-abc' }
    const w = mount(PreferenceCenterPage, mountOpts)
    await flushPromises()

    expect(w.text().toLowerCase()).not.toContain('personalization')
  })
})

describe('PreferenceCenterPage — turning a channel OFF', () => {
  it('POSTs to the token path with opted_in: false and confirms', async () => {
    routeState.params = { token: 'long-token-abc' }
    const w = mount(PreferenceCenterPage, mountOpts)
    await flushPromises()

    await toggle(w, 'email').trigger('click')
    await flushPromises()

    expect(posts()).toHaveLength(1)
    expect(posts()[0]!.url).toBe('/api/public/preferences/long-token-abc')
    expect(posts()[0]!.body).toEqual({ channel: 'email', opted_in: false })

    expect(toggle(w, 'email').attributes('aria-checked')).toBe('false')
    expect(w.text()).toContain('Email turned off')
  })

  it('reverts the toggle and explains when the opt-out fails', async () => {
    routeState.params = { token: 'long-token-abc' }
    const w = mount(PreferenceCenterPage, mountOpts)
    await flushPromises()

    handler = (c) => (c.method === 'post' ? { status: 500, data: {} } : defaultHandler(c))
    await toggle(w, 'email').trigger('click')
    await flushPromises()

    expect(toggle(w, 'email').attributes('aria-checked')).toBe('true')
    expect(w.text()).toContain('could not turn off Email')
    expect(w.text()).toContain('Nothing has changed')
  })
})

describe('PreferenceCenterPage — turning a channel ON needs confirmation', () => {
  it('calls request-optin, never the opt-out endpoint, and leaves the toggle off', async () => {
    routeState.params = { token: 'long-token-abc' }
    const w = mount(PreferenceCenterPage, mountOpts)
    await flushPromises()

    // sms starts opted out.
    expect(toggle(w, 'sms').attributes('aria-checked')).toBe('false')
    await toggle(w, 'sms').trigger('click')
    await flushPromises()

    expect(posts()).toHaveLength(1)
    expect(posts()[0]!.url).toBe('/api/public/preferences/long-token-abc/request-optin')
    expect(posts()[0]!.body).toEqual({ channel: 'sms' })

    // The opt-out route was NOT touched, and `opted_in: true` was never sent
    // anywhere — the server would 400 it, and the UI must not try.
    expect(posts().some((p) => p.url === '/api/public/preferences/long-token-abc')).toBe(false)
    expect(requests.every((r) => r.body?.opted_in !== true)).toBe(true)

    // Nothing has changed yet, so the switch must not read as on.
    expect(toggle(w, 'sms').attributes('aria-checked')).toBe('false')
    expect(toggle(w, 'sms').classes()).not.toContain('is-on')
    expect(w.text()).toContain('Check your email')
  })

  it('says so honestly when the sender is unavailable (503) instead of faking success', async () => {
    routeState.params = { token: 'long-token-abc' }
    const w = mount(PreferenceCenterPage, mountOpts)
    await flushPromises()

    handler = (c) =>
      (c.url || '').endsWith('/request-optin')
        ? { status: 503, data: { error: 'optin_unavailable' } }
        : defaultHandler(c)

    await toggle(w, 'whatsapp').trigger('click')
    await flushPromises()

    expect(w.text()).toContain('cannot send confirmation emails')
    expect(w.text()).toContain('has not been turned on')
    expect(w.text()).not.toContain('Check your email')
    expect(toggle(w, 'whatsapp').attributes('aria-checked')).toBe('false')
  })

  /**
   * `pending` clears as soon as request-optin settles, which left a live
   * switch sitting under the "check your email" notice. Every further tap
   * sends another email; the backend rate limiter is the real control, but
   * nothing on screen said the first tap had worked, so the mis-tap was the
   * default behaviour rather than the exception.
   */
  it('retires the switch once the confirmation email is out', async () => {
    routeState.params = { token: 'long-token-abc' }
    const w = mount(PreferenceCenterPage, mountOpts)
    await flushPromises()

    await toggle(w, 'sms').trigger('click')
    await flushPromises()
    expect(posts()).toHaveLength(1)
    expect(w.text()).toContain('sent a confirmation to your inbox')

    // Settled: the switch is inert, and still — truthfully — off.
    expect(toggle(w, 'sms').attributes('disabled')).toBeDefined()
    expect(toggle(w, 'sms').attributes('aria-checked')).toBe('false')
    await toggle(w, 'sms').trigger('click')
    await flushPromises()
    expect(posts()).toHaveLength(1)

    // Other channels are untouched by one channel settling.
    expect(toggle(w, 'whatsapp').attributes('disabled')).toBeUndefined()
  })

  it('offers an explicit resend that fires exactly one more request', async () => {
    routeState.params = { token: 'long-token-abc' }
    const w = mount(PreferenceCenterPage, mountOpts)
    await flushPromises()

    await toggle(w, 'sms').trigger('click')
    await flushPromises()

    await resend(w, 'sms').trigger('click')
    await flushPromises()

    expect(posts()).toHaveLength(2)
    expect(posts()[1]!.url).toBe('/api/public/preferences/long-token-abc/request-optin')
    expect(posts()[1]!.body).toEqual({ channel: 'sms' })
    // Distinct copy, so a second press is visibly acknowledged rather than
    // re-rendering the identical sentence.
    expect(w.text()).toContain('Sent again')
    // Still not on — a resend is another request for confirmation, not consent.
    expect(toggle(w, 'sms').attributes('aria-checked')).toBe('false')
  })

  it('does not offer a resend when the first send never succeeded', async () => {
    routeState.params = { token: 'long-token-abc' }
    const w = mount(PreferenceCenterPage, mountOpts)
    await flushPromises()

    handler = (c) =>
      (c.url || '').endsWith('/request-optin')
        ? { status: 503, data: { error: 'optin_unavailable' } }
        : defaultHandler(c)

    await toggle(w, 'push').trigger('click')
    await flushPromises()

    expect(w.find('[data-channel-resend="push"]').exists()).toBe(false)
    // The switch stays live so the user can try again the ordinary way.
    expect(toggle(w, 'push').attributes('disabled')).toBeUndefined()
  })

  it('clears the settled state when the page reloads its state', async () => {
    routeState.params = { token: 'long-token-abc' }
    const w = mount(PreferenceCenterPage, mountOpts)
    await flushPromises()

    await toggle(w, 'sms').trigger('click')
    await flushPromises()
    expect(w.find('[data-channel-resend="sms"]').exists()).toBe(true)

    // Same trigger the confirm round trip uses when it routes back here.
    routeState.params = { token: 'long-token-def' }
    await flushPromises()

    expect(w.find('[data-channel-resend="sms"]').exists()).toBe(false)
    expect(toggle(w, 'sms').attributes('disabled')).toBeUndefined()
  })
})

describe('PreferenceCenterPage — failure states', () => {
  it('renders the expired-link state on a 401, with no form and no crash', async () => {
    routeState.params = { token: 'stale-token' }
    handler = () => ({ status: 401, data: { error: 'invalid_token' } })
    const w = mount(PreferenceCenterPage, mountOpts)
    await flushPromises()

    expect(w.findComponent(ErrorState).exists()).toBe(true)
    expect(w.text()).toContain('This link has expired')
    expect(w.text()).toContain('any recent email')
    expect(w.findAll('[data-channel-toggle]')).toHaveLength(0)
  })

  it('renders the expired-link state when the link carries no token at all', async () => {
    const w = mount(PreferenceCenterPage, mountOpts)
    await flushPromises()

    expect(w.findComponent(ErrorState).exists()).toBe(true)
    expect(w.text()).toContain('This link has expired')
    expect(requests).toHaveLength(0)
  })

  it('offers a retry on a network failure and distinguishes it from an expired link', async () => {
    routeState.params = { token: 'long-token-abc' }
    handler = () => ({ status: 0 })
    const w = mount(PreferenceCenterPage, mountOpts)
    await flushPromises()

    expect(w.findComponent(ErrorState).exists()).toBe(true)
    expect(w.text()).toContain('could not load your preferences')
    expect(w.text()).not.toContain('This link has expired')

    handler = defaultHandler
    await w.findComponent(ErrorState).vm.$emit('retry')
    await flushPromises()
    expect(w.findAll('[data-channel-toggle]')).toHaveLength(4)
  })

  /**
   * A 200 that does not carry all four booleans is not a usable answer, and
   * `readChannelStates` throws rather than defaulting the missing keys to
   * `false`. Defaulting is the tempting fix and the wrong one: it would render
   * a confident row of OFF switches — "you are unsubscribed from everything" —
   * for state that never arrived, on the one page in the product whose whole
   * job is telling the user the truth about their consent. These two pin the
   * throw to the user-visible outcome.
   */
  it('refuses to render toggles for a 200 whose channels map is incomplete', async () => {
    routeState.params = { token: 'long-token-abc' }
    // `whatsapp` and `push` never arrived.
    handler = () => ({ status: 200, data: { channels: { email: true, sms: false } } })
    const w = mount(PreferenceCenterPage, mountOpts)
    await flushPromises()

    expect(w.findAll('[data-channel-toggle]')).toHaveLength(0)
    expect(w.findComponent(ErrorState).exists()).toBe(true)
    expect(w.text()).toContain('could not load your preferences')
    expect(w.text()).toContain('problem on our side, not a change to your settings')
    // Specifically NOT the expired-link copy: the link is fine, we are not.
    expect(w.text()).not.toContain('This link has expired')
  })

  it('refuses to render toggles when a channel arrives as a non-boolean', async () => {
    routeState.params = { token: 'long-token-abc' }
    handler = () => ({
      status: 200,
      // `null` and the string "false" are the two shapes a lenient backend
      // serialiser produces; both are indistinguishable from "off" once
      // coerced, which is exactly why they must not be coerced.
      data: { channels: { email: true, sms: 'false', whatsapp: null, push: false } },
    })
    const w = mount(PreferenceCenterPage, mountOpts)
    await flushPromises()

    expect(w.findAll('[data-channel-toggle]')).toHaveLength(0)
    expect(w.text()).toContain('problem on our side, not a change to your settings')
  })

  it('falls back to the expired state if the token dies mid-session', async () => {
    routeState.params = { token: 'long-token-abc' }
    const w = mount(PreferenceCenterPage, mountOpts)
    await flushPromises()

    handler = (c) =>
      c.method === 'post' ? { status: 401, data: { error: 'invalid_token' } } : defaultHandler(c)
    await toggle(w, 'email').trigger('click')
    await flushPromises()

    expect(w.text()).toContain('This link has expired')
    expect(w.findAll('[data-channel-toggle]')).toHaveLength(0)
  })
})

describe('PreferenceCenterPage — in-flight locking is per channel', () => {
  it('ignores a second click on a channel whose request is still open', async () => {
    routeState.params = { token: 'long-token-abc' }
    const w = mount(PreferenceCenterPage, mountOpts)
    await flushPromises()

    let release!: () => void
    gate = new Promise<void>((r) => { release = r })

    await toggle(w, 'email').trigger('click')
    await toggle(w, 'email').trigger('click')
    expect(posts()).toHaveLength(1)

    release()
    gate = null
    await flushPromises()
    expect(posts()).toHaveLength(1)
  })

  it('still lets a different channel be changed while one is in flight', async () => {
    routeState.params = { token: 'long-token-abc' }
    const w = mount(PreferenceCenterPage, mountOpts)
    await flushPromises()

    let release!: () => void
    gate = new Promise<void>((r) => { release = r })

    await toggle(w, 'email').trigger('click')
    await toggle(w, 'push').trigger('click')
    expect(posts()).toHaveLength(2)
    expect(posts().map((p) => p.body.channel)).toEqual(['email', 'push'])

    release()
    gate = null
    await flushPromises()
  })
})

describe('PreferenceConfirmPage — the short token is spent only by a human', () => {
  /**
   * THE defect this page exists to avoid. The short token is single-use and
   * arrives by email, so it passes through the same link scanners and mail
   * proxies as the marketing footer — including ones that execute JavaScript
   * and would therefore mount this component. Firing on mount hands the
   * credential to the scanner: the channel really is turned on, and the human
   * who clicks a minute later reads "this link has already been used".
   *
   * Asserted at the adapter, so it is about bytes on the wire rather than
   * about which of our own functions we happened to call.
   */
  it('issues NOTHING on mount — the request list is empty until the button is pressed', async () => {
    routeState.params = { shortToken: 'short-xyz' }
    routeState.query = { channel: 'email' }
    const w = mount(PreferenceConfirmPage, mountOpts)
    await flushPromises()

    expect(requests).toHaveLength(0)

    // And the page is not pretending anything happened.
    expect(w.text()).not.toContain('is back on')
    expect(w.text()).not.toContain('already been used')

    // The control names the actual channel, so the consent being granted is
    // legible before it is granted.
    expect(confirmButton(w).text()).toContain('Yes, turn Email back on')

    await confirmButton(w).trigger('click')
    await flushPromises()

    expect(requests).toHaveLength(1)
    expect(requests[0]!.method).toBe('post')
    expect(requests[0]!.url).toBe('/api/public/preferences/optin/short-xyz')
    expect(requests[0]!.body).toEqual({ channel: 'email' })
    expect(w.text()).toContain('Email is back on')
  })

  it('still spends nothing on mount when the reply would be a 401', async () => {
    routeState.params = { shortToken: 'short-xyz' }
    routeState.query = { channel: 'sms' }
    handler = () => ({ status: 401, data: { error: 'invalid_token' } })
    const w = mount(PreferenceConfirmPage, mountOpts)
    await flushPromises()

    expect(requests).toHaveLength(0)
    expect(w.findComponent(ErrorState).exists()).toBe(false)

    await confirmButton(w).trigger('click')
    await flushPromises()

    expect(requests).toHaveLength(1)
    expect(w.findComponent(ErrorState).exists()).toBe(true)
    expect(w.text()).toContain('already been used')
  })

  it('ignores a double-press while the confirmation is in flight', async () => {
    routeState.params = { shortToken: 'short-xyz' }
    routeState.query = { channel: 'email' }
    const w = mount(PreferenceConfirmPage, mountOpts)
    await flushPromises()

    let release!: () => void
    gate = new Promise<void>((r) => { release = r })

    await confirmButton(w).trigger('click')
    await confirmButton(w).trigger('click')
    expect(requests).toHaveLength(1)

    release()
    gate = null
    await flushPromises()
    expect(requests).toHaveLength(1)
    expect(w.text()).toContain('Email is back on')
  })

  it('reports 503 honestly rather than claiming the channel is on, and retries on demand', async () => {
    routeState.params = { shortToken: 'short-xyz' }
    routeState.query = { channel: 'push' }
    handler = () => ({ status: 503, data: { error: 'optin_unavailable' } })
    const w = mount(PreferenceConfirmPage, mountOpts)
    await flushPromises()

    await confirmButton(w).trigger('click')
    await flushPromises()

    expect(w.text()).toContain('email service is unavailable')
    expect(w.text()).not.toContain('back on')

    handler = defaultHandler
    await w.findComponent(ErrorState).vm.$emit('retry')
    await flushPromises()
    expect(w.text()).toContain('Push notifications is back on')
  })

  it('offers a retry after a network failure, still without having auto-fired', async () => {
    routeState.params = { shortToken: 'short-xyz' }
    routeState.query = { channel: 'whatsapp' }
    handler = () => ({ status: 0 })
    const w = mount(PreferenceConfirmPage, mountOpts)
    await flushPromises()

    expect(requests).toHaveLength(0)

    await confirmButton(w).trigger('click')
    await flushPromises()
    expect(w.text()).toContain('could not complete this confirmation')
    expect(w.text()).toContain('Nothing has changed')

    handler = defaultHandler
    await w.findComponent(ErrorState).vm.$emit('retry')
    await flushPromises()
    expect(w.text()).toContain('WhatsApp is back on')
  })

  it('rejects an unknown channel on sight, with no request and no button to press', async () => {
    routeState.params = { shortToken: 'short-xyz' }
    routeState.query = { channel: 'personalization' }
    const w = mount(PreferenceConfirmPage, mountOpts)
    await flushPromises()

    expect(requests).toHaveLength(0)
    expect(w.findComponent(ErrorState).exists()).toBe(true)
    expect(w.find('[data-confirm-optin]').exists()).toBe(false)
  })

  /**
   * The confirmation email used to carry `?token=<365-day token>` purely so
   * this page could render a "Back to all preferences" link. That put a
   * long-lived, independently forwardable credential into a second message
   * fetched by the same scanners — a poor trade for one convenience link.
   */
  it('never renders a link built from a long token, even when one is supplied', async () => {
    routeState.params = { shortToken: 'short-xyz' }
    routeState.query = { channel: 'sms', token: 'long-token-abc' }
    const w = mount(PreferenceConfirmPage, mountOpts)
    await flushPromises()

    await confirmButton(w).trigger('click')
    await flushPromises()

    expect(w.html()).not.toContain('long-token-abc')
    expect(w.findAll('a')).toHaveLength(0)
    // Replaced by copy pointing at the footer link the recipient already has.
    expect(w.text()).toContain('any recent email')
  })
})

describe('no request on this surface carries a client identifier', () => {
  it('never sends client_id / clientId, on any call, in url, body or headers', async () => {
    routeState.params = { token: 'long-token-abc' }
    const center = mount(PreferenceCenterPage, mountOpts)
    await flushPromises()

    await toggle(center, 'email').trigger('click')   // opt-out
    await flushPromises()
    await toggle(center, 'sms').trigger('click')     // request-optin
    await flushPromises()

    routeState.params = { shortToken: 'short-xyz' }
    routeState.query = { channel: 'sms' }
    const confirmPage = mount(PreferenceConfirmPage, mountOpts)
    await flushPromises()
    // The confirm page issues nothing until pressed — see the describe above.
    await confirmButton(confirmPage).trigger('click')
    await flushPromises()

    // GET + opt-out + request-optin + confirm.
    expect(requests).toHaveLength(4)
    for (const r of requests) {
      const wire = `${r.url} ${JSON.stringify(r.body ?? {})} ${r.headers}`
      expect(wire).not.toContain('client_id')
      expect(wire).not.toContain('clientId')
      // The header the old page sent; the backend has never implemented it.
      expect(wire).not.toContain('X-Preference-Token')
      expect(r.url.startsWith('/api/public/preferences')).toBe(true)
    }
  })

  it('sends no credentials — these calls must work with no session cookie', () => {
    expect(publicApi.defaults.withCredentials).toBe(false)
  })
})
