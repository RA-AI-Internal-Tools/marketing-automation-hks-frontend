import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import api from '../client'
import { STORAGE_KEYS } from '@/constants/storage'

// Regression guard for the 2026-07-30 topology collapse.
//
// The deployment is now a SINGLE api container behind a host nginx that serves
// plain `/api/*`; the `/api/sandbox/*` and `/api/production/*` routes are
// retired and return 404. A previous revision of client.ts installed a request
// interceptor that rewrote `/api/x` into `/api/{activeEnv}/x` — shipping that
// against the current nginx 404s every API call and takes the dashboard down.
//
// These tests run the real interceptor chain by swapping in a capturing
// adapter, so they fail loudly if the rewrite is ever reintroduced.

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

describe('api client URL emission', () => {
  it('sends /api/* paths verbatim — no env prefix is injected', async () => {
    await api.get('/api/campaigns')
    expect(captured!.url).toBe('/api/campaigns')
  })

  it('does not inject an env prefix even when localStorage says sandbox', async () => {
    localStorage.setItem(STORAGE_KEYS.ENVIRONMENT, 'sandbox')
    await api.get('/api/integrations/credentials?environment=production')
    expect(captured!.url).toBe('/api/integrations/credentials?environment=production')
    expect(captured!.url).not.toContain('/api/sandbox/')
    expect(captured!.url).not.toContain('/api/production/')
  })

  it('does not inject an env prefix when localStorage says production', async () => {
    localStorage.setItem(STORAGE_KEYS.ENVIRONMENT, 'production')
    await api.post('/api/auth/login', { email: 'a@b.com' })
    expect(captured!.url).toBe('/api/auth/login')
  })

  it('leaves the SSE path alone', async () => {
    await api.post('/api/sse/token')
    expect(captured!.url).toBe('/api/sse/token')
  })

  it('does not send the X-Environment header', async () => {
    localStorage.setItem(STORAGE_KEYS.ENVIRONMENT, 'sandbox')
    await api.get('/api/dashboard')
    expect(captured!.headers['X-Environment']).toBeUndefined()
  })

  it('still echoes the CSRF cookie on state-changing requests', async () => {
    document.cookie = 'ma_csrf=deadbeef'
    await api.post('/api/campaigns', {})
    expect(captured!.headers['X-CSRF-Token']).toBe('deadbeef')
  })
})

/**
 * The 401 interceptor exists for logged-in operators: a 401 means the session
 * died, so wipe local auth state and bounce to /login.
 *
 * On the public preference centre that reflex is actively harmful. The visitor
 * is the recipient of a marketing email with no session at all; a 401 there
 * means "this unsubscribe link expired", and sending them to an operator login
 * page they can never pass removes the only route off our mailing list — on the
 * one screen that is a legal obligation. Those pages use the interceptor-free
 * instance in ./publicPreferences, so this branch is the belt to that braces;
 * it is also the branch nothing else would notice if it broke.
 *
 * The match is anchored on purpose — `/preferences` exactly, or a `/preferences/`
 * prefix — so an operator route that merely starts with the same letters keeps
 * the normal redirect. Both directions are asserted.
 */
describe('401 redirect skips the public preference-centre subtree', () => {
  const realLocation = window.location

  /**
   * Replace `window.location` with a plain object: the interceptor reads
   * `.pathname` off it and writes `.href` to navigate, so a stub gives us both
   * the input and an observable outcome without happy-dom attempting a real
   * navigation.
   */
  function stubLocation(pathname: string): { pathname: string; href: string } {
    const stub = { pathname, href: '' }
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: stub,
    })
    return stub
  }

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: realLocation,
    })
  })

  /** Drive a real 401 through the real interceptor chain from `pathname`. */
  async function reject401From(pathname: string, url = '/api/public/preferences/tok') {
    const location = stubLocation(pathname)
    localStorage.setItem(STORAGE_KEYS.AUTH_EMAIL, 'operator@example.com')

    api.defaults.adapter = async (config) => {
      const c = config as InternalAxiosRequestConfig
      throw new AxiosError('Unauthorized', '401', c, {}, {
        data: { error: 'invalid_token' },
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config: c,
      } as never)
    }

    await expect(api.get(url)).rejects.toBeInstanceOf(AxiosError)
    return location
  }

  for (const pathname of ['/preferences', '/preferences/long-token-abc', '/preferences/confirm/short-1']) {
    it(`leaves a customer on ${pathname} — no bounce to /login`, async () => {
      const location = await reject401From(pathname)

      expect(location.href).toBe('')
      // Auth state belongs to whoever else may be using this browser; a
      // stranger's expired unsubscribe link must not log them out.
      expect(localStorage.getItem(STORAGE_KEYS.AUTH_EMAIL)).toBe('operator@example.com')
    })
  }

  it('still redirects from /preferences-admin — the prefix match is anchored', async () => {
    const location = await reject401From('/preferences-admin', '/api/preferences-admin/list')

    expect(location.href).toBe('/login')
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_EMAIL)).toBeNull()
  })

  it('still redirects an operator whose session died on an ordinary route', async () => {
    const location = await reject401From('/overview', '/api/dashboard')

    expect(location.href).toBe('/login')
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_EMAIL)).toBeNull()
  })
})
