// Canonical vocabulary for the outcome of ONE click of the integration
// "Test connection" button.
//
// This is a DIFFERENT vocabulary from src/constants/logStatus.ts. LOG_STATUSES
// describes what a campaign_logs row can be (a send outcome); this describes
// what a credential probe can conclude. They share no values, and a member of
// one must never be added to the other — StatusBadge/LogsPage/Channels all key
// off LOG_STATUSES, and an integration-probe state landing in there would be
// offered as a campaign-log filter option that matches nothing.
//
// The module exists for the same reason logStatus.ts does: the reason string
// was previously hand-typed at the point of use, and hand-typed status copies
// drift. `rate_limited` appears as a literal exactly once in the frontend —
// here.
//
// FOUR of the five values are sent verbatim by the backend as the `status`
// field of a 200 response from probeProvider (internal/api/routes_integrations.go):
//   ok | error | not_configured | not_supported
//
// RATE_LIMITED is the fifth, and is the one value the backend never puts in a
// `status` field — because a throttled probe is not a probe result at all, it
// is a refusal to run one. Both probe routes
//   POST /api/integrations/:id/test
//   POST /api/integrations/credentials/:provider/test
// are wrapped in the same `testLimiter` (5 requests / 1 minute per principal +
// integration-or-provider). On refusal middleware.RateLimiterByKey
// (internal/middleware/ratelimit.go) answers HTTP 429 with
//   {"error":"rate limit exceeded","reason":"rate_limited","retry_after":N}
// plus Retry-After / X-RateLimit-Limit / X-RateLimit-Remaining headers. The
// free-text `error` field is explicitly documented there as NOT contractually
// stable; `reason` is the stable machine-matchable code. That is why this
// module matches on `reason` (and the HTTP status), never on the error text.
//
// classifyTestProbeError() below is the single place that turns such a refusal
// into a member of this vocabulary. It is keyed on the HTTP response only, not
// on the URL, so it classifies either probe route identically.

/**
 * The five outcomes the Test button can render.
 *
 * RATE_LIMITED deliberately reuses the backend's stable `reason` code as its
 * own state name rather than inventing a parallel frontend word — see
 * RATE_LIMITED_REASON.
 */
export const INTEGRATION_TEST_STATUS = {
  OK: 'ok',
  ERROR: 'error',
  NOT_CONFIGURED: 'not_configured',
  NOT_SUPPORTED: 'not_supported',
  RATE_LIMITED: 'rate_limited',
} as const

export type IntegrationTestStatus =
  (typeof INTEGRATION_TEST_STATUS)[keyof typeof INTEGRATION_TEST_STATUS]

/**
 * The `reason` code the rate-limit middleware puts in a 429 body.
 *
 * Defined as an alias of the state name rather than a second literal: the
 * frontend adopts the backend's machine code as its state name on purpose, so
 * there is one token to keep in sync instead of a mapping between two. If the
 * backend ever renames the code, this alias is the single edit — and the
 * `=== RATE_LIMITED_REASON` test below is what would fail first.
 */
export const RATE_LIMITED_REASON: IntegrationTestStatus = INTEGRATION_TEST_STATUS.RATE_LIMITED

/** The refusal status the throttle answers with. */
export const HTTP_TOO_MANY_REQUESTS = 429

/**
 * What the component stores after a click.
 *
 * `status` is intentionally NOT narrowed to IntegrationTestStatus. The 200
 * path assigns the server's `status` field straight through without
 * validating it, so narrowing here would be a claim this code does not check.
 * Consumers must therefore treat an unrecognised value as a failure (see the
 * tone-map fallback in IntegrationForm.vue) rather than assume exhaustiveness.
 * Values produced by classifyTestProbeError() are always members of
 * INTEGRATION_TEST_STATUS.
 */
export interface IntegrationTestOutcome {
  status: string
  detail: string
  /**
   * Whole seconds the operator must wait before the probe will run again.
   * Set only on RATE_LIMITED, and only when the server actually told us — a
   * 429 with neither `retry_after` nor a parseable Retry-After header leaves
   * this undefined, which means "throttled, duration unknown". Callers must
   * not substitute a guess: a fabricated countdown that expires early sends
   * the operator straight back into the throttle and, because the middleware
   * re-EXPIREs the Redis key on every request including refused ones,
   * extends the lockout.
   */
  retryAfterSeconds?: number
}

/** Detail copy for a throttled probe. Single source for this sentence. */
export function rateLimitedDetail(retryAfterSeconds?: number): string {
  return retryAfterSeconds === undefined
    ? 'Too many test runs for this integration. Try again in a moment.'
    : `Too many test runs for this integration. Try again in ${retryAfterSeconds}s.`
}

/** Narrow structural view of an axios error — avoids importing axios here. */
interface ProbeErrorLike {
  message?: unknown
  response?: {
    status?: unknown
    data?: unknown
    headers?: unknown
  }
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : undefined
}

/**
 * Coerce a Retry-After value to whole seconds in the future, or undefined.
 *
 * Returns undefined rather than 0 for an elapsed/zero delay: 0 would render
 * as "Try again in 0s" and disable the button for no time at all, which is
 * strictly worse than saying nothing.
 */
function normaliseSeconds(n: number): number | undefined {
  if (!Number.isFinite(n)) return undefined
  const s = Math.ceil(n)
  return s > 0 ? s : undefined
}

function parseRetryAfter(raw: unknown): number | undefined {
  if (typeof raw === 'number') return normaliseSeconds(raw)
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  if (trimmed === '') return undefined
  const asSeconds = Number(trimmed)
  if (Number.isFinite(asSeconds)) return normaliseSeconds(asSeconds)
  // RFC 9110 also permits an HTTP-date. Our middleware always sends integer
  // seconds, but a proxy or CDN in front of it may rewrite the header.
  const asDate = Date.parse(trimmed)
  if (Number.isNaN(asDate)) return undefined
  return normaliseSeconds((asDate - Date.now()) / 1000)
}

function headerValue(headers: unknown, name: string): unknown {
  const rec = asRecord(headers)
  if (!rec) return undefined
  // axios lower-cases response header keys; a hand-built mock may not.
  return rec[name] ?? rec[name.toLowerCase()]
}

/**
 * Map a rejected probe request onto the vocabulary above.
 *
 * Returns RATE_LIMITED when the server refused for throttling, ERROR for
 * everything else — including 5xx, network failure, and timeout. ERROR (not
 * some sixth word) is deliberate: the catch used to invent `status: 'failed'`,
 * a value no backend ever sends and nothing else in the app understands, which
 * happened to render red only because red was the tone-map fallback.
 *
 * Route-agnostic by construction: it reads the HTTP response, never the URL,
 * so /integrations/:id/test and /integrations/credentials/:provider/test —
 * which share one `testLimiter` instance in the backend — classify the same.
 */
export function classifyTestProbeError(err: unknown): IntegrationTestOutcome {
  const e = (asRecord(err) ?? {}) as ProbeErrorLike
  const response = asRecord(e.response)
  const data = asRecord(response?.data)
  const httpStatus = typeof response?.status === 'number' ? response.status : undefined
  const reason = typeof data?.['reason'] === 'string' ? data['reason'] : undefined

  // Match on either signal. The status code alone catches a 429 synthesised by
  // nginx/a CDN with no JSON body at all; the `reason` code alone catches a
  // body that survived a gateway which rewrote the status. Neither is
  // redundant, and both are contract-backed.
  if (httpStatus === HTTP_TOO_MANY_REQUESTS || reason === RATE_LIMITED_REASON) {
    const retryAfterSeconds =
      normaliseSeconds(typeof data?.['retry_after'] === 'number' ? data['retry_after'] : NaN)
      ?? parseRetryAfter(headerValue(response?.headers, 'Retry-After'))
    return {
      status: INTEGRATION_TEST_STATUS.RATE_LIMITED,
      detail: rateLimitedDetail(retryAfterSeconds),
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    }
  }

  const serverError = typeof data?.['error'] === 'string' ? data['error'] : undefined
  const message = typeof e.message === 'string' ? e.message : undefined
  return {
    status: INTEGRATION_TEST_STATUS.ERROR,
    detail: serverError || message || 'Request failed',
  }
}
