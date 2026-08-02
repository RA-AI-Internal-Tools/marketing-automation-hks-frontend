// Public preference-centre transport — the ONLY anonymous surface in the app.
//
// Everything else in src/api goes through `./client`, which is built for a
// logged-in operator: `withCredentials: true` (ambient `ma_session` cookie),
// a request interceptor that echoes the `ma_csrf` double-submit token, and a
// response interceptor that wipes auth state and hard-redirects to /login on
// 401. All three are wrong here:
//
//   * the recipient of a marketing email has no session and no CSRF cookie;
//   * `/api/public/preferences/*` is unauthenticated by design, so sending
//     credentials only widens what a link scanner can reach;
//   * a 401 on these routes means "this link expired", not "you are logged
//     out" — bouncing a customer to an operator login page is nonsense.
//
// So this module owns a bare axios instance with no interceptors. It is
// deliberately NOT the shared client and must not grow one: adding an
// interceptor here is how the anonymous guarantee gets quietly lost.
//
// Note what is absent: there is no `X-Preference-Token` header. The previous
// implementation sent one; the backend has never read it. The token travels
// in the URL path, which is what the server actually authenticates on.
import axios, { AxiosError, type AxiosInstance } from 'axios'

/**
 * The complete channel set for this surface. `personalization` / the `global`
 * channel used by the old page do not exist here — the public token can only
 * reach the four marketing channels.
 */
export const PREFERENCE_CHANNELS = ['email', 'sms', 'whatsapp', 'push'] as const

export type PreferenceChannel = (typeof PREFERENCE_CHANNELS)[number]

/** Opt-in state for every channel. The API always returns all four keys. */
export type ChannelStates = Record<PreferenceChannel, boolean>

export const publicApi: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
})

const BASE = '/api/public/preferences'

/**
 * What went wrong, in terms the UI can act on.
 *
 * `invalid_token` covers expired, forged and already-consumed tokens — the
 * server deliberately does not distinguish them, and neither should the copy.
 */
export type PreferenceErrorKind =
  | 'invalid_token'
  | 'optin_unavailable'
  | 'invalid_channel'
  | 'opt_in_requires_confirmation'
  | 'network'
  | 'unknown'

export function classifyPreferenceError(e: unknown): PreferenceErrorKind {
  if (!(e instanceof AxiosError)) return 'unknown'
  // No response at all: DNS failure, timeout, offline, CORS. Distinct from a
  // server that answered — the user can retry this one.
  if (!e.response) return 'network'
  if (e.response.status === 401) return 'invalid_token'
  if (e.response.status === 503) return 'optin_unavailable'
  const code = (e.response.data as { error?: string } | undefined)?.error
  if (
    code === 'invalid_channel' ||
    code === 'opt_in_requires_confirmation' ||
    code === 'invalid_token' ||
    code === 'optin_unavailable'
  ) {
    return code
  }
  return 'unknown'
}

/**
 * A 200 whose body does not carry all four booleans is not a usable answer.
 * Defaulting the missing keys to `false` would render a confident "you are
 * unsubscribed" for state we never received — the same class of lie as
 * showing an empty list for a failed load. Fail instead.
 */
function readChannelStates(body: unknown): ChannelStates {
  const raw = (body as { channels?: Record<string, unknown> } | undefined)?.channels
  const out = {} as ChannelStates
  for (const channel of PREFERENCE_CHANNELS) {
    const value = raw?.[channel]
    if (typeof value !== 'boolean') {
      throw new Error(`preference response is missing a boolean "${channel}" channel`)
    }
    out[channel] = value
  }
  return out
}

/** GET /api/public/preferences/:token */
export async function fetchPreferences(token: string): Promise<ChannelStates> {
  const { data } = await publicApi.get(`${BASE}/${encodeURIComponent(token)}`)
  return readChannelStates(data)
}

/**
 * POST /api/public/preferences/:token — turn a channel OFF.
 *
 * `opted_in` is hard-coded false and takes no parameter on purpose. A long
 * token is mass-distributed and routinely dereferenced by link scanners and
 * mail proxies, so it can never grant consent; the server rejects
 * `opted_in: true` with 400 opt_in_requires_confirmation. Turning a channel
 * back on goes through `requestOptIn` + `confirmOptIn`.
 */
export async function optOutChannel(token: string, channel: PreferenceChannel): Promise<void> {
  await publicApi.post(`${BASE}/${encodeURIComponent(token)}`, { channel, opted_in: false })
}

/**
 * POST /api/public/preferences/:token/request-optin — 202.
 *
 * Nothing has changed when this resolves. It only asks the server to email a
 * short-lived confirmation link; the channel stays off until `confirmOptIn`.
 */
export async function requestOptIn(token: string, channel: PreferenceChannel): Promise<void> {
  await publicApi.post(`${BASE}/${encodeURIComponent(token)}/request-optin`, { channel })
}

/**
 * POST /api/public/preferences/optin/:shortToken — completes the round trip.
 * `shortToken` is the single-use token from the confirmation email, not the
 * 365-day token from the marketing footer.
 */
export async function confirmOptIn(shortToken: string, channel: PreferenceChannel): Promise<void> {
  await publicApi.post(`${BASE}/optin/${encodeURIComponent(shortToken)}`, { channel })
}

/** Narrowing helper for values arriving from the URL. */
export function isPreferenceChannel(value: unknown): value is PreferenceChannel {
  return typeof value === 'string' && (PREFERENCE_CHANNELS as readonly string[]).includes(value)
}
