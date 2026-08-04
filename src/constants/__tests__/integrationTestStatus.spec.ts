import { describe, it, expect } from 'vitest'
import {
  INTEGRATION_TEST_STATUS,
  RATE_LIMITED_REASON,
  HTTP_TOO_MANY_REQUESTS,
  classifyTestProbeError,
  rateLimitedDetail,
} from '../integrationTestStatus'
import { LOG_STATUSES } from '../logStatus'

/** Axios-shaped rejection. Header keys are lower-cased, as axios delivers. */
function httpError(
  status: number,
  data: unknown,
  headers: Record<string, string> = {},
  url = '/api/integrations/credentials/ses/test',
) {
  return {
    message: `Request failed with status code ${status}`,
    // `config.url` is where axios puts the request URL. It is carried here so
    // the route-agnosticism test below can differ ONLY by URL; without it that
    // test compared two identical inputs and asserted determinism, not
    // route-agnosticism.
    config: { url },
    response: { status, data, headers },
  }
}

// Verbatim body emitted by middleware.RateLimiterByKey
// (internal/middleware/ratelimit.go) when the bucket is exhausted. Both probe
// routes share one instance of that middleware, so both produce this exact
// shape — only the URL differs, and classifyTestProbeError never reads the URL.
function rateLimitBody(retryAfter?: number) {
  return {
    error: 'rate limit exceeded',
    reason: 'rate_limited',
    ...(retryAfter === undefined ? {} : { retry_after: retryAfter }),
  }
}

describe('integration test-probe vocabulary', () => {
  it('pins the reason code the backend actually sends', () => {
    // If this literal ever stops matching internal/middleware/ratelimit.go's
    // `"reason": "rate_limited"`, every throttled probe silently reverts to
    // rendering as a failed test. This is the one place that would notice.
    expect(RATE_LIMITED_REASON).toBe('rate_limited')
    expect(HTTP_TOO_MANY_REQUESTS).toBe(429)
  })

  it('keeps the probe vocabulary disjoint from the campaign-log vocabulary', () => {
    // LOG_STATUSES is a different vocabulary (send outcomes). A probe state
    // leaking into it would be offered as a LogsPage filter option that can
    // never match a row.
    const logValues = new Set(LOG_STATUSES.map((s) => s.value))
    for (const probeStatus of Object.values(INTEGRATION_TEST_STATUS)) {
      expect(logValues.has(probeStatus)).toBe(false)
    }
  })
})

describe('classifyTestProbeError', () => {
  it('classifies a throttled credentials/:provider/test probe as rate_limited', () => {
    const out = classifyTestProbeError(httpError(429, rateLimitBody(12)))
    expect(out.status).toBe(INTEGRATION_TEST_STATUS.RATE_LIMITED)
    expect(out.status).not.toBe(INTEGRATION_TEST_STATUS.ERROR)
    expect(out.retryAfterSeconds).toBe(12)
    expect(out.detail).toContain('12s')
    // The free-text `error` field is documented as NOT contractually stable
    // in the middleware, so it must not reach the operator.
    expect(out.detail).not.toContain('rate limit exceeded')
  })

  it('classifies a throttled /integrations/:id/test probe identically', () => {
    // The legacy numeric-id route (used by api/integrations.ts's
    // testIntegrationConnection) shares the same testLimiter, so the refusal
    // body is byte-identical. This asserts the classifier is route-agnostic:
    // it keys on the response, never the URL.
    // The two inputs differ ONLY in config.url. If the classifier ever starts
    // reading the URL, these diverge and this test fails — which is the whole
    // claim. (Comparing two identical inputs would only assert determinism.)
    const provider = classifyTestProbeError(
      httpError(429, rateLimitBody(7), {}, '/api/integrations/credentials/ses/test'),
    )
    const byId = classifyTestProbeError(
      httpError(429, rateLimitBody(7), {}, '/api/integrations/5/test'),
    )
    expect(byId).toEqual(provider)
    expect(byId.status).toBe(INTEGRATION_TEST_STATUS.RATE_LIMITED)
    expect(byId.retryAfterSeconds).toBe(7)
  })

  it('reads Retry-After when the body omits retry_after', () => {
    const out = classifyTestProbeError(
      httpError(429, rateLimitBody(), { 'retry-after': '45' }),
    )
    expect(out.retryAfterSeconds).toBe(45)
    expect(out.detail).toContain('45s')
  })

  it('accepts a capitalised Retry-After header key', () => {
    const out = classifyTestProbeError(httpError(429, undefined, { 'Retry-After': '9' }))
    expect(out.retryAfterSeconds).toBe(9)
  })

  it('prefers the body retry_after over the header', () => {
    const out = classifyTestProbeError(
      httpError(429, rateLimitBody(12), { 'retry-after': '99' }),
    )
    expect(out.retryAfterSeconds).toBe(12)
  })

  it('classifies a bodyless 429 (proxy-synthesised) as rate_limited', () => {
    const out = classifyTestProbeError(httpError(429, '<html>429</html>'))
    expect(out.status).toBe(INTEGRATION_TEST_STATUS.RATE_LIMITED)
    expect(out.retryAfterSeconds).toBeUndefined()
    expect(out.detail).toContain('a moment')
  })

  it('honours the reason code even if a gateway rewrote the status', () => {
    const out = classifyTestProbeError(httpError(502, rateLimitBody(5)))
    expect(out.status).toBe(INTEGRATION_TEST_STATUS.RATE_LIMITED)
    expect(out.retryAfterSeconds).toBe(5)
  })

  it('rejects a non-positive or unparseable retry hint rather than showing 0s', () => {
    expect(classifyTestProbeError(httpError(429, rateLimitBody(0))).retryAfterSeconds)
      .toBeUndefined()
    expect(classifyTestProbeError(httpError(429, rateLimitBody(-3))).retryAfterSeconds)
      .toBeUndefined()
    expect(
      classifyTestProbeError(httpError(429, undefined, { 'retry-after': 'soon' }))
        .retryAfterSeconds,
    ).toBeUndefined()
  })

  it('classifies a 500 as error, not as a throttle', () => {
    const out = classifyTestProbeError(httpError(500, { error: 'probe panicked' }))
    expect(out.status).toBe(INTEGRATION_TEST_STATUS.ERROR)
    expect(out.detail).toBe('probe panicked')
    expect(out.retryAfterSeconds).toBeUndefined()
  })

  it('classifies a 403 as error', () => {
    const out = classifyTestProbeError(httpError(403, { error: 'admin role required' }))
    expect(out.status).toBe(INTEGRATION_TEST_STATUS.ERROR)
    expect(out.detail).toBe('admin role required')
  })

  it('falls back to the transport message, then a generic string', () => {
    expect(classifyTestProbeError({ message: 'Network Error' }).detail).toBe('Network Error')
    expect(classifyTestProbeError({}).detail).toBe('Request failed')
    expect(classifyTestProbeError(undefined).detail).toBe('Request failed')
    expect(classifyTestProbeError(undefined).status).toBe(INTEGRATION_TEST_STATUS.ERROR)
  })

  it('never answers the legacy invented status "failed"', () => {
    // The catch this replaced set status:'failed' — a value no backend sends
    // and nothing else in the app understands.
    for (const err of [httpError(429, rateLimitBody(3)), httpError(500, {}), {}]) {
      expect(classifyTestProbeError(err).status).not.toBe('failed')
    }
  })
})

describe('rateLimitedDetail', () => {
  it('is the single source for the throttle sentence', () => {
    expect(rateLimitedDetail(20)).toContain('Try again in 20s')
    expect(rateLimitedDetail()).toContain('Try again in a moment')
  })
})
