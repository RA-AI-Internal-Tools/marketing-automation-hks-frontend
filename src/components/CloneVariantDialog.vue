<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { XMarkIcon, LanguageIcon } from '@heroicons/vue/24/outline'
import { TEMPLATE_LANGUAGES, buildLocalizedTemplateKey } from '@/utils/email-template'

const props = defineProps<{
  open: boolean
  baseKey: string
  baseName: string
  existingLocales?: string[] // locales already authored for this base
}>()

const emit = defineEmits<{
  (e: 'confirm', locale: string): void
  (e: 'cancel'): void
}>()

const selected = ref<string>('')
const firstBtn = ref<HTMLButtonElement | null>(null)

const resolvedKey = computed(() =>
  selected.value ? buildLocalizedTemplateKey(props.baseKey, selected.value) : '',
)

const options = computed(() =>
  TEMPLATE_LANGUAGES.map((l) => ({
    ...l,
    taken: (props.existingLocales || []).includes(l.value),
  })),
)

function onKey(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') emit('cancel')
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

watch(() => props.open, async (v) => {
  if (v) {
    selected.value = ''
    await nextTick()
    firstBtn.value?.focus()
  }
})

function submit() {
  if (!selected.value) return
  emit('confirm', selected.value)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clone-variant-title"
        @click.self="emit('cancel')"
      >
        <div class="bg-[var(--color-bg-card)] w-full max-w-lg rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden">
          <!-- Header -->
          <div class="px-6 py-5 border-b border-[var(--color-border)] flex items-start gap-3">
            <div class="shrink-0 h-10 w-10 rounded-full bg-[var(--color-info-bg)] flex items-center justify-center">
              <LanguageIcon class="h-5 w-5 text-[var(--color-primary)]" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 id="clone-variant-title" class="text-base font-semibold text-[var(--color-text-primary)]">
                Clone as locale variant
              </h3>
              <p class="mt-1 text-sm text-[var(--color-text-secondary)]">
                Duplicates <code class="px-1 py-0.5 rounded bg-[var(--color-bg-subtle)] text-xs">{{ baseKey }}</code>
                into an inactive draft. Edit the translated copy, then activate.
              </p>
            </div>
            <button
              type="button"
              class="p-1 -m-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              aria-label="Close"
              @click="emit('cancel')"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <!-- Locale grid -->
          <div class="p-6">
            <p class="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
              Target locale
            </p>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="(l, idx) in options"
                :key="l.value"
                :ref="el => { if (idx === 0) firstBtn = el as HTMLButtonElement }"
                type="button"
                :disabled="l.taken"
                :class="[
                  'text-left px-3 py-2.5 rounded-lg border transition-all text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40',
                  l.taken
                    ? 'border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] cursor-not-allowed'
                    : selected === l.value
                      ? 'border-[var(--color-primary)] bg-[var(--color-info-bg)] text-[var(--color-primary)] shadow-sm'
                      : 'border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)] hover:border-[var(--color-primary-border)] hover:bg-[var(--color-bg-hover)]',
                ]"
                @click="selected = l.value"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="font-medium">{{ l.label }}</span>
                  <code class="text-[11px] text-[var(--color-text-muted)]">{{ l.value }}</code>
                </div>
                <span v-if="l.taken" class="text-[11px] text-[var(--color-text-muted)] italic">Already exists</span>
              </button>
            </div>

            <!-- Preview of the target key -->
            <div
              v-if="selected"
              class="mt-4 px-3 py-2.5 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border-muted)]"
            >
              <p class="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
                New template key
              </p>
              <code class="text-sm text-[var(--color-text-primary)] font-mono">{{ resolvedKey }}</code>
            </div>
          </div>

          <!-- Actions -->
          <div class="px-6 py-4 bg-[var(--color-bg-page)] border-t border-[var(--color-border)] flex items-center justify-end gap-2">
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-hover)]"
              @click="emit('cancel')"
            >
              Cancel
            </button>
            <button
              type="button"
              :disabled="!selected"
              class="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:ring-offset-1 focus:ring-offset-[var(--color-bg-card)]"
              @click="submit"
            >
              Create draft variant
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
