<script setup lang="ts">
import { ref, onMounted } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useReportsStore } from '@/stores/reports'
import { useAuthStore } from '@/stores/auth'
import { runReport } from '@/api/reports'
import type { ReportSchedule } from '@/api/types'

const store = useReportsStore()
const auth = useAuthStore()

// Dialog state
const showDialog = ref(false)
const editingId = ref<number | null>(null)
const formError = ref('')
const formSaving = ref(false)

const defaultForm = {
  name: '',
  schedule: 'weekly' as ReportSchedule['schedule'],
  modules: [] as string[],
  recipients: '',
  format: 'email' as ReportSchedule['format'],
  is_active: true,
}
const form = ref({ ...defaultForm })

const scheduleOptions: { label: string; value: ReportSchedule['schedule'] }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
]

const formatOptions: { label: string; value: ReportSchedule['format'] }[] = [
  { label: 'Email', value: 'email' },
  { label: 'PDF', value: 'pdf' },
]

const moduleOptions = [
  'campaigns', 'enrollments', 'channels', 'consents', 'logs', 'funnel',
]

function openCreate() {
  editingId.value = null
  form.value = { ...defaultForm, modules: [] }
  formError.value = ''
  showDialog.value = true
}

function openEdit(report: ReportSchedule) {
  editingId.value = report.id
  form.value = {
    name: report.name,
    schedule: report.schedule,
    modules: [...report.modules],
    recipients: report.recipients.join(', '),
    format: report.format,
    is_active: report.is_active,
  }
  formError.value = ''
  showDialog.value = true
}

function toggleModule(mod: string) {
  const idx = form.value.modules.indexOf(mod)
  if (idx >= 0) {
    form.value.modules.splice(idx, 1)
  } else {
    form.value.modules.push(mod)
  }
}

async function handleSave() {
  formError.value = ''
  if (!form.value.name.trim()) { formError.value = 'Name is required'; return }
  if (!form.value.modules.length) { formError.value = 'Select at least one module'; return }
  const recipients = form.value.recipients.split(',').map((r) => r.trim()).filter(Boolean)
  if (!recipients.length) { formError.value = 'At least one recipient email is required'; return }

  formSaving.value = true
  try {
    const payload = {
      name: form.value.name.trim(),
      schedule: form.value.schedule,
      modules: form.value.modules,
      recipients,
      format: form.value.format,
      is_active: form.value.is_active,
    }
    if (editingId.value) {
      await store.update(editingId.value, payload)
    } else {
      await store.create(payload)
    }
    showDialog.value = false
  } catch (e: any) {
    formError.value = e.response?.data?.error || 'Failed to save report'
  } finally {
    formSaving.value = false
  }
}

onMounted(() => store.load())

async function handleRunNow(id: number) {
  try {
    await runReport(id)
    store.load()
  } catch (e: any) {
    alert(e.response?.data?.error || 'Failed to run report')
  }
}

async function handleDelete(id: number) {
  if (!confirm('Are you sure you want to delete this report schedule?')) return
  store.remove(id)
}
</script>

<template>
  <div>
    <PageHeader title="Automated Reports" description="Configure scheduled report generation and delivery">
      <button
        v-if="auth.canWrite"
        @click="openCreate"
        class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
      >
        Create Report
      </button>
    </PageHeader>

    <!-- Create / Edit Dialog -->
    <teleport to="body">
      <div v-if="showDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div class="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900">{{ editingId ? 'Edit Report' : 'Create Report' }}</h2>

          <div v-if="formError" class="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">{{ formError }}</div>

          <!-- Name -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input v-model="form.name" type="text" placeholder="e.g. Weekly Campaign Summary"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <!-- Schedule -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
            <select v-model="form.schedule"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option v-for="opt in scheduleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>

          <!-- Format -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Format</label>
            <select v-model="form.format"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option v-for="opt in formatOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>

          <!-- Modules -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Report Modules</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="mod in moduleOptions" :key="mod"
                @click="toggleModule(mod)"
                :class="[
                  'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
                  form.modules.includes(mod)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50',
                ]"
              >
                {{ mod }}
              </button>
            </div>
          </div>

          <!-- Recipients -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Recipients (comma-separated emails)</label>
            <input v-model="form.recipients" type="text" placeholder="alice@example.com, bob@example.com"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <!-- Active -->
          <label class="flex items-center gap-2 text-sm text-gray-700">
            <input v-model="form.is_active" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            Active
          </label>

          <!-- Actions -->
          <div class="flex justify-end gap-3 pt-2">
            <button @click="showDialog = false" :disabled="formSaving"
              class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button @click="handleSave" :disabled="formSaving"
              class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {{ formSaving ? 'Saving...' : (editingId ? 'Update' : 'Create') }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <div v-if="store.loading" class="text-center py-12 text-gray-400">Loading...</div>
    <div v-else class="space-y-6">
      <div v-if="!store.reports.length" class="text-center py-12">
        <p class="text-gray-400 mb-4">No report schedules configured</p>
      </div>

      <div v-for="report in store.reports" :key="report.id" class="bg-white rounded-xl border border-gray-200 p-6">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-gray-900">{{ report.name }}</h3>
            <p class="text-xs text-gray-500 mt-1">
              {{ report.schedule }} &middot; {{ report.format }} &middot;
              {{ report.recipients.join(', ') }}
            </p>
            <div class="flex flex-wrap gap-1 mt-2">
              <span
                v-for="m in report.modules"
                :key="m"
                class="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full"
              >
                {{ m }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <StatusBadge :status="report.is_active ? 'active' : 'expired'" />
            <button
              v-if="auth.canWrite"
              @click="openEdit(report)"
              class="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              v-if="auth.canWrite"
              @click="handleRunNow(report.id)"
              class="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50"
            >
              Run Now
            </button>
            <button
              v-if="auth.canWrite"
              @click="handleDelete(report.id)"
              class="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
        <p v-if="report.last_run_at" class="text-xs text-gray-400 mt-2">
          Last run: {{ new Date(report.last_run_at).toLocaleString() }}
        </p>
      </div>
    </div>
  </div>
</template>
