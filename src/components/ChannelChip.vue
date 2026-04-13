<script setup lang="ts">
// Single source of truth for channel chip styling. Replaces the
// per-page `.tpl-chip` / `.camp-chip` / inline `bg-blue-50 text-blue-700`
// patterns that drifted in colour across CampaignsPage, TemplatesPage,
// BroadcastsPage and the campaign step flow visualiser.
//
// Channel name is normalised to lowercase + treated as the data attribute
// so unknown channels degrade gracefully to the muted style instead of
// throwing or showing the wrong colour.

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

/* Light theme — restrained editorial palette, paired with the dot for AA contrast. */
.channel-chip[data-ch="email"]    { color: #1e3a8a; background: #e8eefd; border-color: #c8d5f5; }
.channel-chip[data-ch="email"] .channel-chip-dot { background: #1e3a8a; }
.channel-chip[data-ch="sms"]      { color: #5b2d8c; background: #ede5fa; border-color: #d6c8f0; }
.channel-chip[data-ch="sms"] .channel-chip-dot { background: #5b2d8c; }
.channel-chip[data-ch="whatsapp"] { color: #0b5334; background: #e8f5ee; border-color: #b6dac5; }
.channel-chip[data-ch="whatsapp"] .channel-chip-dot { background: #0b5334; }
.channel-chip[data-ch="push"]     { color: #7a3e00; background: #fbeddb; border-color: #edd0a4; }
.channel-chip[data-ch="push"] .channel-chip-dot { background: #7a3e00; }
.channel-chip[data-ch="onsite"]   { color: #142e81; background: var(--color-info-bg); border-color: var(--color-info-border); }
.channel-chip[data-ch="onsite"] .channel-chip-dot { background: #142e81; }

/* Unknown channel fallback */
.channel-chip:not([data-ch="email"]):not([data-ch="sms"]):not([data-ch="whatsapp"]):not([data-ch="push"]):not([data-ch="onsite"]) {
  color: var(--color-text-tertiary);
  background: var(--color-bg-subtle);
  border-color: var(--color-border);
}
.channel-chip:not([data-ch="email"]):not([data-ch="sms"]):not([data-ch="whatsapp"]):not([data-ch="push"]):not([data-ch="onsite"]) .channel-chip-dot {
  background: var(--color-text-muted);
}

[data-theme="dark"] .channel-chip[data-ch="email"]    { color: #93b4ff; background: rgba(147,180,255,0.1); border-color: rgba(147,180,255,0.3); }
[data-theme="dark"] .channel-chip[data-ch="email"] .channel-chip-dot { background: #93b4ff; }
[data-theme="dark"] .channel-chip[data-ch="sms"]      { color: #c79cf5; background: rgba(199,156,245,0.1); border-color: rgba(199,156,245,0.3); }
[data-theme="dark"] .channel-chip[data-ch="sms"] .channel-chip-dot { background: #c79cf5; }
[data-theme="dark"] .channel-chip[data-ch="whatsapp"] { color: #7cd9a9; background: rgba(124,217,169,0.1); border-color: rgba(124,217,169,0.3); }
[data-theme="dark"] .channel-chip[data-ch="whatsapp"] .channel-chip-dot { background: #7cd9a9; }
[data-theme="dark"] .channel-chip[data-ch="push"]     { color: #f0b879; background: rgba(240,184,121,0.1); border-color: rgba(240,184,121,0.3); }
[data-theme="dark"] .channel-chip[data-ch="push"] .channel-chip-dot { background: #f0b879; }
[data-theme="dark"] .channel-chip[data-ch="onsite"]   { color: #93c5fd; background: rgba(96,165,250,0.1); border-color: rgba(96,165,250,0.3); }
[data-theme="dark"] .channel-chip[data-ch="onsite"] .channel-chip-dot { background: #93c5fd; }
</style>
