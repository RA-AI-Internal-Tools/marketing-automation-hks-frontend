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
export interface LogStatusOption {
  value: string
  label: string
}

export const LOG_STATUSES: LogStatusOption[] = [
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'opened', label: 'Opened' },
  { value: 'clicked', label: 'Clicked' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'failed', label: 'Failed' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'frequency_capped', label: 'Frequency Capped' },
  { value: 'no_consent', label: 'No Consent' },
  { value: 'condition_not_met', label: 'Condition Not Met' },
  { value: 'quiet_hour_deferred', label: 'Quiet Hour Deferred' },
  // The gate (frequency cap / consent / condition checks) could not be
  // evaluated at all — e.g. a Redis blip or store error — as distinct
  // from the gate running and saying no. Nothing is wrong with the
  // campaign; the check simply didn't run. See StatusBadge.vue for the
  // colour rationale.
  { value: 'gate_unavailable', label: 'Gate Unavailable' },
]
