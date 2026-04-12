import { ref, type Ref } from 'vue'

/**
 * useAction — wrap any async function with in-flight guarding + error state.
 *
 * The UI convention until now was "disable the button while the fetch runs"
 * but that relied on every caller site remembering to track its own boolean.
 * A fast double-click in the moment between `click` and `button.disabled=true`
 * could still queue two identical POSTs (e.g. create the same broadcast
 * twice). useAction short-circuits the second call at the composable layer,
 * which is race-free regardless of what the button does.
 *
 * Usage:
 *   const { execute, pending, error } = useAction(saveBroadcast)
 *   <button :disabled="pending" @click="execute(form)">Save</button>
 *   <p v-if="error" class="text-red-600">{{ error }}</p>
 *
 * Not meant for GET fetches — pair reads with useCache; pair writes with
 * useAction. Multiple useAction calls on independent functions run
 * independently (the guard is per-function, not global).
 */
export interface UseActionReturn<T extends (...args: any[]) => Promise<any>> {
  execute: (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | undefined>
  pending: Ref<boolean>
  error:   Ref<string | null>
  reset:   () => void
}

export function useAction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
): UseActionReturn<T> {
  const pending = ref(false)
  const error   = ref<string | null>(null)

  async function execute(...args: Parameters<T>): Promise<Awaited<ReturnType<T>> | undefined> {
    if (pending.value) {
      // In-flight — silently drop. Caller can observe `pending` if they want
      // to tell the user; usual pattern is to disable the button so this
      // branch is rarely hit.
      return undefined
    }
    pending.value = true
    error.value = null
    try {
      return (await fn(...args)) as Awaited<ReturnType<T>>
    } catch (e: any) {
      error.value = e?.response?.data?.error || e?.message || 'Request failed'
      throw e  // still propagate — callers that want to react (e.g. close a
               // modal on success only) can still catch. useAction is purely
               // adding guarding and state, not swallowing errors.
    } finally {
      pending.value = false
    }
  }

  function reset() { error.value = null }

  return { execute, pending, error, reset }
}
