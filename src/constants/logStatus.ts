// Canonical LogStatus vocabulary — must stay in sync with
// internal/model/campaign.go (LogStatus* constants) in the backend.
//
// This is the single source of truth for "what statuses can a CampaignLog
// row have". It drives:
//   - the status filter <select> in LogsPage.vue
//   - the StatusBadge.spec.ts non-vacuity test (every entry here must
//     resolve to real colours in StatusBadge, not the grey fallback)
//
// Previously the filter's <option> list and StatusBadge's statusConfig
// were two independently-maintained lists; a status could be added to one
// and silently missing from the other (see: bounced/opened/clicked/
// complaint/quiet_hour_deferred were once missing from the filter, and
// gate_unavailable was entirely missing from StatusBadge). Adding a new
// LogStatus should mean editing this file plus StatusBadge's
// statusConfig — nothing else should need to enumerate the list again.
//
// "Must stay in sync" above is enforced, not aspirational: the
// `backendVocabulary` block in src/views/__tests__/logStatusVocabulary.spec.ts
// parses the `// Log status constants.` const block out of the backend
// checkout and asserts set equality with LOG_STATUSES. It was written
// because this list had silently fallen two statuses behind (`queued`,
// written live by executor.go's logAndAdvance, and `unsubscribed`,
// written by the provider-webhook classifier in routes_webhooks.go) with
// every frontend test green.
import type { ChannelStats } from '@/api/types'

export interface LogStatusOption {
  value: string
  label: string
}

export const LOG_STATUSES: LogStatusOption[] = [
  // Published to JetStream, awaiting async-worker dispatch. The worker
  // transitions the row to sent/failed/skipped on ack, so this is the one
  // genuinely non-terminal status in the list.
  { value: 'queued', label: 'Queued' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'opened', label: 'Opened' },
  { value: 'clicked', label: 'Clicked' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'failed', label: 'Failed' },
  { value: 'complaint', label: 'Complaint' },
  // Provider-reported opt-out, distinct from `complaint` (abuse report).
  // The opt-out itself is applied separately by handleProviderUnsubscribe;
  // this status only records that the signal arrived on this log row.
  { value: 'unsubscribed', label: 'Unsubscribed' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'frequency_capped', label: 'Frequency Capped' },
  { value: 'no_consent', label: 'No Consent' },
  // NOT a synonym for no_consent, and the distinction is the whole point of
  // the status existing. `no_consent` means MA holds a consent row for this
  // client and it says no — the person was asked and declined.
  // `no_consent_record` means MA holds NO row at all: nobody ever asked.
  // Collapsing the two reads as "1,054 customers refused marketing" when the
  // truth is "we never obtained consent from them", which is a different
  // problem with a different fix (see marketing-automation-hks#57).
  //
  // Filterable separately on LogsPage for that reason. On the two dashboards
  // it is NOT broken out, because the backend does not serve it separately:
  // GetChannelStats folds it into the `no_consent` column
  // (`IN ('no_consent','no_consent_record')`, internal/store/dashboard.go:178)
  // and GetCampaignPerformance includes it in total_skipped (line 224). It is
  // therefore in SUPPRESSED_STATUSES below and deliberately absent from
  // CHANNEL_BREAKDOWN_STATUSES — adding it there would be a vue-tsc error
  // anyway, since ChannelStats has no such field.
  { value: 'no_consent_record', label: 'No Consent Record' },
  { value: 'condition_not_met', label: 'Condition Not Met' },
  { value: 'quiet_hour_deferred', label: 'Quiet Hour Deferred' },
  // The gate (frequency cap / consent / condition checks) could not be
  // evaluated at all — e.g. a Redis blip or store error — as distinct
  // from the gate running and saying no. Nothing is wrong with the
  // campaign; the check simply didn't run. See StatusBadge.vue for the
  // colour rationale.
  { value: 'gate_unavailable', label: 'Gate Unavailable' },
]

// Derived label map — the ONLY place a LogStatus value is turned into
// display text. Derived from LOG_STATUSES rather than written out a second
// time, so there is no copy that can drift.
export const LOG_STATUS_LABELS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(LOG_STATUSES.map((s) => [s.value, s.label])),
)

/**
 * Display label for a single backend LogStatus value.
 *
 * Any UI that puts a human-readable name next to one campaign_logs status
 * MUST go through here. Hand-typed labels are how "frequency_capped" ended
 * up rendered as "Frequency Capped" in the LogsPage filter and "Freq
 * Capped" on the Channels page at the same time.
 *
 * The fallback is for the OTHER vocabularies that share the same widgets —
 * enrollment/broadcast/integration lifecycle values such as `active`,
 * `draft`, `in_flight`, `up`. Those have no curated label, so they keep
 * the historical underscores-to-spaces derivation. Note that the fallback
 * is title-cased by the caller (StatusBadge applies CSS `capitalize` on
 * that path only), whereas a curated label is rendered exactly as written
 * here — which is the whole point: a label like 'Freq. Capped' or
 * 'SMS Opt-Out' must survive intact.
 *
 * Object.hasOwn guards the bracket-index lookup below: LOG_STATUS_LABELS[value]
 * on its own walks the prototype chain, so `value === 'constructor'` (or
 * 'toString', 'valueOf', ...) would resolve to the inherited
 * Object.prototype function — which is not nullish, so a bare
 * `?? value.replace(...)` never fires and this would return a function
 * where every caller expects a string. The `?? value.replace(...)` that
 * remains below the hasOwn guard is a `noUncheckedIndexedAccess` narrowing
 * formality (LOG_STATUS_LABELS[value] still types as `string | undefined`
 * post-guard), not a second behavioural path — hasOwn already establishes
 * the key is present.
 */
export function logStatusLabel(value: string): string {
  if (!Object.hasOwn(LOG_STATUS_LABELS, value)) return value.replace(/_/g, ' ')
  return LOG_STATUS_LABELS[value] ?? value.replace(/_/g, ' ')
}

/**
 * The ChannelStats fields that carry a per-status count.
 *
 * Every non-`channel` field of the DTO is one COUNT(status = X) column
 * emitted by Store.GetChannelStats, so "numeric field of ChannelStats" and
 * "status the Channels page can break out" are the same set by
 * construction.
 *
 * Optional fields are deliberately excluded (`ChannelStats[K] extends
 * number` is false for `number | undefined`): a column the backend might
 * not send cannot be rendered as a count without inventing a value for the
 * missing case, which is exactly the fabrication this type exists to stop.
 */
export type ChannelCountKey = {
  [K in keyof ChannelStats]-?: ChannelStats[K] extends number ? K : never
}[keyof ChannelStats]

/**
 * The statuses the Channels page breaks out individually, in render order.
 *
 * Mirrors the columns produced by Store.GetChannelStats in the backend
 * (internal/store/dashboard.go) — that query emits one COUNT per status
 * with no roll-up, so every entry here is a 1:1 count of a single
 * campaign_logs.status value.
 *
 * The `readonly ChannelCountKey[]` annotation is load-bearing, not
 * decoration. "Break it out on Channels" is one of the three sanctioned
 * ways to resolve the coverage test in logStatusVocabulary.spec.ts, and
 * before this type existed it was the unguarded one: adding a status here
 * that ChannelStats does not carry type-checked cleanly, passed every
 * test, and rendered a sixth row showing `0` for a field the backend never
 * sends — a fabricated statistic on an operator dashboard. Adding a status
 * to this list is now a vue-tsc error until the corresponding REQUIRED
 * field is added to ChannelStats in src/api/types.ts — "required" because
 * ChannelCountKey excludes optional numeric fields by construction
 * (`ChannelStats[K] extends number` is false for `number | undefined`), so
 * an optional field added there still will not satisfy this list and the
 * TS2322 will persist with no obvious cause. Whoever closes the
 * `gate_unavailable` gap noted in DASHBOARD_UNRENDERED_STATUSES will hit
 * this directly: the field must be `gate_unavailable: number`, not
 * `gate_unavailable?: number`.
 */
export const CHANNEL_BREAKDOWN_STATUSES: readonly ChannelCountKey[] = Object.freeze([
  'sent',
  'failed',
  'skipped',
  'frequency_capped',
  'no_consent',
  // Added when the gap described below was closed. It goes LAST deliberately:
  // the four before it are outcomes the platform decided, this one is the
  // platform admitting it could not decide, and a reader scanning the column
  // order should meet it after the real outcomes rather than among them.
  'gate_unavailable',
])

/**
 * Membership of the backend's per-campaign roll-up bucket.
 *
 * Mirrors, exactly, the IN (...) list in Store.GetCampaignPerformance's
 * `total_skipped` expression (internal/store/dashboard.go). That column is
 * a SUM over four distinct statuses — it is NOT the count of
 * campaign_logs.status = 'skipped'.
 *
 * This is why the Channels page and the campaign-performance table used to
 * contradict each other on the same rows: both printed the word "Skipped",
 * but Channels meant the single status and the performance table meant this
 * four-status union. With no_consent accounting for the overwhelming
 * majority of rows in production, the two numbers differ by orders of
 * magnitude while claiming to be the same thing.
 *
 * Deliberately excludes `gate_unavailable` (the gate could not be evaluated
 * — an absence of a decision, not a decision) and `quiet_hour_deferred`
 * (deferred, not declined), matching the backend.
 */
export const SUPPRESSED_STATUSES: readonly string[] = Object.freeze([
  'skipped',
  'condition_not_met',
  'frequency_capped',
  'no_consent',
  // Mirrors the backend's IN (...) list exactly, which is this module's
  // contract: internal/store/dashboard.go:224 counts
  // ('skipped','condition_not_met','frequency_capped','no_consent','no_consent_record')
  // into total_skipped. Omitting it here would make this list claim a
  // membership the roll-up column does not actually have.
  'no_consent_record',
])

/**
 * Label for the SUPPRESSED_STATUSES roll-up.
 *
 * Invariant enforced by logStatusVocabulary.spec.ts: this must never equal
 * the label of any single LogStatus. A roll-up named after one of its own
 * members is unreadable — the reader cannot tell which sense is meant.
 * The exact wording is the one adjustable knob here; the constraint that it
 * differ from every single-status label is not.
 */
export const SUPPRESSED_ROLLUP_LABEL = 'Suppressed'

/** Human-readable membership of the roll-up, for tooltips/help text. */
export function suppressedRollupTitle(): string {
  return `${SUPPRESSED_ROLLUP_LABEL} = ${SUPPRESSED_STATUSES.map(logStatusLabel).join(' + ')}`
}

/**
 * Statuses that neither dashboard bucket renders today.
 *
 * This list exists so that adding a LogStatus to LOG_STATUSES forces a
 * conscious decision about where it appears on the dashboards — the
 * coverage test in logStatusVocabulary.spec.ts fails until the new status
 * is either broken out, folded into the roll-up, or named here. That test
 * iterates LOG_STATUSES, so on its own it only fires when someone edits
 * this file; the backend-drift half of the guard is the
 * `backendVocabulary` block in the same spec, which reads the backend's
 * LogStatus* constants directly.
 *
 *   delivered / opened / clicked / bounced / complaint
 *     — engagement + provider feedback. The performance table derives
 *       Opened/Clicked from the delivered_at/opened_at/clicked_at
 *       timestamps, not from status, so they are not status buckets.
 *   unsubscribed — provider-reported opt-out. Neither a send outcome nor a
 *       suppression decision made by this platform: the send happened, and
 *       the recipient responded. Belongs on a consent/deliverability view,
 *       not in a send-outcome bucket. Filterable on LogsPage today.
 *   queued — not an outcome at all; the row is mid-flight and the async
 *       worker will overwrite it with sent/failed/skipped on ack. Counting
 *       it in either aggregation would double-count rows that are about to
 *       land in a real bucket, and the count would change under the reader
 *       with no event having occurred.
 *   quiet_hour_deferred — deferred, not declined; the backend excludes it
 *       from both aggregations.
 *
 * `gate_unavailable` used to be listed here as a KNOWN GAP. It is not a gap
 * any more: it is broken out on Channels and shown on the performance table,
 * so it now lives in CHANNEL_BREAKDOWN_STATUSES. Do not add it back here —
 * the two lists are unioned by the coverage test, so a status present in both
 * still "accounts", and the duplicate would read as a deliberate decision not
 * to render something that is in fact rendered.
 */
export const DASHBOARD_UNRENDERED_STATUSES: readonly string[] = Object.freeze([
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'complaint',
  'unsubscribed',
  'queued',
  'quiet_hour_deferred',
])
