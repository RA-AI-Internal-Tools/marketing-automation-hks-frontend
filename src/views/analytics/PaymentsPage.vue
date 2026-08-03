<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import AnalyticsLayout from '@/components/AnalyticsLayout.vue'
import MetricCard from '@/components/MetricCard.vue'
import DonutChart from '@/components/DonutChart.vue'
import DegradedNotice from '@/components/DegradedNotice.vue'
import { useAnalyticsStore } from '@/stores/analytics'
import { fetchPayments } from '@/api/analytics'
import type { PaymentsData } from '@/api/types'

const analytics = useAnalyticsStore()
const data = ref<PaymentsData | null>(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await fetchPayments(analytics.since, analytics.until)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load payment data'
  } finally {
    loading.value = false
  }
}

// Capability, not health. `methods_supported === false` means this backend's
// database has no payment-method column to read — the CRM service owns the
// `orders` table and it carries six columns, none of them a payment method.
// That is permanent and correct, so it gets a statement of fact, NOT the
// DegradedNotice below, whose copy ("We could not reach the CRM database ...
// these figures are unavailable — they are not zero") would be a false
// sentence about a reachable database that no operator could ever clear.
//
// `undefined` reads as supported: a backend older than the deploy that added
// the field omits it, and the safe default is "nothing unusual to say".
const methodsSupported = computed(() => data.value?.methods_supported !== false)

onMounted(load)
watch(() => analytics.queryParams, load)
</script>

<template>
  <AnalyticsLayout title="Payments Intelligence" description="Payment methods, approval rates, and failure analysis">
    <div v-if="loading" class="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>
    <div v-else-if="error" class="bg-[var(--color-error-bg)] border border-[var(--color-error-border)] text-[var(--color-error-text)] px-4 py-3 rounded-lg text-sm">{{ error }}</div>
    <div v-else-if="data" class="space-y-6">
      <div class="bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] text-[var(--color-warning-text)] px-4 py-3 rounded-lg text-sm">
        Payment analytics are partially derived from staging event payloads. Methods and failure reasons may be incomplete when upstream events omit PSP-specific metadata.
      </div>
      <!--
        Scoped tightly on purpose: `methods` is the ONLY CRM-sourced field on
        this endpoint. Approval and decline rates come from Tracardi and stay
        trustworthy when the CRM is down, so the notice must not cast doubt on
        them.

        This fires on crm_degraded ONLY — a query that failed. The separate
        "this database has no payment-method column" case is a capability
        statement further down, not an outage. Against production today this
        notice never renders; that is correct, and it is what makes it
        meaningful if it ever does.
      -->
      <DegradedNotice
        v-if="data.crm_degraded"
        source="crm"
        affects="The payment method breakdown"
      />
      <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard title="Approval Rate" :value="data.approval_rate.toFixed(1) + '%'" accent="green" />
        <MetricCard title="Decline Rate" :value="data.decline_rate.toFixed(1) + '%'" accent="red" />
        <!-- A literal 0 here would read as "zero payment methods in use", which
             is a claim this database cannot make. -->
        <MetricCard
          title="Payment Methods"
          :value="methodsSupported ? data.methods.length : 'Not tracked'"
        />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
          <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Payment Method Distribution</h3>
          <DonutChart
            v-if="data.methods.length"
            :labels="data.methods.map((m) => m.method)"
            :values="data.methods.map((m) => m.count)"
          />
          <div
            v-else-if="!methodsSupported"
            data-test="methods-unsupported"
            class="text-sm text-[var(--color-text-muted)] leading-relaxed"
          >
            <p>
              <strong class="text-[var(--color-text-secondary)]">Payment methods are not tracked in this database.</strong>
              The <code class="font-mono text-xs">orders</code> table belongs to the CRM service and has no
              payment-method column, so there is nothing to break down here. Nothing is
              broken and there is no action to take — approval and decline rates above are
              unaffected.
            </p>
            <p v-if="data.methods_unavailable_reason" class="mt-2 text-xs text-[var(--color-text-tertiary)]">
              Reported by the API: {{ data.methods_unavailable_reason }}
            </p>
          </div>
          <p v-else class="text-sm text-[var(--color-text-muted)]">No payments recorded in this period</p>
        </div>
        <div class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
          <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Failure Reasons</h3>
          <table v-if="data.failure_reasons.length" class="w-full text-sm">
            <thead><tr class="text-left text-[var(--color-text-tertiary)] text-xs uppercase">
              <th class="pb-2">Reason</th><th class="pb-2 text-right">Count</th>
            </tr></thead>
            <tbody>
              <tr v-for="r in data.failure_reasons" :key="r.reason" class="border-t border-[var(--color-border-muted)]">
                <td class="py-2 text-[var(--color-text-primary)]">{{ r.reason }}</td>
                <td class="py-2 text-right text-[var(--color-error-text)]">{{ r.count.toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="text-sm text-[var(--color-text-muted)]">No failures recorded</p>
        </div>
      </div>
    </div>
  </AnalyticsLayout>
</template>
