import { describe, it, expect, beforeEach } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'
import api from '../client'
import { fetchUsers, fetchExecutiveOverview } from '../analytics'

// Regression guard for the deprecated analytics alias.
//
// `/api/analytics/users` was a legacy alias the Go backend scheduled for
// deletion after 2026-07-12 (routes_analytics.go:50-51). The canonical route
// is `/api/analytics/clients` (:52). Both bind to the SAME handler —
// `handleAnalyticsUsers` — because the legacy handler's entire body is a
// one-shot deprecation log plus `ar.handleAnalyticsUsers(c)` (:69-76), so the
// response shape is identical by construction and the swap is behaviour-free.
//
// The frontend never called the canonical path, which meant one backend
// cleanup commit would have 404'd the Clients page. This test pins the
// canonical path so a revert fails loudly rather than at runtime in prod.

let captured: InternalAxiosRequestConfig | null = null

beforeEach(() => {
  captured = null
  api.defaults.adapter = async (config) => {
    captured = config as InternalAxiosRequestConfig
    return {
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config: config as InternalAxiosRequestConfig,
    }
  }
})

describe('analytics api paths', () => {
  it('fetchUsers() targets the canonical /api/analytics/clients route', async () => {
    await fetchUsers()
    expect(captured!.url).toBe('/api/analytics/clients')
  })

  it('fetchUsers() never targets the deprecated /api/analytics/users alias', async () => {
    await fetchUsers('2026-01-01', '2026-01-31')
    expect(captured!.url).not.toBe('/api/analytics/users')
    expect(captured!.url).not.toContain('/analytics/users')
  })

  it('fetchUsers() still forwards the since/until window', async () => {
    await fetchUsers('2026-01-01', '2026-01-31')
    expect(captured!.params).toEqual({ since: '2026-01-01', until: '2026-01-31' })
  })

  it('sibling analytics calls are unaffected', async () => {
    await fetchExecutiveOverview()
    expect(captured!.url).toBe('/api/analytics/executive')
  })
})
