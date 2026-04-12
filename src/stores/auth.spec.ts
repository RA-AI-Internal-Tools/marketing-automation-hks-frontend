// Spec for the auth store's role logic + session marker persistence. Uses a
// mock for the axios client so login() doesn't hit the network.
//
// Post-phase-4 of cookie-auth: the store no longer tracks the JWT. The JWT
// lives in an HTTP-only cookie the browser attaches automatically. The only
// client-side "is logged in" signal is the AUTH_EMAIL marker in localStorage.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from './auth'
import { STORAGE_KEYS } from '@/constants/storage'

vi.mock('@/api/client', () => {
  return {
    default: {
      post: vi.fn(),
      get: vi.fn(),
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    },
  }
})

import api from '@/api/client'

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('hydrates from localStorage on init', () => {
    localStorage.setItem(STORAGE_KEYS.AUTH_EMAIL, 'x@y.com')
    localStorage.setItem(STORAGE_KEYS.AUTH_ROLE, 'admin')
    localStorage.setItem(STORAGE_KEYS.AUTH_NAME, 'Admin')
    const auth = useAuthStore()
    expect(auth.email).toBe('x@y.com')
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.isAdmin).toBe(true)
    expect(auth.canWrite).toBe(true)
  })

  it('isAdmin true only for admin role', () => {
    const auth = useAuthStore()
    auth.role = 'editor'
    expect(auth.isAdmin).toBe(false)
    expect(auth.isEditor).toBe(true)
    expect(auth.canWrite).toBe(true)

    auth.role = 'viewer'
    expect(auth.isAdmin).toBe(false)
    expect(auth.isEditor).toBe(false)
    expect(auth.canWrite).toBe(false)
    expect(auth.canManageUsers).toBe(false)
  })

  it('login persists email/role/name to localStorage but NOT the token', async () => {
    ;(api.post as any).mockResolvedValueOnce({
      data: { token: 'jwt-xyz', email: 'admin@x.com', role: 'admin', name: 'Admin' },
    })
    const auth = useAuthStore()
    await auth.login('admin@x.com', 'pw')
    expect(auth.email).toBe('admin@x.com')
    expect(auth.role).toBe('admin')
    expect(auth.isAdmin).toBe(true)
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_EMAIL)).toBe('admin@x.com')
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_ROLE)).toBe('admin')
    // The JWT is in an HTTP-only cookie set by the server — never localStorage.
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)).toBeNull()
  })

  it('login defaults role to viewer when server omits it', async () => {
    ;(api.post as any).mockResolvedValueOnce({
      data: { token: 't', email: 'e@e.com' /* no role, no name */ },
    })
    const auth = useAuthStore()
    await auth.login('e@e.com', 'pw')
    expect(auth.role).toBe('viewer')
    expect(auth.isEditor).toBe(false)
  })

  it('logout clears store state, localStorage markers, and legacy token', async () => {
    ;(api.post as any).mockResolvedValueOnce({ data: { status: 'logged_out' } })
    localStorage.setItem(STORAGE_KEYS.AUTH_EMAIL, 'e@e.com')
    localStorage.setItem(STORAGE_KEYS.AUTH_ROLE, 'admin')
    // Residue from a pre-phase-4 session — logout should still clean it up.
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, 'legacy')
    const auth = useAuthStore()
    await auth.logout()
    expect(auth.email).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_EMAIL)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)).toBeNull()
  })

  it('surfaces server error on login failure', async () => {
    ;(api.post as any).mockRejectedValueOnce({
      response: { data: { error: 'invalid credentials' } },
    })
    const auth = useAuthStore()
    await expect(auth.login('a@b.com', 'wrong')).rejects.toMatchObject({
      response: { data: { error: 'invalid credentials' } },
    })
    // No state mutation on failure.
    expect(auth.email).toBeNull()
  })
})
