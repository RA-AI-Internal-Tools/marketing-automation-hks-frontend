<script setup lang="ts">
import { onMounted } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useReportsStore } from '@/stores/reports'
import { useAuthStore } from '@/stores/auth'
import { runReport } from '@/api/reports'

const store = useReportsStore()
const auth = useAuthStore()

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
    <PageHeader title="Automated Reports" description="Configure scheduled report generation and delivery" />

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
