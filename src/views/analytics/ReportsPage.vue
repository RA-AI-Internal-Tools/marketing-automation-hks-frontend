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
  try {
    await store.remove(id)
  } catch (e: any) {
    alert(e.response?.data?.error || 'Failed to delete report')
  }
}
</script>

<template>
  <div>
    <PageHeader title="Automated Reports" description="Configure scheduled report generation and delivery">
      <button
        v-if="auth.canWrite"
        @click="openCreate"
        class="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors"
      >
        Create Report
      </button>
    </PageHeader>

    <!-- Create / Edit Dialog -->
    <teleport to="body">
      <div v-if="showDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div class="bg-[var(--color-bg-card)] rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
          <h2 class="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">{{ editingId ? 'Edit Report' : 'Create Report' }}</h2>

          <div v-if="formError" class="bg-[var(--color-error-bg)] text-[var(--color-error-text)] px-3 py-2 rounded-lg text-sm">{{ formError }}</div>

          <!-- Name -->
          <div>
            <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Name</label>
            <input v-model="form.name" type="text" placeholder="e.g. Weekly Campaign Summary"
              class="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-[#0099db]/40" />
          </div>

          <!-- Schedule -->
          <div>
            <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Schedule</label>
            <select v-model="form.schedule"
              class="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-[#0099db]/40">
              <option v-for="opt in scheduleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>

          <!-- Format -->
          <div>
            <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Format</label>
            <select v-model="form.format"
              class="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-[#0099db]/40">
              <option v-for="opt in formatOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>

          <!-- Modules -->
          <div>
            <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Report Modules</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="mod in moduleOptions" :key="mod"
                @click="toggleModule(mod)"
                :class="[
                  'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
                  form.modules.includes(mod)
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                    : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] border-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors',
                ]"
              >
                {{ mod }}
              </button>
            </div>
          </div>

          <!-- Recipients -->
          <div>
            <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Recipients (comma-separated emails)</label>
            <input v-model="form.recipients" type="text" placeholder="alice@example.com, bob@example.com"
              class="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-[#0099db]/40" />
          </div>

          <!-- Active -->
          <label class="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input v-model="form.is_active" type="checkbox" class="rounded border-[var(--color-text-muted)] text-[var(--color-primary)] focus:ring-[#0099db]/40" />
            Active
          </label>

          <!-- Actions -->
          <div class="flex justify-end gap-3 pt-2">
            <button @click="showDialog = false" :disabled="formSaving"
              class="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors">
              Cancel
            </button>
            <button @click="handleSave" :disabled="formSaving"
              class="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-50">
              {{ formSaving ? 'Saving...' : (editingId ? 'Update' : 'Create') }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <div v-if="store.loading" class="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>
    <div v-else class="space-y-6">
      <div v-if="!store.reports.length" class="text-center py-12">
        <p class="text-[var(--color-text-muted)] mb-4">No report schedules configured</p>
      </div>

      <div v-for="report in store.reports" :key="report.id" class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-[var(--color-text-primary)]">{{ report.name }}</h3>
            <p class="text-xs text-[var(--color-text-tertiary)] mt-1">
              {{ report.schedule }} &middot; {{ report.format }} &middot;
              {{ report.recipients.join(', ') }}
            </p>
            <div class="flex flex-wrap gap-1 mt-2">
              <span
                v-for="m in report.modules"
                :key="m"
                class="px-2 py-0.5 bg-blue-50 text-[#020288] text-xs rounded-full"
              >
                {{ m }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <StatusBadge :status="report.is_active ? 'active' : 'inactive'" />
            <button
              v-if="auth.canWrite"
              @click="openEdit(report)"
              class="px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              Edit
            </button>
            <button
              v-if="auth.canWrite"
              @click="handleRunNow(report.id)"
              class="px-3 py-1.5 text-xs font-medium text-[#020288] border border-[#020288]/30 rounded-lg hover:bg-blue-50"
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
        <p v-if="report.last_run_at" class="text-xs text-[var(--color-text-muted)] mt-2">
          Last run: {{ new Date(report.last_run_at).toLocaleString() }}
        </p>
      </div>
    </div>
  </div>
</template>
