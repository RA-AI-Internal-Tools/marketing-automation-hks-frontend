// Spec for the auth store's role logic + token persistence. Uses a mock for
// the axios client so login() doesn't hit the network.
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
  })

  it('hydrates from localStorage on init', () => {
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, 'tok-123')
    localStorage.setItem(STORAGE_KEYS.AUTH_EMAIL, 'x@y.com')
    localStorage.setItem(STORAGE_KEYS.AUTH_ROLE, 'admin')
    localStorage.setItem(STORAGE_KEYS.AUTH_NAME, 'Admin')
    const auth = useAuthStore()
    expect(auth.token).toBe('tok-123')
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

  it('login persists token + role to localStorage', async () => {
    ;(api.post as any).mockResolvedValueOnce({
      data: { token: 'jwt-xyz', email: 'admin@x.com', role: 'admin', name: 'Admin' },
    })
    const auth = useAuthStore()
    await auth.login('admin@x.com', 'pw')
    expect(auth.token).toBe('jwt-xyz')
    expect(auth.role).toBe('admin')
    expect(auth.isAdmin).toBe(true)
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)).toBe('jwt-xyz')
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_ROLE)).toBe('admin')
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

  it('logout clears both store state and localStorage', () => {
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, 'present')
    localStorage.setItem(STORAGE_KEYS.AUTH_EMAIL, 'e@e.com')
    const auth = useAuthStore()
    auth.logout()
    expect(auth.token).toBeNull()
    expect(auth.email).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_EMAIL)).toBeNull()
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
    expect(auth.token).toBeNull()
  })
})
