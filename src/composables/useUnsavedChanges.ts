import { ref, watch, onBeforeUnmount, type Ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

export function useUnsavedChanges(watchSource: Ref<string>) {
  const isDirty = ref(false)
  const initialValue = ref('')
  let initialized = false

  function markClean() {
    initialValue.value = watchSource.value
    isDirty.value = false
    initialized = true
  }

  watch(watchSource, (val) => {
    if (!initialized) {
      initialValue.value = val
      initialized = true
      return
    }
    isDirty.value = val !== initialValue.value
  })

  function onBeforeUnload(e: BeforeUnloadEvent) {
    if (isDirty.value) {
      e.preventDefault()
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', onBeforeUnload)
  }

  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', onBeforeUnload)
  })

  onBeforeRouteLeave(() => {
    if (isDirty.value) {
      return window.confirm('You have unsaved changes. Are you sure you want to leave?')
    }
    return true
  })

  return { isDirty, markClean }
}
