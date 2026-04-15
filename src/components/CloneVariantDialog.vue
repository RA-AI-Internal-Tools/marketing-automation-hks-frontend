<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { LanguageIcon } from '@heroicons/vue/24/outline'
import { TEMPLATE_LANGUAGES, buildLocalizedTemplateKey } from '@/utils/email-template'
import ModalWrapper from './ModalWrapper.vue'

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
  <ModalWrapper
    :model-value="props.open"
    title="Clone as locale variant"
    size="sm"
    @update:model-value="(v) => { if (!v) emit('cancel') }"
    @close="emit('cancel')"
  >
    <template #header-extra>
      <LanguageIcon class="h-5 w-5 text-[var(--color-primary)]" />
    </template>
    <template #body>
      <p class="text-sm text-[var(--color-text-secondary)] mb-4">
        Duplicates <code class="px-1 py-0.5 rounded bg-[var(--color-bg-subtle)] text-xs">{{ baseKey }}</code>
        into an inactive draft. Edit the translated copy, then activate.
      </p>
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

      <div
        v-if="selected"
        class="mt-4 px-3 py-2.5 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border-muted)]"
      >
        <p class="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
          New template key
        </p>
        <code class="text-sm text-[var(--color-text-primary)] font-mono">{{ resolvedKey }}</code>
      </div>
    </template>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="emit('cancel')">Cancel</button>
      <button type="button" :disabled="!selected" class="btn btn-primary" @click="submit">
        Create draft variant
      </button>
    </template>
  </ModalWrapper>
</template>
</content>
</invoke>