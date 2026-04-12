<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import { renderTemplate } from '@/utils/email-template'
import {
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/vue/24/outline'

const props = defineProps<{
  html: string
  subject: string
  preheader: string
  sampleData: Record<string, any>
}>()

type ViewMode = 'desktop' | 'mobile'
const viewMode = ref<ViewMode>('desktop')
const darkBg = ref(false)
const iframeHeight = ref(400)

const renderedSubject = computed(() => renderTemplate(props.subject, props.sampleData))
const renderedPreheader = computed(() => renderTemplate(props.preheader, props.sampleData))

// Rendered HTML is debounced 250ms so keystrokes in the Code tab don't
// fire a full renderTemplate + DOMPurify.sanitize pass on every character.
// On a ~20KB template those two together can push well past one frame and
// make typing feel laggy. 250ms is invisible on deliberate pauses and
// eliminates the per-keystroke work.
const renderedHtml = ref<string>('')
const previewStale = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function recomputePreview() {
  previewStale.value = false
  if (!props.html.trim()) {
    renderedHtml.value = ''
    return
  }
  const rendered = renderTemplate(props.html, props.sampleData)
  renderedHtml.value = DOMPurify.sanitize(rendered, {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ['style', 'link'],
    ADD_ATTR: ['target', 'align', 'valign', 'bgcolor', 'cellpadding', 'cellspacing', 'border', 'width', 'height'],
  })
}

watch(() => [props.html, props.sampleData] as const, () => {
  previewStale.value = true
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(recomputePreview, 250)
}, { immediate: true, deep: true })

const iframeWidth = computed(() => (viewMode.value === 'mobile' ? '375px' : '100%'))

function handleIframeLoad(e: Event) {
  const iframe = e.target as HTMLIFrameElement
  try {
    const doc = iframe.contentDocument
    if (doc?.body) {
      const height = doc.body.scrollHeight
      iframeHeight.value = Math.max(400, height + 32)
    }
  } catch {
    // Cross-origin or sandbox restriction — keep default height
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Preview Controls -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
      <div class="flex items-center gap-1">
        <button
          @click="viewMode = 'desktop'"
          :class="[
            'p-2 rounded-lg transition-colors',
            viewMode === 'desktop' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-muted)]',
          ]"
          title="Desktop preview"
          aria-label="Switch to desktop preview"
          :aria-pressed="viewMode === 'desktop'"
        >
          <ComputerDesktopIcon class="h-[18px] w-[18px]" />
        </button>
        <button
          @click="viewMode = 'mobile'"
          :class="[
            'p-2 rounded-lg transition-colors',
            viewMode === 'mobile' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-muted)]',
          ]"
          title="Mobile preview"
          aria-label="Switch to mobile preview"
          :aria-pressed="viewMode === 'mobile'"
        >
          <DevicePhoneMobileIcon class="h-[18px] w-[18px]" />
        </button>
        <div class="w-px h-5 bg-[var(--color-border)] mx-1.5" aria-hidden="true"></div>
        <button
          @click="darkBg = !darkBg"
          class="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-muted)] transition-colors"
          :title="darkBg ? 'Light background' : 'Dark background'"
          :aria-label="darkBg ? 'Use light preview background' : 'Use dark preview background'"
          :aria-pressed="darkBg"
        >
          <MoonIcon v-if="!darkBg" class="h-[18px] w-[18px]" />
          <SunIcon v-else class="h-[18px] w-[18px]" />
        </button>
      </div>
      <div class="flex items-center gap-2 text-xs text-[var(--color-text-muted)]" role="status" aria-live="polite">
        <span v-if="previewStale" class="text-amber-600 dark:text-amber-400">updating…</span>
        <span>{{ viewMode === 'mobile' ? '375px' : 'Full width' }}</span>
      </div>
    </div>

    <!-- Subject & Preheader Preview -->
    <div v-if="subject || preheader" class="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-card)]">
      <div v-if="renderedSubject" class="text-sm font-semibold text-[var(--color-text-primary)] truncate">
        {{ renderedSubject }}
      </div>
      <div v-if="renderedPreheader" class="text-xs text-[var(--color-text-tertiary)] mt-0.5 truncate">
        {{ renderedPreheader }}
      </div>
    </div>

    <!-- Iframe Preview -->
    <div
      class="flex-1 overflow-auto flex justify-center p-4"
      :class="darkBg ? 'bg-gray-900' : 'bg-[var(--color-bg-subtle)]'"
    >
      <div v-if="!html.trim()" class="flex items-center justify-center w-full min-h-[300px]">
        <div class="text-center text-[var(--color-text-muted)]">
          <svg class="mx-auto h-12 w-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
          <p class="text-sm font-medium">No content to preview</p>
          <p class="text-xs mt-1">Write HTML in the Code tab to see a preview here</p>
        </div>
      </div>
      <iframe
        v-else
        :srcdoc="renderedHtml"
        sandbox="allow-same-origin"
        :style="{ width: iframeWidth, maxWidth: '100%', height: iframeHeight + 'px' }"
        class="bg-white rounded-lg shadow-md border-0 transition-all duration-300"
        title="Email preview"
        @load="handleIframeLoad"
      ></iframe>
    </div>
  </div>
</template>
