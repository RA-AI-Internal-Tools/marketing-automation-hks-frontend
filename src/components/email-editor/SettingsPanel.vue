<script setup lang="ts">
import { ref, watch } from 'vue'
import { TEMPLATE_CATEGORIES, TEMPLATE_LANGUAGES } from '@/utils/email-template'

const props = defineProps<{
  name: string
  templateKey: string
  subject: string
  preheader: string
  fromName: string
  fromEmail: string
  replyTo: string
  category: string
  language: string
  tags: string[]
  isActive: boolean
}>()

const emit = defineEmits<{
  'update:name': [value: string]
  'update:templateKey': [value: string]
  'update:subject': [value: string]
  'update:preheader': [value: string]
  'update:fromName': [value: string]
  'update:fromEmail': [value: string]
  'update:replyTo': [value: string]
  'update:category': [value: string]
  'update:language': [value: string]
  'update:tags': [value: string[]]
  'update:isActive': [value: boolean]
}>()

const tagInput = ref('')

function addTag() {
  const tag = tagInput.value.trim()
  if (tag && !props.tags.includes(tag)) {
    emit('update:tags', [...props.tags, tag])
  }
  tagInput.value = ''
}

function removeTag(tag: string) {
  emit('update:tags', props.tags.filter((t) => t !== tag))
}

function handleTagKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    addTag()
  }
  if (e.key === 'Backspace' && !tagInput.value && props.tags.length > 0) {
    removeTag(props.tags[props.tags.length - 1]!)
  }
}

// Auto-generate template key from name
const autoKey = ref(true)
watch(() => props.name, (val) => {
  if (autoKey.value && !props.templateKey) {
    emit('update:templateKey', val.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))
  }
})

function onKeyManualEdit() {
  autoKey.value = false
}

const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0099db]/40 focus:border-[#0099db] transition-shadow'
const labelClass = 'block text-xs font-medium text-gray-600 mb-1'
</script>

<template>
  <div class="p-5 space-y-5">
    <h3 class="text-sm font-semibold text-gray-900">Template Settings</h3>

    <!-- Name & Key -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label :class="labelClass">
          Name <span class="text-red-500">*</span>
        </label>
        <input
          :value="name"
          @input="emit('update:name', ($event.target as HTMLInputElement).value)"
          :class="inputClass"
          placeholder="e.g. Welcome Email"
          required
        />
      </div>
      <div>
        <label :class="labelClass">
          Template Key <span class="text-red-500">*</span>
        </label>
        <input
          :value="templateKey"
          @input="emit('update:templateKey', ($event.target as HTMLInputElement).value); onKeyManualEdit()"
          :class="inputClass"
          placeholder="e.g. welcome_email"
          required
        />
      </div>
    </div>

    <!-- Subject -->
    <div>
      <label :class="labelClass">
        Subject Line <span class="text-red-500">*</span>
      </label>
      <input
        :value="subject"
        @input="emit('update:subject', ($event.target as HTMLInputElement).value)"
        :class="inputClass"
        placeholder="Email subject line — use {{first_name}} for personalization"
      />
      <p class="text-[11px] mt-1" :class="subject.length > 78 ? 'text-amber-500' : 'text-gray-400'">
        {{ subject.length }} / 78 characters recommended
      </p>
    </div>

    <!-- Preheader -->
    <div>
      <label :class="labelClass">Preheader Text</label>
      <input
        :value="preheader"
        @input="emit('update:preheader', ($event.target as HTMLInputElement).value)"
        :class="inputClass"
        placeholder="Preview text shown after subject in inbox"
      />
      <p class="text-[11px] mt-1" :class="preheader.length > 0 && (preheader.length < 40 || preheader.length > 130) ? 'text-amber-500' : 'text-gray-400'">
        {{ preheader.length > 0 ? `${preheader.length} / 40–130 characters recommended` : 'Recommended: 40–130 characters' }}
      </p>
    </div>

    <hr class="border-gray-100" />

    <!-- Sender Identity -->
    <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sender Identity</h4>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label :class="labelClass">From Name</label>
        <input
          :value="fromName"
          @input="emit('update:fromName', ($event.target as HTMLInputElement).value)"
          :class="inputClass"
          placeholder="e.g. HKS Global"
        />
      </div>
      <div>
        <label :class="labelClass">From Email</label>
        <input
          :value="fromEmail"
          @input="emit('update:fromEmail', ($event.target as HTMLInputElement).value)"
          :class="inputClass"
          type="email"
          placeholder="e.g. noreply@hks.com"
        />
      </div>
    </div>
    <div>
      <label :class="labelClass">Reply-To</label>
      <input
        :value="replyTo"
        @input="emit('update:replyTo', ($event.target as HTMLInputElement).value)"
        :class="inputClass"
        type="email"
        placeholder="e.g. support@hks.com"
      />
    </div>

    <hr class="border-gray-100" />

    <!-- Classification -->
    <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Classification</h4>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label :class="labelClass">Category</label>
        <select
          :value="category"
          @change="emit('update:category', ($event.target as HTMLSelectElement).value)"
          :class="inputClass"
        >
          <option value="">— Select —</option>
          <option v-for="c in TEMPLATE_CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
      </div>
      <div>
        <label :class="labelClass">Language</label>
        <select
          :value="language"
          @change="emit('update:language', ($event.target as HTMLSelectElement).value)"
          :class="inputClass"
        >
          <option value="">— Select —</option>
          <option v-for="l in TEMPLATE_LANGUAGES" :key="l.value" :value="l.value">{{ l.label }}</option>
        </select>
      </div>
    </div>

    <!-- Tags -->
    <div>
      <label :class="labelClass">Tags</label>
      <div class="flex flex-wrap items-center gap-1.5 p-2 border border-gray-200 rounded-lg bg-white min-h-[38px] focus-within:ring-2 focus-within:ring-[#0099db]/40 focus-within:border-[#0099db]">
        <span
          v-for="tag in tags"
          :key="tag"
          class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-50 text-[#020288] rounded-md"
        >
          {{ tag }}
          <button @click="removeTag(tag)" class="text-blue-300 hover:text-red-500 ml-0.5">&times;</button>
        </span>
        <input
          v-model="tagInput"
          @keydown="handleTagKeydown"
          @blur="addTag()"
          class="flex-1 min-w-[80px] text-sm outline-none bg-transparent"
          placeholder="Add tag..."
        />
      </div>
    </div>

    <!-- Active Toggle -->
    <div class="flex items-center justify-between py-2">
      <div>
        <p class="text-sm font-medium text-gray-700">Active</p>
        <p class="text-xs text-gray-400">Template is available for sending</p>
      </div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input
          :checked="isActive"
          @change="emit('update:isActive', ($event.target as HTMLInputElement).checked)"
          type="checkbox"
          class="sr-only peer"
        />
        <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#0099db]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[#020288] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
      </label>
    </div>
  </div>
</template>
