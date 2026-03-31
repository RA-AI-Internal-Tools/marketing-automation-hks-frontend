<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import { useCampaignsStore } from '@/stores/campaigns'
import type { Step, CampaignRequest } from '@/api/types'
import { useTemplatesStore } from '@/stores/templates'
import { PlusIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()
const store = useCampaignsStore()

const templatesStore = useTemplatesStore()

const isEdit = computed(() => !!route.params.id)
const campaignId = computed(() => Number(route.params.id))

const name = ref('')
const slug = ref('')
const triggerEvent = ref('')
const cancellationEvent = ref('')
const segmentFilter = ref('all')
const isActive = ref(true)
const steps = ref<Step[]>([{ delay_minutes: 0, channel: 'email', template_key: '', condition: 'always', condition_params: {} }])

const saving = ref(false)
const error = ref('')
const loading = ref(false)

const channels = ['email', 'sms', 'whatsapp', 'push']
const conditions = ['always', 'has_ordered_since', 'not_ordered_since', 'kyc_level_gte', 'spend_gte']
const segments = ['all', 'high_value', 'new_user', 'dormant']

function templatesForChannel(ch: string) {
  return templatesStore.templates.filter((t) => t.channel === ch)
}

onMounted(async () => {
  templatesStore.load()
  if (isEdit.value) {
    loading.value = true
    try {
      const campaign = await store.get(campaignId.value)
      name.value = campaign.name
      slug.value = campaign.slug
      triggerEvent.value = campaign.trigger_event
      cancellationEvent.value = campaign.cancellation_event || ''
      segmentFilter.value = campaign.segment_filter
      isActive.value = campaign.is_active
      steps.value = campaign.steps.length > 0 ? campaign.steps : [{ delay_minutes: 0, channel: 'email', template_key: '', condition: 'always' }]
    } catch {
      error.value = 'Failed to load campaign'
    } finally {
      loading.value = false
    }
  }
})

function addStep() {
  steps.value.push({ delay_minutes: 0, channel: 'email', template_key: '', condition: 'always' })
}

function removeStep(index: number) {
  steps.value.splice(index, 1)
}

function moveStep(index: number, direction: number) {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= steps.value.length) return
  const arr: Step[] = [...steps.value]
  const item = arr[index]!
  arr.splice(index, 1)
  arr.splice(newIndex, 0, item)
  steps.value = arr
}

async function handleSubmit() {
  error.value = ''
  saving.value = true
  try {
    const req: CampaignRequest = {
      name: name.value,
      slug: slug.value || undefined,
      trigger_event: triggerEvent.value,
      steps: steps.value,
      segment_filter: segmentFilter.value,
      cancellation_event: cancellationEvent.value || null,
      is_active: isActive.value,
    }

    if (isEdit.value) {
      await store.update(campaignId.value, req)
    } else {
      await store.create(req)
    }
    router.push('/campaigns')
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to save campaign'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader
      :title="isEdit ? 'Edit Campaign' : 'New Campaign'"
      :description="isEdit ? 'Modify campaign configuration and steps' : 'Create a new campaign workflow'"
    />

    <div v-if="loading" class="text-center py-12 text-gray-400">Loading...</div>

    <form v-else @submit.prevent="handleSubmit" class="space-y-6 max-w-3xl">
      <!-- Basic info -->
      <div class="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 class="text-sm font-semibold text-gray-900">Campaign Details</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input v-model="name" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Slug (auto-generated if empty)</label>
            <input v-model="slug" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="auto-generated" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Trigger Event</label>
            <input v-model="triggerEvent" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. order_completed" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Cancellation Event</label>
            <input v-model="cancellationEvent" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Optional" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Segment Filter</label>
            <select v-model="segmentFilter" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option v-for="seg in segments" :key="seg" :value="seg">{{ seg }}</option>
            </select>
          </div>
          <div class="flex items-center gap-3 pt-6">
            <label class="relative inline-flex items-center cursor-pointer">
              <input v-model="isActive" type="checkbox" class="sr-only peer" />
              <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </label>
            <span class="text-sm text-gray-700">Active</span>
          </div>
        </div>
      </div>

      <!-- Steps -->
      <div class="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-900">Workflow Steps</h3>
          <button type="button" @click="addStep" class="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
            <PlusIcon class="h-4 w-4" /> Add Step
          </button>
        </div>

        <div v-for="(step, i) in steps" :key="i" class="border border-gray-200 rounded-lg p-4 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-gray-500">Step {{ i + 1 }}</span>
            <div class="flex items-center gap-1">
              <button type="button" @click="moveStep(i, -1)" :disabled="i === 0" class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                <ArrowUpIcon class="h-4 w-4" />
              </button>
              <button type="button" @click="moveStep(i, 1)" :disabled="i === steps.length - 1" class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                <ArrowDownIcon class="h-4 w-4" />
              </button>
              <button type="button" @click="removeStep(i)" :disabled="steps.length <= 1" class="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30">
                <TrashIcon class="h-4 w-4" />
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label class="block text-xs text-gray-500 mb-1">Channel</label>
              <select v-model="step.channel" class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                <option v-for="ch in channels" :key="ch" :value="ch">{{ ch }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Template Key</label>
              <select
                v-if="templatesForChannel(step.channel).length > 0"
                v-model="step.template_key"
                class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              >
                <option value="">Select template...</option>
                <option v-for="t in templatesForChannel(step.channel)" :key="t.id" :value="t.template_key">
                  {{ t.name }} ({{ t.template_key }})
                </option>
              </select>
              <input v-else v-model="step.template_key" class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="template_key" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Delay (minutes)</label>
              <input v-model.number="step.delay_minutes" type="number" min="0" class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Condition</label>
              <select v-model="step.condition" class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                <option v-for="cond in conditions" :key="cond" :value="cond">{{ cond }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Error + Submit -->
      <div v-if="error" class="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{{ error }}</div>

      <div class="flex items-center gap-3">
        <button
          type="submit"
          :disabled="saving"
          class="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {{ saving ? 'Saving...' : isEdit ? 'Update Campaign' : 'Create Campaign' }}
        </button>
        <button
          type="button"
          @click="router.push('/campaigns')"
          class="px-6 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  </div>
</template>
