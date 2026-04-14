<script setup lang="ts">
// Single source of truth for channel chip styling. Replaces the
// per-page `.tpl-chip` / `.camp-chip` / inline `bg-blue-50 text-blue-700`
// patterns that drifted in colour across CampaignsPage, TemplatesPage,
// BroadcastsPage and the campaign step flow visualiser.
//
// Channel name is normalised to lowercase + treated as the data attribute
// so unknown channels degrade gracefully to the muted style instead of
// throwing or showing the wrong colour. Channel hues live on
// `--channel-*` CSS custom properties (see src/assets/design-system.css)
// so light/dark theming is one flip, not a per-component edit.

defineProps<{
  channel: string
  /** Override label text — defaults to capitalised channel name. */
  label?: string
}>()
</script>

<template>
  <span class="channel-chip" :data-ch="channel.toLowerCase()">
    <span class="channel-chip-dot" />
    {{ label ?? channel }}
  </span>
</template>

<style scoped>
.channel-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 9px 2px 8px;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: capitalize;
  border-radius: var(--radius-full);
  border: 1px solid;
  white-space: nowrap;
}
.channel-chip-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.channel-chip[data-ch="email"]    { color: var(--channel-email);    background: var(--channel-email-soft);    border-color: var(--channel-email-border); }
.channel-chip[data-ch="email"]    .channel-chip-dot { background: var(--channel-email); }
.channel-chip[data-ch="sms"]      { color: var(--channel-sms);      background: var(--channel-sms-soft);      border-color: var(--channel-sms-border); }
.channel-chip[data-ch="sms"]      .channel-chip-dot { background: var(--channel-sms); }
.channel-chip[data-ch="whatsapp"] { color: var(--channel-whatsapp); background: var(--channel-whatsapp-soft); border-color: var(--channel-whatsapp-border); }
.channel-chip[data-ch="whatsapp"] .channel-chip-dot { background: var(--channel-whatsapp); }
.channel-chip[data-ch="push"]     { color: var(--channel-push);     background: var(--channel-push-soft);     border-color: var(--channel-push-border); }
.channel-chip[data-ch="push"]     .channel-chip-dot { background: var(--channel-push); }
.channel-chip[data-ch="onsite"]   { color: var(--channel-onsite);   background: var(--channel-onsite-soft);   border-color: var(--channel-onsite-border); }
.channel-chip[data-ch="onsite"]   .channel-chip-dot { background: var(--channel-onsite); }

/* Unknown channel fallback */
.channel-chip:not([data-ch="email"]):not([data-ch="sms"]):not([data-ch="whatsapp"]):not([data-ch="push"]):not([data-ch="onsite"]) {
  color: var(--color-text-tertiary);
  background: var(--color-bg-subtle);
  border-color: var(--color-border);
}
.channel-chip:not([data-ch="email"]):not([data-ch="sms"]):not([data-ch="whatsapp"]):not([data-ch="push"]):not([data-ch="onsite"]) .channel-chip-dot {
  background: var(--color-text-muted);
}
</style>
