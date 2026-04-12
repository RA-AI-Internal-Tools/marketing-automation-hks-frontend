<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ChartBarIcon, RocketLaunchIcon, DocumentDuplicateIcon, UsersIcon,
  AdjustmentsHorizontalIcon, ShieldCheckIcon, BellAlertIcon,
  PresentationChartBarIcon, GlobeAltIcon, FunnelIcon, UserGroupIcon,
  CubeIcon, CreditCardIcon, ShoppingCartIcon, ArrowPathIcon,
  ServerStackIcon, LinkIcon, ExclamationTriangleIcon, MapIcon,
  DocumentChartBarIcon, Cog6ToothIcon, MegaphoneIcon, HeartIcon,
  DocumentTextIcon, UserPlusIcon, MagnifyingGlassIcon,
  PaintBrushIcon, CommandLineIcon,
} from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/composables/useTheme'

const router = useRouter()
const auth = useAuthStore()
const { setTheme } = useTheme()

const open = ref(false)
const query = ref('')
const activeIdx = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

type Cmd = {
  id: string
  title: string
  section: 'Navigate' | 'Create' | 'Settings'
  hint?: string
  icon: any
  adminOnly?: boolean
  run: () => void
}

const commands = computed<Cmd[]>(() => {
  const cmds: Cmd[] = [
    // Navigate
    { id: 'nav.overview',   title: 'Overview',      section: 'Navigate', icon: ChartBarIcon,                  run: () => router.push('/overview') },
    { id: 'nav.campaigns',  title: 'Campaigns',     section: 'Navigate', icon: RocketLaunchIcon,              run: () => router.push('/campaigns') },
    { id: 'nav.templates',  title: 'Templates',     section: 'Navigate', icon: DocumentDuplicateIcon,         run: () => router.push('/templates') },
    { id: 'nav.enroll',     title: 'Enrollments',   section: 'Navigate', icon: UsersIcon,                     run: () => router.push('/enrollments') },
    { id: 'nav.segments',   title: 'Segments',      section: 'Navigate', icon: AdjustmentsHorizontalIcon,     run: () => router.push('/segments') },
    { id: 'nav.consents',   title: 'Consents',      section: 'Navigate', icon: ShieldCheckIcon,               run: () => router.push('/consents') },
    { id: 'nav.push',       title: 'Push audience', section: 'Navigate', icon: BellAlertIcon,                 run: () => router.push('/push-audience') },
    { id: 'nav.exec',       title: 'Executive analytics', section: 'Navigate', icon: PresentationChartBarIcon, run: () => router.push('/analytics/executive') },
    { id: 'nav.acq',        title: 'Acquisition',   section: 'Navigate', icon: GlobeAltIcon,                  run: () => router.push('/analytics/acquisition') },
    { id: 'nav.funnel',     title: 'Funnel',        section: 'Navigate', icon: FunnelIcon,                    run: () => router.push('/analytics/funnel') },
    { id: 'nav.users',      title: 'User analytics',section: 'Navigate', icon: UserGroupIcon,                 run: () => router.push('/analytics/users') },
    { id: 'nav.products',   title: 'Products',      section: 'Navigate', icon: CubeIcon,                      run: () => router.push('/analytics/products') },
    { id: 'nav.payments',   title: 'Payments',      section: 'Navigate', icon: CreditCardIcon,                run: () => router.push('/analytics/payments') },
    { id: 'nav.orders',     title: 'Orders',        section: 'Navigate', icon: ShoppingCartIcon,              run: () => router.push('/analytics/orders') },
    { id: 'nav.retention',  title: 'Retention',     section: 'Navigate', icon: ArrowPathIcon,                 run: () => router.push('/analytics/retention') },
    { id: 'nav.health',     title: 'Data health',   section: 'Navigate', icon: ServerStackIcon,               run: () => router.push('/analytics/data-health') },
    { id: 'nav.attr',       title: 'Attribution',   section: 'Navigate', icon: LinkIcon,                      run: () => router.push('/analytics/attribution') },
    { id: 'nav.churn',      title: 'Churn risk',    section: 'Navigate', icon: ExclamationTriangleIcon,       run: () => router.push('/analytics/churn') },
    { id: 'nav.cohorts',    title: 'Cohorts & LTV', section: 'Navigate', icon: UserGroupIcon,                 run: () => router.push('/analytics/cohort') },
    { id: 'nav.journey',    title: 'Journey',       section: 'Navigate', icon: MapIcon,                       run: () => router.push('/analytics/journey') },
    { id: 'nav.reports',    title: 'Scheduled reports', section: 'Navigate', icon: DocumentChartBarIcon,      run: () => router.push('/analytics/reports') },
    { id: 'nav.cfunnel',    title: 'Campaign funnel', section: 'Navigate', icon: FunnelIcon,                  run: () => router.push('/campaign-funnel') },
    { id: 'nav.settings',   title: 'Settings',      section: 'Navigate', icon: Cog6ToothIcon,                 run: () => router.push('/settings') },
    { id: 'nav.integrations', title: 'Integrations', section: 'Navigate', icon: LinkIcon,                    run: () => router.push('/integrations') },
    { id: 'nav.channels',   title: 'Channels',      section: 'Navigate', icon: MegaphoneIcon,                 run: () => router.push('/channels') },
    { id: 'nav.sysHealth',  title: 'System health', section: 'Navigate', icon: HeartIcon,                     run: () => router.push('/health') },
    { id: 'nav.logs',       title: 'Logs',          section: 'Navigate', icon: DocumentTextIcon,              run: () => router.push('/logs') },
    { id: 'nav.audit',      title: 'Audit logs',    section: 'Navigate', icon: ShieldCheckIcon, adminOnly: true, run: () => router.push('/audit-logs') },
    { id: 'nav.users2',     title: 'Users',         section: 'Navigate', icon: UserPlusIcon,    adminOnly: true, run: () => router.push('/users') },

    // Create
    { id: 'new.campaign',   title: 'New campaign',  section: 'Create',   icon: RocketLaunchIcon,              run: () => router.push('/campaigns/new') },
    { id: 'new.template',   title: 'New template',  section: 'Create',   icon: DocumentDuplicateIcon,         run: () => router.push('/templates/new') },

    // Settings
    { id: 'theme.light',    title: 'Switch to light theme', section: 'Settings', icon: PaintBrushIcon,        run: () => setTheme('light') },
    { id: 'theme.dark',     title: 'Switch to dark theme',  section: 'Settings', icon: PaintBrushIcon,        run: () => setTheme('dark') },
  ]
  return cmds.filter(c => !c.adminOnly || auth.isAdmin)
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return commands.value
  // Fuzzy-ish: every character of the query must appear in order
  return commands.value.filter(c => {
    const hay = `${c.title} ${c.section}`.toLowerCase()
    let idx = 0
    for (const ch of q) {
      idx = hay.indexOf(ch, idx)
      if (idx === -1) return false
      idx++
    }
    return true
  })
})

// Group the filtered list by section for display
const groups = computed(() => {
  const out: Record<string, Cmd[]> = {}
  for (const c of filtered.value) {
    ;(out[c.section] ||= []).push(c)
  }
  return out
})

function onKey(e: KeyboardEvent) {
  const mod = e.metaKey || e.ctrlKey
  if (mod && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    open.value = !open.value
    return
  }
  if (!open.value) return
  if (e.key === 'Escape') { open.value = false; return }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIdx.value = Math.min(activeIdx.value + 1, filtered.value.length - 1)
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIdx.value = Math.max(activeIdx.value - 1, 0)
  }
  if (e.key === 'Enter') {
    const cmd = filtered.value[activeIdx.value]
    if (cmd) run(cmd)
  }
}

function run(cmd: Cmd) {
  cmd.run()
  open.value = false
}

watch(open, async (v) => {
  if (v) {
    query.value = ''
    activeIdx.value = 0
    await nextTick()
    inputRef.value?.focus()
  }
})

watch(query, () => { activeIdx.value = 0 })

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// Compute a flat index so arrow-key position matches the flat filtered list.
function isActive(cmd: Cmd) { return filtered.value[activeIdx.value]?.id === cmd.id }

const macMeta = computed(() =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform),
)
</script>

<template>
  <Teleport to="body">
    <Transition name="cmdk">
      <div
        v-if="open"
        class="cmdk-backdrop"
        @click.self="open = false"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cmdk-label"
      >
        <div class="cmdk">
          <div class="cmdk-input-wrap">
            <MagnifyingGlassIcon class="cmdk-input-icon" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="cmdk-input"
              placeholder="Search commands, pages, actions…"
              autocomplete="off"
              spellcheck="false"
              aria-label="Command palette search"
            />
            <kbd class="cmdk-kbd">esc</kbd>
          </div>

          <div class="cmdk-body" role="listbox" id="cmdk-label">
            <template v-for="(items, sectionName) in groups" :key="sectionName">
              <div class="cmdk-section-label">{{ sectionName }}</div>
              <button
                v-for="cmd in items"
                :key="cmd.id"
                type="button"
                class="cmdk-item"
                :class="{ 'is-active': isActive(cmd) }"
                @click="run(cmd)"
                @mouseenter="activeIdx = filtered.indexOf(cmd)"
                role="option"
                :aria-selected="isActive(cmd)"
              >
                <component :is="cmd.icon" class="cmdk-item-icon" />
                <span class="cmdk-item-title">{{ cmd.title }}</span>
                <span v-if="cmd.hint" class="cmdk-item-hint">{{ cmd.hint }}</span>
              </button>
            </template>
            <div v-if="filtered.length === 0" class="cmdk-empty">
              <CommandLineIcon class="cmdk-empty-icon" />
              <p>No matches for <strong>&ldquo;{{ query }}&rdquo;</strong></p>
              <p class="cmdk-empty-sub">Try a page name, "new" for create actions, or "theme".</p>
            </div>
          </div>

          <div class="cmdk-footer">
            <span class="cmdk-foot-group">
              <kbd class="cmdk-kbd">↑</kbd><kbd class="cmdk-kbd">↓</kbd>
              <span>navigate</span>
            </span>
            <span class="cmdk-foot-group">
              <kbd class="cmdk-kbd">↵</kbd>
              <span>select</span>
            </span>
            <span class="cmdk-foot-group cmdk-foot-right">
              <kbd class="cmdk-kbd">{{ macMeta ? '⌘' : 'Ctrl' }}</kbd>
              <kbd class="cmdk-kbd">K</kbd>
              <span>to toggle</span>
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cmdk-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 12vh 20px 20px;
}

.cmdk {
  width: 100%;
  max-width: 620px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: 0 40px 80px -12px rgba(15, 23, 42, 0.35);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 76vh;
}

/* ─── Input row ─── */
.cmdk-input-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
}
.cmdk-input-icon {
  width: 16px;
  height: 16px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}
.cmdk-input {
  flex: 1;
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--color-text-primary);
  background: transparent;
  border: none;
  outline: none;
  padding: 0;
}
.cmdk-input::placeholder { color: var(--color-text-muted); }

.cmdk-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 500;
  color: var(--color-text-tertiary);
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  box-shadow: inset 0 -1px 0 var(--color-border);
  line-height: 1;
}

/* ─── Body / list ─── */
.cmdk-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}
.cmdk-section-label {
  padding: 10px 16px 4px;
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
}
.cmdk-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 16px;
  font-family: var(--font-sans);
  font-size: 13.5px;
  font-weight: 450;
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.cmdk-item:hover, .cmdk-item.is-active {
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
}
.cmdk-item.is-active {
  box-shadow: inset 3px 0 0 var(--hks-cyan);
}
.cmdk-item-icon {
  width: 16px;
  height: 16px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}
.cmdk-item.is-active .cmdk-item-icon {
  color: var(--hks-cyan);
}
.cmdk-item-title { flex: 1; }
.cmdk-item-hint {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-muted);
}

.cmdk-empty {
  padding: 32px 24px;
  text-align: center;
  color: var(--color-text-muted);
}
.cmdk-empty-icon {
  width: 24px;
  height: 24px;
  color: var(--color-text-muted);
  margin: 0 auto 10px;
}
.cmdk-empty strong { color: var(--color-text-secondary); font-weight: 500; }
.cmdk-empty-sub { margin-top: 6px; font-size: 12px; }

/* ─── Footer ─── */
.cmdk-footer {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 8px 16px;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-subtle);
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.cmdk-foot-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.cmdk-foot-right { margin-left: auto; }

/* Transition */
.cmdk-enter-active, .cmdk-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.cmdk-enter-active .cmdk, .cmdk-leave-active .cmdk { transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1); }
.cmdk-enter-from, .cmdk-leave-to { opacity: 0; }
.cmdk-enter-from .cmdk, .cmdk-leave-to .cmdk { transform: translateY(-8px) scale(0.98); }
</style>
