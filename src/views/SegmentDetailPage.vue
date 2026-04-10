<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { ArrowLeftIcon, UsersIcon } from '@heroicons/vue/24/outline'
import { fetchSegment, fetchSegmentMembers } from '@/api/dashboard'
import type { Segment, SegmentMember } from '@/api/types'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const segment = ref<Segment | null>(null)
const members = ref<SegmentMember[]>([])
const slug = route.params.slug as string

function formatOperator(op: string): string {
  const map: Record<string, string> = { gt: '>', gte: '>=', lt: '<', lte: '<=', eq: '=', between: 'between' }
  return map[op] || op
}

function formatThreshold(seg: Segment): string {
  if (seg.operator === 'between') {
    return `${seg.threshold_min} - ${seg.threshold_max ?? '?'}`
  }
  return `${formatOperator(seg.operator)} ${seg.threshold_min}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

onMounted(async () => {
  try {
    const [seg, mem] = await Promise.all([
      fetchSegment(slug),
      fetchSegmentMembers(slug),
    ])
    segment.value = seg
    members.value = mem
  } catch (e: any) {
    console.error('Failed to load segment detail', e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page-enter">
    <!-- Back nav -->
    <button
      @click="router.push('/segments')"
      class="flex items-center gap-1.5 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors mb-4"
    >
      <ArrowLeftIcon class="h-4 w-4" />
      Back to Segments
    </button>

    <!-- Skeleton loading -->
    <div v-if="loading" class="space-y-6">
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
        <div class="space-y-3">
          <div class="skeleton h-6 w-64"></div>
          <div class="skeleton h-4 w-96"></div>
          <div class="skeleton h-4 w-48"></div>
        </div>
      </div>
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
        <div class="skeleton h-5 w-32 mb-4"></div>
        <div v-for="i in 3" :key="i" class="skeleton h-10 w-full mb-2"></div>
      </div>
    </div>

    <template v-else-if="segment">
      <PageHeader :title="segment.name" :description="segment.description || undefined" />

      <!-- Stat card + definition -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <!-- Member count stat -->
        <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-5 flex items-center gap-4">
          <div class="p-3 rounded-lg bg-[var(--color-info-bg)]">
            <UsersIcon class="h-6 w-6 text-[var(--color-info-text)]" />
          </div>
          <div>
            <p class="text-2xl font-bold text-[var(--color-text-primary)]">{{ (segment.member_count ?? 0).toLocaleString() }}</p>
            <p class="text-xs text-[var(--color-text-tertiary)]">Total Members</p>
          </div>
        </div>

        <!-- Rule definition -->
        <div class="md:col-span-2 bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-5">
          <h3 class="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">Segment Rule</h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p class="text-[var(--color-text-muted)] text-xs">Rule Type</p>
              <p class="text-[var(--color-text-primary)] font-medium">{{ segment.rule_type.replace(/_/g, ' ') }}</p>
            </div>
            <div>
              <p class="text-[var(--color-text-muted)] text-xs">Thresholds</p>
              <p class="text-[var(--color-text-primary)] font-mono font-medium">{{ formatThreshold(segment) }}</p>
            </div>
            <div>
              <p class="text-[var(--color-text-muted)] text-xs">Status</p>
              <StatusBadge :status="segment.is_active ? 'active' : 'inactive'" />
            </div>
            <div>
              <p class="text-[var(--color-text-muted)] text-xs">Tracardi Sync</p>
              <StatusBadge v-if="segment.sync_to_tracardi" status="connected" />
              <span v-else class="text-[var(--color-text-muted)]">--</span>
            </div>
          </div>
          <div v-if="segment.entry_events.length" class="mt-3">
            <p class="text-[var(--color-text-muted)] text-xs mb-1">Entry Events</p>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="evt in segment.entry_events"
                :key="evt"
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-info-bg)] text-[var(--color-info-text)]"
              >
                {{ evt }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Members table -->
      <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-[var(--color-border)]">
          <h3 class="text-sm font-semibold text-[var(--color-text-primary)]">Members</h3>
        </div>
        <div v-if="members.length === 0" class="text-center py-12">
          <p class="text-sm text-[var(--color-text-muted)]">No members in this segment yet.</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
                <th class="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Client ID</th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Entry Event</th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Entry At</th>
                <th class="text-center px-4 py-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="member in members"
                :key="member.id"
                class="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-subtle)]/50 transition-colors"
              >
                <td class="px-4 py-3 font-mono text-[var(--color-text-primary)]">{{ member.client_id }}</td>
                <td class="px-4 py-3">
                  <code class="bg-[var(--color-bg-subtle)] px-1.5 py-0.5 rounded text-xs font-mono text-[var(--color-text-tertiary)]">{{ member.entry_event }}</code>
                </td>
                <td class="px-4 py-3 text-[var(--color-text-secondary)]">{{ formatDate(member.entry_at) }}</td>
                <td class="px-4 py-3 text-center">
                  <StatusBadge :status="member.status" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <div v-else class="text-center py-16">
      <p class="text-[var(--color-text-tertiary)] font-medium">Segment not found</p>
    </div>
  </div>
</template>
