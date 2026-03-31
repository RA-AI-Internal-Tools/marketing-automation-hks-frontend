<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchAuditLogs } from '@/api/dashboard'
import type { AuditLog } from '@/api/types'
import { ShieldCheckIcon } from '@heroicons/vue/24/outline'

const logs = ref<AuditLog[]>([])
const total = ref(0)
const page = ref(1)
const perPage = 50
const loading = ref(true)

const actionColors: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  toggle: 'bg-amber-100 text-amber-700',
}

async function load() {
  loading.value = true
  try {
    const res = await fetchAuditLogs({ page: page.value, per_page: perPage })
    logs.value = res.data
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function prevPage() {
  if (page.value > 1) { page.value--; load() }
}

function nextPage() {
  if (page.value * perPage < total.value) { page.value++; load() }
}

function formatDetail(detail?: Record<string, any>): string {
  if (!detail) return '-'
  return Object.entries(detail).map(([k, v]) => `${k}: ${v}`).join(', ')
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-3">
      <ShieldCheckIcon class="w-7 h-7 text-indigo-500" />
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p class="text-sm text-gray-500">Track all administrative actions across the platform</p>
      </div>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-400">Loading audit logs...</div>

    <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr class="text-left text-gray-500 text-xs uppercase tracking-wide">
            <th class="px-4 py-3">Time</th>
            <th class="px-4 py-3">User</th>
            <th class="px-4 py-3">Action</th>
            <th class="px-4 py-3">Resource</th>
            <th class="px-4 py-3">ID</th>
            <th class="px-4 py-3">Details</th>
            <th class="px-4 py-3">IP</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id" class="border-t border-gray-100 hover:bg-gray-50">
            <td class="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
              {{ new Date(log.created_at).toLocaleString() }}
            </td>
            <td class="px-4 py-3 text-gray-700">{{ log.user_email }}</td>
            <td class="px-4 py-3">
              <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="actionColors[log.action] || 'bg-gray-100 text-gray-700'">
                {{ log.action }}
              </span>
            </td>
            <td class="px-4 py-3 text-gray-700 font-medium">{{ log.resource }}</td>
            <td class="px-4 py-3 text-gray-500 font-mono text-xs">{{ log.resource_id ?? '-' }}</td>
            <td class="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{{ formatDetail(log.detail) }}</td>
            <td class="px-4 py-3 text-gray-400 font-mono text-xs">{{ log.ip_address || '-' }}</td>
          </tr>
          <tr v-if="logs.length === 0">
            <td colspan="7" class="px-4 py-8 text-center text-gray-400">No audit logs found</td>
          </tr>
        </tbody>
      </table>

      <div class="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
        <span class="text-xs text-gray-500">{{ total }} total entries</span>
        <div class="flex gap-2">
          <button @click="prevPage" :disabled="page <= 1"
                  class="px-3 py-1 text-xs rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50">
            Previous
          </button>
          <span class="px-3 py-1 text-xs text-gray-600">Page {{ page }}</span>
          <button @click="nextPage" :disabled="page * perPage >= total"
                  class="px-3 py-1 text-xs rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50">
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
