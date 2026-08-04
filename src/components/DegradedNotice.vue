<script setup lang="ts">
// Source-scoped "these numbers are unavailable, not zero" notice.
//
// The analytics endpoints are fail-soft: a failed upstream query zeroes its
// own field and the response is still served 200. That is the right call for
// availability, but it makes a zero ambiguous — "no revenue this week" and
// "the CRM is unreachable" render as the same confident $0. The backend now
// disambiguates via `crm_degraded` / `tracardi_degraded`; this is what turns
// that flag into something an operator can actually see.
//
// Deliberately NOT a page-level "everything is broken" banner. These
// responses routinely degrade by halves — Tracardi traffic numbers fine, CRM
// revenue stale — so a page-level banner would overstate the failure and
// discredit figures that are perfectly good. Mount one of these directly
// above the widget group the named source actually feeds, and say which
// figures it covers.
//
// Usage:
//   <DegradedNotice
//     v-if="data.crm_degraded"
//     source="crm"
//     affects="Revenue, orders and conversion rate"
//   />

import { computed } from 'vue'
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
  /** Which upstream could not be reached. */
  source: 'crm' | 'tracardi'
  /**
   * The figures on THIS page fed by `source`, phrased as a sentence subject —
   * e.g. "Revenue, AOV and order counts". Scoping the claim is the point of
   * the component; a vague "some data" is no better than the silent zero.
   */
  affects: string
}>()

const sourceLabel = computed(() =>
  props.source === 'crm' ? 'the CRM database' : 'the Tracardi event store',
)
</script>

<template>
  <div class="degraded-notice" role="status">
    <ExclamationTriangleIcon class="degraded-notice-icon" aria-hidden="true" />
    <p class="degraded-notice-message">
      <strong>{{ affects }} could not be loaded.</strong>
      We could not reach {{ sourceLabel }}, so these figures are unavailable —
      they are not zero. Everything else on this page is unaffected.
    </p>
  </div>
</template>

<style scoped>
.degraded-notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  border-radius: var(--radius-lg);
  color: var(--color-warning-text);
}
.degraded-notice-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-top: 1px;
  opacity: 0.9;
}
.degraded-notice-message {
  font-size: 13px;
  line-height: 1.5;
}
</style>
