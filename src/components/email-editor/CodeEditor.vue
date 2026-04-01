<script setup lang="ts">
import { ref, shallowRef, computed } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { html } from '@codemirror/lang-html'
import { oneDark } from '@codemirror/theme-one-dark'
import type { EditorView } from '@codemirror/view'
import { useTheme } from '@/composables/useTheme'

const props = defineProps<{
  modelValue: string
  readonly?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { isDark } = useTheme()

const view = shallowRef<EditorView>()
const extensions = computed(() => {
  if (isDark.value) return [html(), oneDark]
  return [html()]
})
const editorRef = ref<InstanceType<typeof Codemirror>>()

function handleReady(payload: { view: EditorView }) {
  view.value = payload.view
}

function handleChange(value: string) {
  emit('update:modelValue', value)
}

function insertAtCursor(text: string) {
  const v = view.value
  if (!v) return
  const pos = v.state.selection.main.head
  v.dispatch({
    changes: { from: pos, to: pos, insert: text },
    selection: { anchor: pos + text.length },
  })
  v.focus()
}

defineExpose({ insertAtCursor })
</script>

<template>
  <div class="code-editor-wrapper rounded-lg overflow-hidden border border-[var(--color-border-strong)]">
    <Codemirror
      ref="editorRef"
      :model-value="props.modelValue"
      :placeholder="props.placeholder || 'Write your HTML email template here...'"
      :extensions="extensions"
      :disabled="props.readonly"
      :style="{ minHeight: '400px', fontSize: '13px' }"
      :tab-size="2"
      :indent-with-tab="true"
      @update:model-value="handleChange"
      @ready="handleReady"
    />
  </div>
</template>

<style>
.code-editor-wrapper .cm-editor {
  min-height: 400px;
  max-height: calc(100vh - 320px);
  border-radius: 0.5rem;
}
.code-editor-wrapper .cm-editor .cm-scroller {
  overflow: auto;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Monaco, 'Cascadia Code', ui-monospace, monospace;
}
.code-editor-wrapper .cm-editor.cm-focused {
  outline: 2px solid rgba(0, 153, 219, 0.4);
  outline-offset: -1px;
}
</style>
