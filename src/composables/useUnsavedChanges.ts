import { ref, watch, onBeforeUnmount, type Ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

let activeListenerCount = 0
let sharedHandler: ((e: BeforeUnloadEvent) => void) | null = null
const dirtyInstances = new Set<symbol>()

function getSharedHandler() {
  if (!sharedHandler) {
    sharedHandler = (e: BeforeUnloadEvent) => {
      if (dirtyInstances.size > 0) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', sharedHandler)
  }
  return sharedHandler
}

function removeSharedHandler() {
  if (sharedHandler && activeListenerCount <= 0) {
    window.removeEventListener('beforeunload', sharedHandler)
    sharedHandler = null
  }
}

export function useUnsavedChanges(watchSource: Ref<string>) {
  const isDirty = ref(false)
  const initialValue = ref('')
  const instanceId = Symbol()
  let initialized = false

  // Register with shared handler
  if (typeof window !== 'undefined') {
    getSharedHandler()
    activeListenerCount++
  }

  function markClean() {
    initialValue.value = watchSource.value
    isDirty.value = false
    dirtyInstances.delete(instanceId)
    initialized = true
  }

  watch(watchSource, (val) => {
    if (!initialized) {
      initialValue.value = val
      initialized = true
      return
    }
    const dirty = val !== initialValue.value
    isDirty.value = dirty
    if (dirty) {
      dirtyInstances.add(instanceId)
    } else {
      dirtyInstances.delete(instanceId)
    }
  })

  onBeforeUnmount(() => {
    dirtyInstances.delete(instanceId)
    activeListenerCount--
    removeSharedHandler()
  })

  onBeforeRouteLeave(() => {
    if (isDirty.value) {
      return window.confirm('You have unsaved changes. Are you sure you want to leave?')
    }
    return true
  })

  return { isDirty, markClean }
}
