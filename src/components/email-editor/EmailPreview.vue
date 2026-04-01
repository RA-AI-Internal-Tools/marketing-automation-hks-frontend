<script setup lang="ts">
import { computed, ref } from 'vue'
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

const renderedHtml = computed(() => {
  if (!props.html.trim()) return ''
  const rendered = renderTemplate(props.html, props.sampleData)
  return DOMPurify.sanitize(rendered, {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ['style', 'link'],
    ADD_ATTR: ['target', 'align', 'valign', 'bgcolor', 'cellpadding', 'cellspacing', 'border', 'width', 'height'],
  })
})

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
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50/80">
      <div class="flex items-center gap-1">
        <button
          @click="viewMode = 'desktop'"
          :class="[
            'p-2 rounded-lg transition-colors',
            viewMode === 'desktop' ? 'bg-[#020288] text-white' : 'text-gray-500 hover:bg-gray-200',
          ]"
          title="Desktop preview"
        >
          <ComputerDesktopIcon class="h-[18px] w-[18px]" />
        </button>
        <button
          @click="viewMode = 'mobile'"
          :class="[
            'p-2 rounded-lg transition-colors',
            viewMode === 'mobile' ? 'bg-[#020288] text-white' : 'text-gray-500 hover:bg-gray-200',
          ]"
          title="Mobile preview"
        >
          <DevicePhoneMobileIcon class="h-[18px] w-[18px]" />
        </button>
        <div class="w-px h-5 bg-gray-300 mx-1.5"></div>
        <button
          @click="darkBg = !darkBg"
          class="p-2 rounded-lg text-gray-500 hover:bg-gray-200 transition-colors"
          :title="darkBg ? 'Light background' : 'Dark background'"
        >
          <MoonIcon v-if="!darkBg" class="h-[18px] w-[18px]" />
          <SunIcon v-else class="h-[18px] w-[18px]" />
        </button>
      </div>
      <span class="text-xs text-gray-400">{{ viewMode === 'mobile' ? '375px' : 'Full width' }}</span>
    </div>

    <!-- Subject & Preheader Preview -->
    <div v-if="subject || preheader" class="px-4 py-3 border-b border-gray-200 bg-white">
      <div v-if="renderedSubject" class="text-sm font-semibold text-gray-900 truncate">
        {{ renderedSubject }}
      </div>
      <div v-if="renderedPreheader" class="text-xs text-gray-500 mt-0.5 truncate">
        {{ renderedPreheader }}
      </div>
    </div>

    <!-- Iframe Preview -->
    <div
      class="flex-1 overflow-auto flex justify-center p-4"
      :class="darkBg ? 'bg-gray-900' : 'bg-gray-100'"
    >
      <div v-if="!html.trim()" class="flex items-center justify-center w-full min-h-[300px]">
        <div class="text-center text-gray-400">
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
