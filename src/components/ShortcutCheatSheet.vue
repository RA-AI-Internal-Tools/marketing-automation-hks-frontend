<script setup lang="ts">
// Triggered by the global `?` shortcut. Enumerates every currently
// mounted shortcut via `shortcutRegistry`, grouped into Global vs
// page-specific — callers don't have to re-declare their keymap here.
import { computed } from 'vue'
import ModalWrapper from './ModalWrapper.vue'
import { shortcutRegistry } from '@/composables/useKeyboardShortcuts'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const grouped = computed(() => {
  const globals = shortcutRegistry.list.filter((s) => s.global)
  const locals = shortcutRegistry.list.filter((s) => !s.global)
  return { globals, locals }
})
</script>

<template>
  <ModalWrapper
    :model-value="props.modelValue"
    title="Keyboard shortcuts"
    size="md"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #body>
      <div class="shortcut-sheet" data-shortcut-root="true">
        <section v-if="grouped.globals.length">
          <h4 class="shortcut-group">Global</h4>
          <table class="shortcut-table">
            <tbody>
              <tr v-for="s in grouped.globals" :key="'g-' + s.key + s.description">
                <td><kbd class="shortcut-kbd">{{ s.key }}</kbd></td>
                <td class="shortcut-desc">{{ s.description }}</td>
              </tr>
            </tbody>
          </table>
        </section>
        <section v-if="grouped.locals.length">
          <h4 class="shortcut-group">This page</h4>
          <table class="shortcut-table">
            <tbody>
              <tr v-for="s in grouped.locals" :key="'l-' + s.key + s.description">
                <td><kbd class="shortcut-kbd">{{ s.key }}</kbd></td>
                <td class="shortcut-desc">{{ s.description }}</td>
              </tr>
            </tbody>
          </table>
        </section>
        <p v-if="!grouped.globals.length && !grouped.locals.length" class="shortcut-empty">
          No shortcuts registered on this page.
        </p>
      </div>
    </template>
  </ModalWrapper>
</template>

<style scoped>
.shortcut-sheet { display: flex; flex-direction: column; gap: 18px; }
.shortcut-group {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--color-text-tertiary);
  margin: 0 0 8px;
}
.shortcut-table { width: 100%; border-collapse: collapse; }
.shortcut-table td {
  padding: 6px 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-divider);
}
.shortcut-table td:first-child { width: 80px; }
.shortcut-kbd {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  color: var(--color-text-primary);
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 4px;
}
.shortcut-desc { color: var(--color-text-secondary); }
.shortcut-empty { color: var(--color-text-muted); font-size: 13px; }
</style>
