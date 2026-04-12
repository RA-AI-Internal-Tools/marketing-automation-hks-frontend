<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    router.push('/overview')
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Login failed'
  } finally {
    loading.value = false
  }
}

const buildId = 'MA · build ' + (new Date().getFullYear())
</script>

<template>
  <div class="login-root">
    <!-- LEFT: editorial brand panel -->
    <aside class="login-brand">
      <!-- Masthead -->
      <div class="brand-top">
        <div class="rule-dot">AR-PAY · Growth engine</div>
      </div>

      <!-- Hero display type -->
      <div class="brand-hero">
        <h1 class="brand-title">
          Marketing
          <span class="brand-title-italic">Automation</span>
        </h1>
        <p class="brand-kicker">
          Campaigns, segments and localized messaging — for teams
          that treat sending well as a discipline.
        </p>
      </div>

      <!-- Metric grid — typographic accents -->
      <div class="brand-grid">
        <div class="brand-grid-cell">
          <div class="brand-grid-num">08</div>
          <div class="brand-grid-lbl">Supported<br />languages</div>
        </div>
        <div class="brand-grid-cell">
          <div class="brand-grid-num">05</div>
          <div class="brand-grid-lbl">Delivery<br />channels</div>
        </div>
        <div class="brand-grid-cell">
          <div class="brand-grid-num">∞</div>
          <div class="brand-grid-lbl">Per-recipient<br />variants</div>
        </div>
      </div>

      <!-- Foot -->
      <div class="brand-foot">
        <span class="rule-dot" style="color: rgba(255,255,255,0.45);">{{ buildId }}</span>
      </div>

      <!-- Decorative concentric circle — subtle, never obtrusive -->
      <svg class="brand-ornament" viewBox="0 0 600 600" aria-hidden="true">
        <g fill="none" stroke="rgba(80, 200, 237, 0.12)" stroke-width="1">
          <circle cx="300" cy="300" r="80" />
          <circle cx="300" cy="300" r="150" />
          <circle cx="300" cy="300" r="220" />
          <circle cx="300" cy="300" r="290" />
        </g>
        <circle cx="300" cy="300" r="4" fill="#50C8ED" />
      </svg>
    </aside>

    <!-- RIGHT: form panel -->
    <section class="login-form-panel">
      <div class="login-form-wrap">
        <div class="rule-dot" style="margin-bottom: 36px;">Sign in</div>

        <h2 class="login-form-title">
          <span>Welcome</span>
          <span class="accent-serif">back.</span>
        </h2>
        <p class="login-form-sub">
          Use your AR-PAY credentials to continue.
        </p>

        <form @submit.prevent="handleSubmit" class="login-form">
          <div class="field">
            <label for="email" class="field-label">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              class="field-input"
              placeholder="you@ar-pay.com"
            />
          </div>

          <div class="field">
            <label for="password" class="field-label">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
              class="field-input"
              placeholder="••••••••"
            />
          </div>

          <div v-if="error" class="login-error" role="alert">
            <span class="login-error-dot" />
            {{ error }}
          </div>

          <button
            type="submit"
            :disabled="loading || !email || !password"
            class="login-submit"
          >
            <span>{{ loading ? 'Signing in' : 'Sign in' }}</span>
            <svg v-if="!loading" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span v-else class="spinner" aria-hidden="true" />
          </button>
        </form>

        <p class="login-legal">
          Protected by session-bound tokens. Access is audited.
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ─────────── Layout ─────────── */
.login-root {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr;
  background: var(--color-bg-page);
  position: relative;
  overflow: hidden;
}
@media (min-width: 960px) {
  .login-root { grid-template-columns: 1.1fr 1fr; }
}

/* ─────────── Left brand panel ─────────── */
.login-brand {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 56px 64px;
  background:
    radial-gradient(ellipse at 10% 0%, rgba(13, 53, 215, 0.35), transparent 55%),
    radial-gradient(ellipse at 95% 100%, rgba(0, 153, 219, 0.25), transparent 55%),
    linear-gradient(180deg, #020288 0%, #05073f 60%, #0a0d18 100%);
  color: #fff;
  overflow: hidden;
}
@media (max-width: 959px) { .login-brand { padding: 40px 28px; } }

.brand-top { z-index: 2; }
.brand-top .rule-dot { color: rgba(255, 255, 255, 0.72); }

.brand-hero { margin-top: auto; z-index: 2; }
.brand-title {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: clamp(48px, 6.8vw, 92px);
  line-height: 0.95;
  letter-spacing: -0.035em;
  color: #fff;
  font-feature-settings: 'ss01' 1, 'ss02' 1;
}
.brand-title-italic {
  display: block;
  font-style: italic;
  font-variation-settings: 'opsz' 144, 'SOFT' 60, 'WONK' 1;
  color: var(--hks-cyan-light);
  font-weight: 300;
}
.brand-kicker {
  margin-top: 28px;
  max-width: 440px;
  font-family: var(--font-sans);
  font-weight: 300;
  font-size: 16px;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.7);
}

/* Metric grid */
.brand-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
  margin-top: 56px;
  padding-top: 32px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 2;
}
.brand-grid-num {
  font-family: var(--font-display);
  font-weight: 300;
  font-size: 44px;
  line-height: 1;
  letter-spacing: -0.02em;
  color: #fff;
  font-variant-numeric: tabular-nums lining-nums;
}
.brand-grid-lbl {
  margin-top: 10px;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.4;
}

.brand-foot {
  margin-top: 48px;
  z-index: 2;
}

/* Ornament */
.brand-ornament {
  position: absolute;
  right: -120px;
  top: 50%;
  transform: translateY(-50%);
  width: 640px;
  height: 640px;
  opacity: 0.65;
  pointer-events: none;
  z-index: 1;
  animation: drift 40s linear infinite;
}
@keyframes drift {
  from { transform: translateY(-50%) rotate(0deg); }
  to   { transform: translateY(-50%) rotate(360deg); }
}

/* ─────────── Right form panel ─────────── */
.login-form-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 56px 32px;
  background: var(--color-bg-page);
  position: relative;
}
.login-form-wrap {
  width: 100%;
  max-width: 380px;
}

.login-form-title {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 44px;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}
.login-form-title .accent-serif {
  font-style: italic;
  font-variation-settings: 'opsz' 144, 'SOFT' 50;
  color: var(--hks-deep-blue);
  margin-left: 8px;
}
.login-form-sub {
  font-size: 14px;
  color: var(--color-text-tertiary);
  margin-bottom: 36px;
}

.login-form { display: flex; flex-direction: column; gap: 18px; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field-label {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
}
.field-input {
  font-family: var(--font-sans);
  font-size: 14px;
  padding: 11px 13px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  transition: border-color var(--transition-fast), background var(--transition-fast);
}
.field-input::placeholder { color: var(--color-text-muted); }
.field-input:hover { border-color: var(--color-border-strong); }
.field-input:focus {
  outline: none;
  border-color: var(--hks-deep-blue);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(2, 2, 136, 0.08);
}

.login-error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--color-error-bg);
  border: 1px solid var(--color-error-border);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--color-error-text);
  font-weight: 500;
}
.login-error-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--color-error);
  flex-shrink: 0;
}

.login-submit {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 13px 16px;
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: #fff;
  background: var(--hks-deep-blue);
  border: 1px solid var(--hks-deep-blue);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast), transform var(--transition-fast);
}
.login-submit:hover:not(:disabled) { background: var(--hks-royal-blue); border-color: var(--hks-royal-blue); }
.login-submit:active:not(:disabled) { transform: translateY(0.5px); }
.login-submit:disabled { opacity: 0.45; cursor: not-allowed; }
.login-submit svg { width: 14px; height: 14px; }

.spinner {
  width: 14px; height: 14px;
  border: 1.5px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.login-legal {
  margin-top: 32px;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

/* Dark mode refinements */
[data-theme="dark"] .login-form-panel { background: var(--color-bg-page); }
[data-theme="dark"] .field-input:focus {
  background: var(--color-bg-card);
  box-shadow: 0 0 0 3px rgba(143, 170, 255, 0.18);
  border-color: var(--color-primary);
}
[data-theme="dark"] .login-form-title .accent-serif { color: var(--hks-cyan); }
[data-theme="dark"] .login-submit {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #0a0d18;
}
[data-theme="dark"] .login-submit:hover:not(:disabled) {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}
</style>
