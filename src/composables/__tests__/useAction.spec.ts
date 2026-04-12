import { describe, it, expect, vi } from 'vitest'
import { useAction } from '../useAction'

describe('useAction', () => {
  it('sets pending true during execution, false after', async () => {
    let resolveFn!: (v: string) => void
    const slow = vi.fn(() => new Promise<string>(r => { resolveFn = r }))
    const { execute, pending } = useAction(slow)

    expect(pending.value).toBe(false)
    const promise = execute()
    expect(pending.value).toBe(true)
    resolveFn('done')
    await promise
    expect(pending.value).toBe(false)
  })

  it('drops concurrent calls while in-flight', async () => {
    let resolveFn!: (v: string) => void
    const fn = vi.fn(() => new Promise<string>(r => { resolveFn = r }))
    const { execute } = useAction(fn)

    const first = execute()
    const second = execute()  // should short-circuit
    resolveFn('ok')
    await Promise.all([first, second])

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('captures error message from axios-style error response', async () => {
    const rejecting = vi.fn(() =>
      Promise.reject({ response: { data: { error: 'validation failed' } } }),
    )
    const { execute, error } = useAction(rejecting)
    await expect(execute()).rejects.toBeTruthy()
    expect(error.value).toBe('validation failed')
  })

  it('falls back to e.message when response.data.error is absent', async () => {
    const rejecting = vi.fn(() => Promise.reject(new Error('network down')))
    const { execute, error } = useAction(rejecting)
    await expect(execute()).rejects.toBeTruthy()
    expect(error.value).toBe('network down')
  })

  it('reset() clears error without affecting pending', async () => {
    const rejecting = vi.fn(() => Promise.reject(new Error('oops')))
    const { execute, error, reset, pending } = useAction(rejecting)
    await execute().catch(() => {})
    expect(error.value).toBe('oops')
    reset()
    expect(error.value).toBeNull()
    expect(pending.value).toBe(false)
  })

  it('rethrows so callers can chain .then/.catch', async () => {
    const fn = vi.fn(() => Promise.resolve('success'))
    const { execute } = useAction(fn)
    const result = await execute()
    expect(result).toBe('success')
  })
})
