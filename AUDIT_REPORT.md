# Marketing Automation HKS — Deep Audit Report

**Date:** 2026-04-02  
**Scope:** `marketing-automation-hks` (backend) and `marketing-automation-hks-frontend` (frontend)  
**Auditor:** AI Architecture Review

---

## SECTION 1 — REPO OVERVIEW

### 1.1 Backend: `marketing-automation-hks`

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Multi-channel marketing automation engine for the DueGate e-commerce platform. Orchestrates drip campaigns across email, SMS, WhatsApp, and push notifications with event-driven triggers, audience segmentation, consent management, and frequency capping. |
| **Language** | Go 1.23 |
| **Framework** | Gin (HTTP), GORM (ORM), go-quartz (scheduler) |
| **Databases** | PostgreSQL 16 (primary), Redis 7 (caching / freq caps) |
| **Message bus** | NATS 2.10 (async event processing) |
| **Third-party APIs** | Elastic Email (email), Plivo (SMS), Meta Cloud API (WhatsApp), Firebase Cloud Messaging (push), Tracardi CDP (analytics) |
| **Architecture** | Single-binary monolith with embedded scheduler, event-driven via NATS. Not microservices — all logic lives in one process. |
| **Lines of code** | ~5,800 lines of Go across 68 source files |
| **Test files** | 11 test files |

**Directory structure:**

```
marketing-automation-hks/
├── cmd/server/main.go              # Entry point — wires all dependencies
├── internal/
│   ├── api/                        # HTTP handlers & routing (13 files, ~2,200 lines)
│   │   ├── router.go               # All route definitions + auth, health, login
│   │   ├── campaigns.go            # Campaign CRUD
│   │   ├── templates.go            # Template CRUD
│   │   ├── analytics.go            # 9 analytics endpoints (Tracardi + CRM)
│   │   ├── dashboard.go            # Overview stats
│   │   ├── webhooks.go             # Elastic Email, Plivo, WhatsApp webhooks
│   │   ├── sse.go                  # Server-Sent Events for real-time UI
│   │   ├── unsubscribe.go          # One-click unsubscribe with HMAC tokens
│   │   ├── test_send.go            # Test message dispatch
│   │   ├── funnel.go               # Campaign funnel & A/B variant stats
│   │   ├── export.go               # CSV export for logs & enrollments
│   │   ├── audit.go                # Audit log recording & listing
│   │   ├── reports.go              # Scheduled report CRUD
│   │   ├── settings.go             # User settings & password change
│   │   └── users.go                # User management (admin only)
│   ├── auth/                       # JWT generation, validation, bcrypt
│   ├── channel/                    # Email, SMS, WhatsApp, Push senders + circuit breaker
│   ├── condition/                  # Step conditions (always_true, no_purchase, kyc, etc.)
│   ├── config/                     # Environment-based config (~40 env vars)
│   ├── consent/                    # Opt-in/opt-out service
│   ├── engine/                     # Trigger → Executor → Scheduler pipeline
│   ├── frequency/                  # Redis ZSET sliding-window frequency caps
│   ├── middleware/                  # JWT auth, RBAC, CORS, rate limiter, correlation ID
│   ├── model/                      # GORM models (8 tables auto-migrated)
│   ├── nats/                       # Publisher + subscriber for campaign events
│   ├── reporting/                  # Report generation, rendering, email delivery
│   ├── seed/                       # 6 pre-built campaign definitions
│   ├── segment/                    # Segment resolver (VIP, at_risk, dormant, new)
│   ├── store/                      # PostgreSQL + Redis data access layer
│   └── tracardi/                   # Tracardi CDP client, cache, aggregations
├── scripts/                        # backup.sh, tracardi-setup.sh
├── docker-compose.yml              # Dev environment (PG, Redis, NATS, Tracardi)
├── docker-compose.staging.yml      # Staging overrides
├── docker-compose.prod.yml         # Production hardening
├── Dockerfile                      # Multi-stage: Go builder → scratch
├── Makefile                        # Build/test targets
├── .github/workflows/ci.yml        # CI: vet → test (race) → build → docker
└── .env.production.example         # Documented env vars
```

---

### 1.2 Frontend: `marketing-automation-hks-frontend`

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Admin dashboard SPA for managing marketing campaigns, viewing analytics, managing templates, users, and integrations. |
| **Language** | TypeScript 6.0 |
| **Framework** | Vue 3.5 + Vite 8 + Pinia 3 + Vue Router 5 |
| **UI toolkit** | Tailwind CSS 4.2, Headless UI, Heroicons |
| **Charts** | Chart.js 4.5 via vue-chartjs |
| **Code editor** | CodeMirror 6 (HTML email template editing) |
| **Architecture** | Single-page application (SPA) served by nginx, proxies `/api/` to backend |
| **Lines of code** | ~6,900 lines across 81 source files |
| **Test files** | 0 (no tests exist) |

**Directory structure:**

```
marketing-automation-hks-frontend/
├── src/
│   ├── api/                        # Axios client + 6 API modules (7 files)
│   │   ├── client.ts               # Axios instance with Bearer token & env interceptors
│   │   ├── types.ts                # 58 TypeScript interfaces (387 lines)
│   │   ├── dashboard.ts            # Campaign, enrollment, log, consent APIs
│   │   ├── analytics.ts            # 9 analytics endpoint wrappers
│   │   ├── integrations.ts         # Integration CRUD (NO BACKEND)
│   │   ├── reports.ts              # Report schedule APIs
│   │   └── users.ts                # User CRUD APIs
│   ├── components/                 # 28 Vue components
│   │   ├── email-editor/           # 10 components for rich email template editing
│   │   └── (18 shared components) # Layout, UI primitives, charts, integrations
│   ├── views/                      # 28 page components
│   │   ├── analytics/              # 10 analytics dashboard pages
│   │   └── (18 core pages)        # Login, campaigns, templates, settings, etc.
│   ├── stores/                     # 8 Pinia stores (auth, campaigns, templates, etc.)
│   ├── composables/                # 6 Vue composables (theme, toast, SSE, validation)
│   ├── utils/                      # Email template utilities
│   ├── router/index.ts             # 23 routes with auth guards
│   ├── assets/                     # CSS design system + SVG logo
│   └── main.ts                     # App bootstrap
├── Dockerfile                      # Multi-stage: Node builder → nginx
├── nginx.conf                      # SPA fallback + API proxy
├── vite.config.ts                  # Vite + Tailwind + dev proxy
├── .github/workflows/ci.yml        # CI: typecheck → build → docker
└── package.json                    # Dependencies
```

---

### 1.3 How the Two Repos Relate

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (nginx:80)                                        │
│  Vue 3 SPA — all client-side routing                        │
│  /api/* proxied to backend                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP (REST JSON)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend (Go :8080)                                         │
│  Gin HTTP server — 60+ API endpoints                        │
│  ┌───────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐ │
│  │ Campaigns  │  │ Engine   │  │ Channels  │  │ Analytics│ │
│  │ CRUD       │  │ Trigger  │  │ Email/SMS │  │ Tracardi │ │
│  │            │  │ Execute  │  │ WA/Push   │  │ + CRM    │ │
│  └─────┬──────┘  └────┬─────┘  └─────┬─────┘  └─────┬────┘ │
│        │              │              │              │       │
│        ▼              ▼              ▼              ▼       │
│   PostgreSQL      NATS bus       External APIs   Tracardi  │
│   (GORM)          (pub/sub)      (HTTP)          CDP       │
│        │              │                                     │
│        ▼              ▼                                     │
│      Redis ◄──── Freq caps / dedup / caching               │
└─────────────────────────────────────────────────────────────┘
```

**Communication:** REST/JSON over HTTP. Frontend makes Axios calls to `/api/*`; nginx proxies to Go backend on port 8080.

**Shared models:** Types are independently duplicated — Go structs in `internal/model/` and TypeScript interfaces in `src/api/types.ts`. No shared schema source; manual sync required.

**Data flow:** Frontend → HTTP → Backend → NATS (async) → Engine (trigger/execute) → Channel senders → Provider APIs. Webhooks flow back: Provider → Backend webhooks → Update campaign_logs → SSE → Frontend real-time feed.

**Deployment:** Single `docker-compose.yml` in backend repo references `../marketing-automation-hks-frontend` to build frontend container. Both containers share a Docker network.

---

## SECTION 2 — FEATURE INVENTORY

### Campaign Management

| Feature | Repo | Maturity | Files | Notes |
|---------|------|----------|-------|-------|
| Campaign CRUD (create, read, update, delete) | Backend + Frontend | Production | `api/campaigns.go`, `store/postgres.go`, `views/CampaignsPage.vue`, `views/CampaignEditorPage.vue` | Full lifecycle with slug generation, step validation |
| Campaign activation/deactivation toggle | Backend + Frontend | Production | `api/campaigns.go:174-209`, `views/CampaignsPage.vue` | Auto-cancels in-flight enrollments on deactivation |
| Multi-step workflow builder | Backend + Frontend | Production | `model/campaign.go:28-52`, `views/CampaignEditorPage.vue` | 1-50 steps with delay, channel, template, condition per step |
| If/else branching logic | Backend | Production | `model/campaign.go:38-39`, `engine/executor.go:56-64` | `true_next`/`false_next` targets; -1 = complete, nil = sequential |
| A/B testing (variant splitting) | Backend + Frontend | Production | `model/campaign.go:43-52`, `engine/executor.go:154-167`, `api/funnel.go` | Weighted random selection, per-variant analytics |
| Campaign scheduling (end dates) | Backend | Production | `model/campaign.go:21`, `engine/scheduler.go:50-71` | Auto-deactivates campaigns past end_date |
| Audience segmentation | Backend | Production | `segment/resolver.go` | 5 segments: `all`, `vip` (>$500 spend), `at_risk` (14-30d), `dormant` (>30d), `new_customer` (<7d) |
| Campaign funnel analytics | Backend + Frontend | Production | `store/postgres.go:395-480`, `api/funnel.go`, `views/CampaignFunnelPage.vue` | Enrolled → Sent → Delivered → Opened → Clicked waterfall |
| 6 pre-seeded campaigns | Backend | Production | `seed/campaigns.go` | Cart abandonment, welcome, KYC nudge, payment recovery, winback, post-purchase |
| Campaign deletion protection | Backend | Production | `api/campaigns.go:146-172` | Prevents deletion when active enrollments exist |

### Channel Integrations

| Feature | Repo | Maturity | Files | Notes |
|---------|------|----------|-------|-------|
| Email via Elastic Email | Backend | Production | `channel/elasticemail.go` | Transactional API v4, template-based with merge params |
| SMS via Plivo | Backend | Production | `channel/plivo.go` | REST API v1, configurable sender ID |
| WhatsApp via Meta Cloud API | Backend | Production | `channel/whatsapp.go` | Graph API v18.0, template-based messages |
| Push via Firebase Cloud Messaging | Backend | Production | `channel/fcm.go` | FCM v1 HTTP API, OAuth2 service account auth |
| Circuit breaker per channel | Backend | Production | `channel/circuitbreaker.go` | Opens after 5 failures, resets after 60s timeout |
| Channel dispatcher | Backend | Production | `channel/dispatcher.go` | Routes messages to correct sender by channel name |
| Webhook receivers (delivery status) | Backend | Production | `api/webhooks.go` | Elastic Email, Plivo, WhatsApp delivery/open/click tracking |
| Auto-unsubscribe on provider complaint | Backend | Production | `api/webhooks.go:88-91` | Elastic Email "Unsubscribed" event triggers consent opt-out |
| Channels overview page | Frontend | Production | `views/ChannelsPage.vue` | Visual channel status |
| Integrations management UI | Frontend | **Broken** | `views/IntegrationsPage.vue`, `api/integrations.ts`, `stores/integrations.ts` | **Frontend calls `/api/integrations` but backend has NO corresponding routes** |

### Contact / Lead Management

| Feature | Repo | Maturity | Files | Notes |
|---------|------|----------|-------|-------|
| Consent management (opt-in/opt-out) | Backend + Frontend | Production | `consent/service.go`, `api/router.go:299-358`, `views/ConsentsPage.vue` | Per-channel consent; implicit opt-in model |
| Public preference center | Backend + Frontend | Production | `api/unsubscribe.go`, `views/PreferenceCenterPage.vue` | Token-based (no auth), public route |
| One-click unsubscribe links | Backend | Production | `api/unsubscribe.go:17-56` | HMAC-SHA256 signed tokens in email footers |
| Client email/phone lookup | Backend | Production | `store/postgres.go:528-542` | Queries existing CRM `clients` table |
| Frequency capping per channel | Backend | Production | `frequency/cap.go`, `store/redis.go` | Redis ZSET sliding window; configurable per channel (default 3 emails / 2 SMS / 2 WA / 5 push per week) |

### Automation Workflows

| Feature | Repo | Maturity | Files | Notes |
|---------|------|----------|-------|-------|
| Event-driven trigger system | Backend | Production | `engine/trigger.go`, `nats/subscriber.go` | NATS pub/sub, async enrollment |
| Multi-step executor with conditions | Backend | Production | `engine/executor.go` | Condition → Consent → FreqCap → Variant → Template → Dispatch → Log → Advance |
| Condition engine (6 conditions) | Backend | Production | `condition/condition.go`, `condition/*.go` | `always_true`, `no_purchase_since_enrollment`, `kyc_not_completed`, `no_order_in_days`, `message_opened`, `message_clicked` |
| Cancellation events | Backend | Production | `engine/cancellation.go` | Inbound event cancels matching campaigns (e.g., purchase cancels cart abandonment) |
| Scheduled step processing | Backend | Production | `engine/scheduler.go:36-99`, `engine/jobs.go` | Quartz job every 1 minute, worker pool (configurable concurrency) |
| Winback detection (dormant clients) | Backend | Production | `engine/scheduler.go:102-117` | Daily job finds dormant clients, triggers winback campaign |
| Enrollment expiry cleanup | Backend | Production | `engine/scheduler.go:161-170` | Daily job expires enrollments older than 90 days |
| Tracardi segment tagging | Backend | Production | `engine/scheduler.go:121-158` | Daily job tags at-risk/dormant clients in Tracardi CDP |
| NATS message deduplication | Backend | Production | `nats/subscriber.go:46-55` | SHA256 hash dedup with 5-minute Redis TTL |
| Runaway protection | Backend | Production | `engine/executor.go:75-95` | Force-completes enrollment after 50 step executions |
| Idempotent enrollment | Backend | Production | `store/postgres.go:198-205` | Partial unique index prevents duplicate active enrollments per client+campaign |

### Analytics & Reporting

| Feature | Repo | Maturity | Files | Notes |
|---------|------|----------|-------|-------|
| Executive dashboard (revenue, traffic, orders) | Backend + Frontend | Production | `api/analytics.go:65-167`, `views/analytics/ExecutivePage.vue` | CRM + Tracardi CDP data with period-over-period deltas |
| Acquisition analytics (UTM, sources) | Backend + Frontend | Production | `api/analytics.go:278-345`, `views/analytics/AcquisitionPage.vue` | UTM source/campaign aggregations from Tracardi |
| Funnel analytics (page view → purchase) | Backend + Frontend | Production | `api/analytics.go:169-244`, `views/analytics/FunnelPage.vue` | 5-stage funnel with conversion & drop-off rates |
| User analytics (DAU/WAU/MAU) | Backend + Frontend | Production | `api/analytics.go:347-404`, `views/analytics/UsersPage.vue` | Cardinality aggregations from Tracardi |
| Product analytics | Backend + Frontend | Production | `api/analytics.go:406-470`, `views/analytics/ProductsPage.vue` | Product view → cart → purchase per product |
| Payment analytics | Backend + Frontend | Production | `api/analytics.go:472-523`, `views/analytics/PaymentsPage.vue` | Payment methods, approval/decline rates, failure reasons |
| Order analytics | Backend + Frontend | Production | `api/analytics.go:246-276`, `views/analytics/OrdersPage.vue` | AOV, revenue trends, order status breakdown |
| Retention analytics (cohorts) | Backend + Frontend | Production | `api/analytics.go:525-556`, `views/analytics/RetentionPage.vue` | Monthly cohort retention + campaign conversions |
| Data health monitoring | Backend + Frontend | Production | `api/analytics.go:558-651`, `views/analytics/DataHealthPage.vue` | Service status, event freshness, volume anomalies |
| Dashboard overview (campaign stats) | Backend + Frontend | Production | `api/dashboard.go`, `store/dashboard.go`, `views/OverviewPage.vue` | Campaign counts, channel stats, daily volume chart |
| Real-time SSE feed | Backend + Frontend | Production | `api/sse.go`, `composables/useSSE.ts`, `stores/dashboard.ts` | NATS → SSE → live enrollment/log feed in dashboard |
| CSV export (logs & enrollments) | Backend + Frontend | Production | `api/export.go`, `api/dashboard.ts` | Filterable CSV downloads |
| Scheduled email reports | Backend | Production | `reporting/generator.go`, `reporting/renderer.go`, `reporting/job.go` | Daily/weekly/monthly HTML reports sent via Elastic Email |
| Report management UI | Frontend | Production | `views/analytics/ReportsPage.vue`, `stores/reports.ts` | Create, edit, delete, run-now report schedules |

### Personalisation & Content

| Feature | Repo | Maturity | Files | Notes |
|---------|------|----------|-------|-------|
| Message template CRUD | Backend + Frontend | Production | `api/templates.go`, `model/template.go`, `views/TemplatesPage.vue` | Per-channel templates with variables |
| Rich email template editor | Frontend | Production | `components/email-editor/*.vue` (10 files) | CodeMirror HTML editor, live preview with DOMPurify sanitization |
| Template variable system | Backend + Frontend | Production | `model/template.go:24-56`, `composables/useVariableParser.ts` | `{{variable}}` syntax, required/optional vars, validation |
| Email validation rules | Frontend | Production | `composables/useEmailValidation.ts` | Subject length, preheader length, unsubscribe URL required, body size check |
| Test send functionality | Backend + Frontend | Production | `api/test_send.go`, `components/TestSendModal.vue` | Send test messages to specific clients |
| Unsaved changes protection | Frontend | Production | `composables/useUnsavedChanges.ts` | Browser `beforeunload` + Vue Router guard |

### Integrations & APIs

| Feature | Repo | Maturity | Files | Notes |
|---------|------|----------|-------|-------|
| 60+ REST API endpoints | Backend | Production | `api/router.go:82-218` | Full CRUD for all entities + analytics + webhooks |
| Internal API (service-to-service) | Backend | Production | `api/router.go:104-112` | X-API-Key auth for Tracardi → Backend triggers |
| Tracardi CDP integration | Backend | Production | `tracardi/client.go`, `tracardi/cache.go`, `tracardi/aggregations.go` | Analytics queries + segment tagging via /track endpoint |
| Webhook receivers (3 providers) | Backend | Production | `api/webhooks.go` | Elastic Email, Plivo, WhatsApp delivery callbacks |
| Health check endpoint | Backend + Frontend | Production | `api/router.go:220-254`, `views/HealthPage.vue` | Checks postgres, redis, nats connectivity |

### Admin & Configuration

| Feature | Repo | Maturity | Files | Notes |
|---------|------|----------|-------|-------|
| JWT authentication | Backend + Frontend | Production | `auth/auth.go`, `middleware/auth.go`, `stores/auth.ts` | HS256 JWT with configurable expiry |
| Role-based access control (RBAC) | Backend + Frontend | Production | `middleware/rbac.go`, `router/index.ts:195-213` | 3 roles: admin, editor, viewer |
| User management (admin) | Backend + Frontend | Production | `api/users.go`, `store/users.go`, `views/UsersPage.vue` | Full CRUD, password hashing, activation toggle |
| Audit logging | Backend + Frontend | Production | `api/audit.go`, `model/audit.go`, `views/AuditLogsPage.vue` | Logs every action with user, resource, IP, detail JSON |
| Rate limiting | Backend | Production | `middleware/ratelimit.go` | Redis-backed per-IP limiter (10/min login, 100/min webhooks) |
| Environment switching (sandbox/prod) | Frontend | Production | `stores/environment.ts`, `components/EnvironmentSwitcher.vue` | Sends `X-Environment` header; production confirmation dialog |
| Dark/light theme | Frontend | Production | `composables/useTheme.ts`, `assets/design-system.css` | System preference detection + manual toggle |
| Password change | Backend + Frontend | Production | `api/settings.go`, `views/SettingsPage.vue` | Self-service password change |
| Backup script | Backend | Production | `scripts/backup.sh` | PostgreSQL pg_dump + Redis RDB + S3 upload + rotation |

---

## SECTION 3 — PROBLEMS & RISKS

### 3a. Bugs & Logic Errors

| # | Severity | File(s) | Description |
|---|----------|---------|-------------|
| B1 | **Critical** | `frontend: api/integrations.ts:4-30`, `stores/integrations.ts`, `views/IntegrationsPage.vue` | **Frontend calls `/api/integrations` CRUD endpoints that DO NOT EXIST in the backend.** The integrations page will show HTTP 404 errors on every action. The entire Integrations feature is broken. |
| B2 | **High** | `backend: api/campaigns.go:211-222` | **`generateSlug()` produces double hyphens** for input with multiple spaces (e.g., `"two  spaces"` → `"two--spaces"`). Confirmed in test at `handlers_test.go:17`. This can cause ugly URLs and potential slug collisions. |
| B3 | **Medium** | `backend: engine/executor.go:75-95` | **Runaway protection silently completes enrollment.** When 50 steps are reached, enrollment is force-completed but no `CampaignLog` entry is written — the completion reason is invisible in the UI. Only a server log is emitted. |
| B4 | **Medium** | `backend: engine/executor.go:118-131` | **Condition evaluation errors cause step skip, not retry.** If `cond.Evaluate()` returns an error (e.g., transient DB failure), the step is marked `skipped` and enrollment advances. The message is permanently lost — no retry mechanism exists. |
| B5 | **Medium** | `backend: api/analytics.go:90-91` | **Tracardi timeout silently degrades analytics.** A 5-second timeout on Tracardi queries returns partial data with `tracardi_degraded: true` but the frontend doesn't visually indicate data incompleteness to the user. |
| B6 | **Low** | `backend: engine/executor.go:248` | **A/B variant selection uses `math/rand` without seeding.** In Go 1.20+ this auto-seeds, but it's non-deterministic for reproducibility in tests. |
| B7 | **Low** | `backend: store/postgres.go:177-196` | **`FindDormantClients` queries `clients` and `orders` tables** that belong to the external CRM, not this service's schema. If CRM schema changes, these queries silently break. No foreign key constraints protect this. |
| B8 | **Low** | `frontend: api/types.ts:306-329` | **`CampaignFunnelStats` type includes rate fields** (`sent_rate`, `delivery_rate`, `open_rate`, `click_rate`) that the backend does NOT return — backend returns raw counts only. Frontend will show `undefined` for rates. |

### 3b. Security Vulnerabilities

| # | Severity | File(s) | Description |
|---|----------|---------|-------------|
| S1 | **Critical** | `backend: config/config.go:44,50,58` | **Insecure default secrets in production.** `JWT_SECRET`, `INTERNAL_API_KEY`, and `UNSUBSCRIBE_SECRET` all default to `"change-me-in-production"`. If deployed without setting these, ALL tokens are signed with a publicly-known key. Warnings are logged but the server starts normally. |
| S2 | **Critical** | `backend: cmd/server/main.go:208-215` | **Default admin password is `"admin"`.** If `ADMIN_PASSWORD_HASH` is not set, the system uses the hardcoded password `"admin"`. Combined with the known default email `admin@duegate.com`, this is a complete auth bypass. |
| S3 | **High** | `frontend: api/client.ts:11-12`, `stores/auth.ts:34` | **JWT stored in localStorage.** Auth tokens are stored in `localStorage` instead of HTTP-only secure cookies. Any XSS vulnerability would expose the JWT, allowing full account takeover. |
| S4 | **High** | `backend: middleware/cors.go:20-22` | **CORS allows wildcard in production if misconfigured.** Default `CORS_ALLOWED_ORIGINS` is `"*"`. When set, the middleware reflects the `Origin` header — this is equivalent to `Access-Control-Allow-Origin: *` with credentials. |
| S5 | **High** | `backend: middleware/cors.go:24-27` | **Missing security headers.** No `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, or `X-XSS-Protection` headers are set. |
| S6 | **Medium** | `backend: api/webhooks.go:33-38` | **Webhook signature verification is a simple string comparison** rather than constant-time comparison for Elastic Email. Plivo signature also uses direct comparison. This is vulnerable to timing attacks. (WhatsApp uses Meta's verification challenge which is OK.) |
| S7 | **Medium** | `backend: api/router.go:89` | **Health check endpoint is public** and reveals infrastructure status (postgres: up/down, redis: up/down, nats: up/down). Attackers can probe for infrastructure weaknesses. |
| S8 | **Medium** | `backend: api/webhooks.go:33-38, 128-134` | **Webhook signatures are optional.** If `WEBHOOK_SECRET_*` env vars are empty, signature verification is skipped entirely. An attacker could forge delivery events to manipulate campaign analytics. |
| S9 | **Low** | `backend: Dockerfile:1` | **Dockerfile uses Go 1.22-alpine** but `go.mod` specifies Go 1.23. Version mismatch may cause subtle build issues. |
| S10 | **Low** | `backend: go.mod:14` | **`golang.org/x/crypto v0.18.0` is outdated** (released Jan 2024). Should be updated to latest for security patches. |

### 3c. Performance Bottlenecks

| # | Severity | File(s) | Description |
|---|----------|---------|-------------|
| P1 | **High** | `backend: store/dashboard.go:197-228` | **N+1 query in `GetCampaignPerformance`.** For each campaign slug, two additional COUNT queries are executed inside a loop (enrollments + completions). With 50 campaigns, this is 100 extra queries per dashboard load. |
| P2 | **High** | `backend: store/analytics.go:90-134` | **N+1 in `GetCohortData`.** For each cohort month, nested queries run for each subsequent month (up to 6). A 12-month view executes ~72 queries. |
| P3 | **Medium** | `backend: store/dashboard.go:130-154` | **`GetOverviewStats` executes 6 separate COUNT queries** instead of a single query with conditional aggregation. Each request hits the DB 6 times. |
| P4 | **Medium** | `backend: store/postgres.go:395-454` | **`GetCampaignFunnel` executes 7 separate queries** (4 enrollment counts + 3 log counts) that could be consolidated into 1-2 queries with CASE expressions. |
| P5 | **Medium** | `backend: api/analytics.go:65-167` | **Executive analytics makes 10+ external calls** (CRM queries + Tracardi queries) sequentially. These could be parallelized with goroutines. |
| P6 | **Low** | `backend: engine/scheduler.go:37` | **`FindDueEnrollments` hardcoded limit of 500.** Under high load, this creates a ceiling — more than 500 due enrollments will queue up and lag behind. |
| P7 | **Low** | `backend: store/postgres.go:484-542` | **No indexes on external CRM tables** (`clients`, `orders`). The queries against these tables rely on indexes existing in the CRM schema, which this service cannot guarantee. |

### 3d. Code Quality & Maintainability

| # | Severity | File(s) | Description |
|---|----------|---------|-------------|
| Q1 | **High** | `frontend: api/types.ts` vs `backend: model/*.go` | **Type definitions duplicated across repos** with no shared source of truth. 58 TypeScript interfaces must be manually kept in sync with Go structs. Drift already exists (see B8 — frontend `CampaignFunnelStats` has fields backend doesn't return). |
| Q2 | **High** | `backend: api/router.go:44-80` | **Server struct is a god object** with 16 fields. `NewServer()` takes 16 parameters. This makes testing extremely difficult and indicates too many responsibilities in one struct. |
| Q3 | **Medium** | `backend: api/analytics.go` | **analytics.go is 651 lines** with 9 handler functions that all follow the same pattern (parse filters → query CRM → query Tracardi → assemble response). High duplication. |
| Q4 | **Medium** | `frontend: api/dashboard.ts` | **dashboard.ts is a catch-all** for 25+ API functions that should be split by domain (campaigns, enrollments, logs, consents, export, funnel, audit, settings, test-send). |
| Q5 | **Medium** | `backend: reporting/generator.go:38-108` | **`CollectReportData` and `GenerateAndSend` share 90% identical code** (the module collection loop). Should be refactored to call `CollectReportData` from `GenerateAndSend`. |
| Q6 | **Low** | `backend: api/unsubscribe.go:114-205` | **HTML templates are hardcoded Go string constants.** Should be in template files for maintainability and to allow non-developer editing. |
| Q7 | **Low** | Multiple frontend files | **Hardcoded color values** appear in component code (e.g., `'#020288'` in `OverviewPage.vue`) instead of using CSS variables from the design system. |

### 3e. Testing Gaps

| # | Severity | File(s) | Description |
|---|----------|---------|-------------|
| T1 | **Critical** | `frontend: (entire repo)` | **ZERO test files exist in the frontend repo.** No unit tests, no integration tests, no e2e tests. The `package.json` has no test runner configured. |
| T2 | **High** | `backend: internal/engine/` | **No tests for the campaign execution engine** — the most critical code path (trigger → execute → dispatch → advance). `executor.go`, `trigger.go`, `scheduler.go` are all untested. |
| T3 | **High** | `backend: internal/api/` | **No HTTP handler tests.** Only `generateSlug()` and `parseInt()` helper functions are tested. None of the 60+ API endpoints have handler-level tests. |
| T4 | **High** | `backend: internal/channel/` | **No tests for channel senders.** `elasticemail.go`, `plivo.go`, `whatsapp.go`, `fcm.go` have no tests. These are external API integrations — the highest-risk code for mocking. |
| T5 | **Medium** | `backend: internal/store/` | **No tests for database queries.** The store layer (postgres.go, dashboard.go, analytics.go, users.go, reports.go) has no test coverage despite being 900+ lines. |
| T6 | **Medium** | `backend: internal/api/handlers_test.go` | **Existing tests are minimal** — only 2 functions tested (`generateSlug` with 12 cases, `parseInt` with 10 cases). Total test code: ~100 lines. |

### 3f. DevOps & Infrastructure

| # | Severity | File(s) | Description |
|---|----------|---------|-------------|
| D1 | **High** | `backend: .github/workflows/ci.yml` | **CI does not push Docker images to a registry.** The docker job builds an image but doesn't push it anywhere. Deployments must be done manually. |
| D2 | **High** | `frontend: .github/workflows/ci.yml` | **Same issue — CI builds Docker image but doesn't push.** No CD pipeline exists for either repo. |
| D3 | **Medium** | Both repos | **No linting enforcement in CI.** Backend CI runs `go vet` but not `golangci-lint`. Frontend CI runs `vue-tsc` type-check but no ESLint or Prettier. |
| D4 | **Medium** | `backend: docker-compose.yml:27` | **Dev docker-compose uses insecure defaults.** `JWT_SECRET: "dev-jwt-secret-do-not-use-in-prod"` and `CORS_ALLOWED_ORIGINS: "*"` are hardcoded. Developers may copy these to production. |
| D5 | **Medium** | Both repos | **No observability stack.** No structured metric export (Prometheus), no distributed tracing (OpenTelemetry), no error tracking (Sentry). Only `zap` structured logging exists. |
| D6 | **Low** | `backend: reporting/generator.go:296` | **Report emails use `http.DefaultClient`** (no timeout, no circuit breaker) instead of the configured HTTP client. Could hang indefinitely. |
| D7 | **Low** | `frontend: nginx.conf:13-19` | **nginx API proxy has no timeouts configured.** Long-running backend requests could hold nginx connections open indefinitely. |

### 3g. Data Integrity

| # | Severity | File(s) | Description |
|---|----------|---------|-------------|
| I1 | **High** | `backend: model/campaign.go:184-205` | **GORM AutoMigrate for schema management.** No versioned migration files exist. Schema changes are applied automatically at startup — this is dangerous in production as it can't roll back and may cause data loss on column type changes. |
| I2 | **Medium** | `backend: store/postgres.go:177-196` | **Cross-database dependency on CRM tables.** Store queries reference `clients`, `orders`, `client_kyc` tables that belong to an external CRM database. No foreign keys, no schema validation, no migration control. |
| I3 | **Medium** | `backend: consent/service.go:22-31` | **Implicit opt-in consent model.** No database record = client has consent. If the `client_consents` table is accidentally truncated, ALL clients become implicitly opted-in. May violate GDPR/privacy regulations that require explicit opt-in. |
| I4 | **Low** | `backend: store/postgres.go:81-83` | **Hard delete for campaigns.** `DeleteDefinition` does `db.Delete()` (hard delete). No soft-delete strategy — deleted campaigns lose all historical context. Orphaned enrollments/logs reference deleted campaigns. |
| I5 | **Low** | `backend: store/users.go:47-49` | **Hard delete for users.** Same issue — deleted users lose audit log attribution. |

### 3h. Documentation Gaps

| # | Severity | File(s) | Description |
|---|----------|---------|-------------|
| H1 | **Medium** | Both repos | **No API documentation (OpenAPI/Swagger).** With 60+ endpoints, developers must read Go source code to understand request/response shapes. |
| H2 | **Medium** | `frontend: .env.production`, `.env.staging` | **Empty env files with no documentation.** Both contain only `VITE_API_URL=` with no explanation of what value to set or how deployment works. |
| H3 | **Low** | Both repos | **No architecture diagram.** The README describes the system textually but lacks visual diagrams for data flow, deployment topology, or component interaction. |
| H4 | **Low** | Both repos | **No onboarding guide.** New developers must reverse-engineer the setup from docker-compose files and env examples. |

---

## SECTION 4 — SUGGESTED FEATURES

### P0 — Table Stakes (missing basics that users expect)

| # | Feature | Description | Repo | Complexity | Dependencies |
|---|---------|-------------|------|------------|--------------|
| F1 | **Integrations API backend** | Implement `/api/integrations` CRUD endpoints to match the existing frontend. Store integration configs (API keys, endpoints) per provider per environment. | Backend | M | New `Integration` model + migration |
| F2 | **Contact/lead list management** | Import/export contacts, search, filter, view contact profiles with activity history. Currently contacts exist only in the external CRM with no UI. | Both | L | CRM database access or dedicated contact store |
| F3 | **Campaign duplication** | "Clone campaign" button to copy an existing campaign as a starting point. Standard in every marketing platform. | Both | S | Existing campaign CRUD |
| F4 | **Email template preview with sample data** | Live preview of email templates with real merge variable substitution. Frontend has `SampleDataEditor.vue` but backend doesn't support preview rendering. | Backend | S | Template engine in backend |
| F5 | **Search and filtering** | Global search across campaigns, templates, enrollments, logs. Currently no search functionality on list pages. | Both | M | Full-text search (PostgreSQL `tsvector` or Elasticsearch) |
| F6 | **Pagination on all list endpoints** | Some list endpoints (campaigns, templates) return all records without pagination. Needs cursor-based or offset pagination. | Backend | S | Existing store layer |
| F7 | **Error boundary in frontend** | No global error boundary exists. Unhandled JS errors render a blank white screen with no recovery path. | Frontend | S | Vue `errorCaptured` hook |

### P1 — High Impact (competitive differentiators, revenue drivers)

| # | Feature | Description | Repo | Complexity | Dependencies |
|---|---------|-------------|------|------------|--------------|
| F8 | **Visual workflow builder** | Drag-and-drop campaign step editor with branching visualization. Current editor is a JSON form. | Frontend | XL | Requires canvas/SVG library (e.g., Vue Flow) |
| F9 | **Dynamic audience segments** | User-defined segments with arbitrary filter rules (e.g., "spent > $100 AND last_order < 30d AND country = UAE"). Current segments are 5 hardcoded options. | Both | L | Query builder UI + segment evaluation engine |
| F10 | **A/B test statistical significance** | Auto-calculate sample size, confidence intervals, and declare winners. Current A/B tests show raw counts with no statistical analysis. | Both | M | Statistics library + winner declaration logic |
| F11 | **Campaign versioning/rollback** | Track campaign definition changes over time and allow rollback to previous versions. | Both | M | Version history table + diff UI |
| F12 | **Webhook/API trigger builder** | Allow users to define custom webhook endpoints that trigger campaigns from external systems without code changes. | Both | M | Dynamic route registration or generic webhook handler |
| F13 | **Multi-language templates** | Support template variants per language with automatic language selection based on client profile. | Both | L | Language field on templates + client language lookup |
| F14 | **AI-generated copy suggestions** | Use Claude API to suggest email subject lines, body copy, and SMS text based on campaign goals and audience. | Both | M | Claude API integration |

### P2 — Nice to Have (polish, DX improvements, future-proofing)

| # | Feature | Description | Repo | Complexity | Dependencies |
|---|---------|-------------|------|------------|--------------|
| F15 | **OpenAPI/Swagger docs** | Auto-generate API documentation from Go handler annotations. | Backend | M | `swaggo/swag` or manual OpenAPI spec |
| F16 | **Type generation from OpenAPI** | Generate TypeScript types from the OpenAPI spec to eliminate manual type sync. | Both | S | F15 (OpenAPI spec) |
| F17 | **Webhook retry with backoff** | Retry failed channel sends with exponential backoff instead of marking as permanent failure. | Backend | M | Retry queue (Redis or NATS JetStream) |
| F18 | **Campaign analytics comparison** | Compare two campaigns side-by-side (A vs B performance). | Both | M | Existing funnel data |
| F19 | **Bulk operations** | Bulk activate/deactivate/delete campaigns. Bulk opt-out contacts. | Both | S | Existing store methods |
| F20 | **Timezone-aware scheduling** | Schedule campaign steps relative to client timezone rather than server UTC. | Backend | M | Client timezone field + time zone library |
| F21 | **Dark mode email preview** | Preview emails in dark mode rendering (Gmail, Apple Mail dark mode simulation). | Frontend | S | CSS invert transform in preview pane |
| F22 | **Storybook component library** | Document all Vue components with interactive examples. | Frontend | M | Storybook + Vue plugin |

---

## SECTION 5 — RECOMMENDED FIXES (ACTION PLAN)

### Sprint 1 — Critical Fixes (security, data loss, crashes)

| # | Problem Ref | File(s) & Lines | Fix Description | Effort | Risk if NOT Fixed |
|---|-------------|-----------------|-----------------|--------|-------------------|
| 1.1 | S1 | `config/config.go:44,50,58` | **Make secrets required in production.** Add a `ENVIRONMENT` env var; when `production`, refuse to start if `JWT_SECRET`, `INTERNAL_API_KEY`, or `UNSUBSCRIBE_SECRET` are set to defaults. Change defaults to empty strings and mark as `required` when `ENVIRONMENT=production`. | 2h | Full authentication bypass in production. Any attacker can forge valid JWTs. |
| 1.2 | S2 | `cmd/server/main.go:208-215` | **Remove default admin password.** When `ADMIN_PASSWORD_HASH` is empty, generate a random 32-char password, print it once to stdout, and hash it. Never use `"admin"` as a fallback. | 1h | Anyone can log in as admin with `admin@duegate.com` / `admin`. |
| 1.3 | B1 | `backend: api/router.go`, new file `api/integrations.go` | **Implement `/api/integrations` backend routes** or **remove the Integrations page from the frontend.** Recommended: implement at minimum a read-only endpoint that returns channel provider status from env vars, so the existing UI works. | 8h (implement) or 1h (remove) | Integrations page is completely broken — 404 on every API call. |
| 1.4 | S5 | `middleware/cors.go:24-27` | **Add security headers middleware.** Create a new middleware that adds: `Strict-Transport-Security: max-age=31536000`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'self'`. | 2h | Vulnerable to clickjacking, MIME sniffing, and missing HSTS. |
| 1.5 | T1 | `frontend: package.json` | **Set up Vitest test framework.** Add `vitest`, `@vue/test-utils`, and `jsdom`. Create test configs. Write smoke tests for: auth store, router guards, API client interceptors. | 4h | Zero test safety net — any change can break the app undetected. |
| 1.6 | I1 | `backend: model/campaign.go:184-205` | **Replace GORM AutoMigrate with versioned migrations.** Use `golang-migrate/migrate` or `pressly/goose`. Export current schema as v1 migration. Remove AutoMigrate call. | 4h | Schema changes in production could cause data loss or downtime with no rollback. |
| 1.7 | S9 | `backend: Dockerfile:1` | **Fix Dockerfile Go version.** Change `FROM golang:1.22-alpine` to `FROM golang:1.23-alpine` to match `go.mod`. | 5min | Build may use wrong Go version, causing subtle compatibility issues. |

### Sprint 2 — High-Value Improvements (performance, reliability, DX)

| # | Problem Ref | File(s) & Lines | Fix Description | Effort | Risk if NOT Fixed |
|---|-------------|-----------------|-----------------|--------|-------------------|
| 2.1 | P1 | `store/dashboard.go:197-228` | **Fix N+1 in `GetCampaignPerformance`.** Rewrite as a single SQL query with LEFT JOINs and GROUP BY to get enrollment/completion counts alongside log stats. | 3h | Dashboard load time grows linearly with campaign count. 50 campaigns = 100+ extra queries. |
| 2.2 | P2 | `store/analytics.go:90-134` | **Fix N+1 in `GetCohortData`.** Rewrite the nested loop as a single query with date_trunc and conditional counting. | 3h | Retention page makes 72+ queries for a 12-month view. |
| 2.3 | P3 | `store/dashboard.go:130-154` | **Consolidate `GetOverviewStats` into a single query.** Use `COUNT(*) FILTER (WHERE ...)` to get all 6 counts in one pass. | 1h | 6 queries per dashboard load instead of 1. |
| 2.4 | S3 | `frontend: api/client.ts`, `stores/auth.ts` | **Migrate JWT to HTTP-only cookies.** Backend sets `Set-Cookie` with `HttpOnly; Secure; SameSite=Strict`. Frontend removes localStorage token logic. Axios sends cookies automatically. | 8h | XSS can steal auth tokens from localStorage. |
| 2.5 | S4 | `middleware/cors.go:20-22`, `config/config.go:70` | **Change CORS default to empty (deny all).** Require explicit `CORS_ALLOWED_ORIGINS` configuration. Reject requests from unlisted origins. | 1h | Wildcard CORS in production allows any website to make authenticated requests. |
| 2.6 | D1, D2 | `.github/workflows/ci.yml` (both repos) | **Add CD pipeline.** Push Docker images to a container registry (GHCR or ECR) on main branch. Add deployment step (SSH, Kubernetes, or docker-compose pull). | 8h | Manual deployments are error-prone and slow. |
| 2.7 | B4 | `engine/executor.go:118-131` | **Add retry logic for transient failures.** Distinguish between business logic errors (condition not met — skip) and infrastructure errors (DB timeout — retry). Use NATS JetStream for reliable retry with backoff. | 8h | Transient DB failures permanently lose messages. |
| 2.8 | Q2 | `api/router.go:25-80` | **Break up Server god object.** Extract domain-specific handlers into separate handler structs (CampaignHandler, TemplateHandler, AnalyticsHandler) that each take only their required dependencies. | 4h | Difficult to test, understand, or modify any single endpoint. |
| 2.9 | T2, T3 | `backend: internal/engine/`, `internal/api/` | **Write tests for critical paths.** Priority: (1) Executor.Execute flow, (2) TriggerService.Trigger, (3) Campaign CRUD handlers, (4) Auth login handler. Use table-driven tests with mock store. | 16h | Core business logic has zero test coverage. |
| 2.10 | D5 | Both repos | **Add Prometheus metrics.** Expose `/metrics` endpoint with: request latency, campaign step execution time, channel send success/failure rates, queue depth. | 4h | No visibility into production performance or error rates. |

### Sprint 3 — Tech Debt Paydown (refactors, test coverage, docs)

| # | Problem Ref | File(s) & Lines | Fix Description | Effort | Risk if NOT Fixed |
|---|-------------|-----------------|-----------------|--------|-------------------|
| 3.1 | T4, T5 | `backend: internal/channel/`, `internal/store/` | **Add tests for channel senders and store layer.** Mock HTTP clients for channel tests. Use test database for store tests (CI already provisions PG). | 16h | External API integration bugs are invisible until production. |
| 3.2 | Q1, F16 | Both repos | **Create OpenAPI spec and generate TypeScript types.** Write OpenAPI 3.0 spec for all endpoints. Use `openapi-typescript` to generate `types.ts` automatically. | 8h | Type drift between repos causes runtime errors (see B8). |
| 3.3 | Q3 | `api/analytics.go` | **Extract common analytics pattern.** Create a generic analytics handler factory that takes (CRM queries, Tracardi queries) and produces the JSON response. Reduces 651 lines to ~200. | 4h | Analytics code is hard to maintain and extend. |
| 3.4 | Q5 | `reporting/generator.go:38-108` | **Eliminate duplication in report generator.** Have `GenerateAndSend` call `CollectReportData` internally instead of duplicating the module collection loop. | 1h | Changes to report data collection must be made in two places. |
| 3.5 | H1, F15 | Backend | **Add OpenAPI/Swagger documentation.** Use `swaggo/swag` annotations on handlers to auto-generate interactive API docs. | 8h | Developers must read source code to understand API contracts. |
| 3.6 | D3 | Both repos' CI | **Add linting to CI.** Backend: add `golangci-lint run` step. Frontend: add ESLint + Prettier with `--check` flag. | 3h | Code style inconsistencies creep in over time. |
| 3.7 | I4, I5 | `store/postgres.go:81-83`, `store/users.go:47-49` | **Implement soft delete.** Add `deleted_at` column to campaigns and users. Use GORM's soft-delete feature. Update queries to filter deleted records. | 3h | Deleted campaigns/users lose all historical audit trail. |
| 3.8 | Q6 | `api/unsubscribe.go:114-205` | **Move HTML templates to files.** Extract unsubscribe page HTML to `templates/` directory. Use Go's `html/template` package. | 2h | Non-developers can't edit unsubscribe pages without code changes. |
| 3.9 | H2, H4 | Both repos | **Write onboarding documentation.** Create `CONTRIBUTING.md` with: local setup steps, env var reference, architecture overview, deployment guide. | 4h | New developers waste days figuring out the setup. |

### Sprint 4 — Feature Enhancements (new capabilities)

| # | Feature Ref | Fix Description | Effort | Risk if NOT Fixed |
|---|-------------|-----------------|--------|-------------------|
| 4.1 | F1 | **Implement integrations API.** Create `model/integration.go`, `store/integrations.go`, `api/integrations.go` with full CRUD + connection testing. Store encrypted API keys per provider per environment. | 16h | Integrations page is broken, channel configuration is env-var-only. |
| 4.2 | F3 | **Add campaign duplication.** New endpoint `POST /api/campaigns/:id/clone` that copies definition with a new slug suffix. Frontend button on campaign card. | 4h | Users must manually recreate similar campaigns. |
| 4.3 | F7 | **Add frontend error boundary.** Create `ErrorBoundary.vue` component using Vue's `onErrorCaptured` hook. Wrap main app content. Show user-friendly error page with "Reload" button. | 2h | Unhandled errors show blank white screen. |
| 4.4 | F6 | **Add pagination to list endpoints.** Add `limit`/`offset` query params to `GET /api/campaigns` and `GET /api/templates`. Frontend: add pagination controls. | 4h | Performance degrades as campaign/template count grows. |
| 4.5 | F9 | **Implement dynamic audience segments (phase 1).** Add a `segment_rules` JSONB column to campaigns. Build a rule evaluator that supports field comparisons (spend, last_order, country, KYC level). | 16h | Only 5 hardcoded segments — users can't target custom audiences. |
| 4.6 | F17 | **Add retry queue for failed sends.** Use NATS JetStream or a Redis-backed queue. Failed sends get retried 3 times with exponential backoff (1m, 5m, 30m). | 8h | Failed sends are permanent — no recovery possible. |

---

## SECTION 6 — CROSS-REPO ARCHITECTURE REVIEW

### 6.1 Communication Pattern

**Protocol:** REST/JSON over HTTP. The frontend's nginx container proxies `/api/*` to the Go backend on port 8080 within the Docker network.

**Real-time:** Server-Sent Events (SSE) from backend → frontend for live dashboard updates. Backend subscribes to NATS `dashboard.events` subject and streams to connected SSE clients.

**Internal service-to-service:** The backend exposes `/internal/*` endpoints with `X-API-Key` authentication for Tracardi → Backend campaign triggers. This is a separate auth mechanism from JWT.

### 6.2 API Contract Validation

**Current state: No contract validation exists.**

- No OpenAPI/Swagger specification
- No schema validation middleware
- No API versioning (`/api/v1/...`)
- Types are manually duplicated between Go structs and TypeScript interfaces
- **Confirmed drift exists:** Frontend `CampaignFunnelStats` type includes `sent_rate`, `delivery_rate`, `open_rate`, `click_rate` fields that the backend does not return (backend returns raw counts only)

**Recommendation:** Generate an OpenAPI 3.0 spec from the Go handlers, then use `openapi-typescript` to auto-generate the frontend types. Add contract tests that validate both sides match.

### 6.3 Duplicated Logic

| Logic | Backend Location | Frontend Location | Recommendation |
|-------|------------------|-------------------|----------------|
| Type definitions (58 types) | `internal/model/*.go` | `src/api/types.ts` | Generate from shared OpenAPI spec |
| Channel validation (`email\|sms\|whatsapp\|push`) | `api/router.go:476-478` | `src/api/types.ts:345` (ProviderType) | Define canonical list in API spec |
| Role checking (`admin\|editor\|viewer`) | `middleware/rbac.go` | `router/index.ts:195-213`, `stores/auth.ts:17-19` | Derive from JWT claims |
| Enrollment status values | `model/campaign.go:97-102` | `src/api/types.ts:38` | Generate from shared spec |
| CRUD boilerplate (5 entities) | 65 handler functions across 7 files | 6 API modules, 8 stores | Backend: generic REST handler with Go generics. Frontend: generic `useCrud<T>` composable |

### 6.4 Circular Dependencies & Coupling

**No circular dependencies exist.** The dependency graph is strictly one-directional:

```
Frontend → (HTTP) → Backend → (NATS) → Engine → Store → PostgreSQL/Redis
                  → (HTTP) → External APIs (Elastic Email, Plivo, Meta, FCM)
                  → (HTTP) → Tracardi CDP
```

**Coupling assessment:**

- **Tight coupling to Tracardi CDP:** 9 analytics endpoints make direct Tracardi queries. If Tracardi is replaced, most of `api/analytics.go` and `tracardi/*.go` must be rewritten. **Recommendation:** Abstract behind an `AnalyticsProvider` interface.
- **Tight coupling to external CRM schema:** The backend directly queries `clients`, `orders`, `client_kyc` tables. Schema changes in the CRM break the marketing service silently. **Recommendation:** Create a CRM client interface or replicate needed data via events.
- **Frontend tightly coupled to backend response shapes:** No adapter layer — API responses are passed directly to components. Any backend change breaks the UI.

### 6.5 Recommended Boundary/Responsibility Split

**Current split is fundamentally correct** — the frontend handles presentation and the backend handles all business logic, data access, and external integrations. This is the right boundary.

**Improvements to the split:**

1. **Move analytics aggregation to a separate service or background job.** Currently, every analytics page request triggers real-time queries against Tracardi and PostgreSQL. Pre-compute analytics into materialized views or a separate analytics store (e.g., ClickHouse) on a schedule.

2. **Extract channel dispatching into a dedicated worker service.** The current monolith handles both HTTP requests and message dispatching in the same process. Under load, slow channel API calls (WhatsApp, FCM) could block HTTP request handling. A separate worker consuming from NATS would isolate these concerns.

3. **Add a shared `@duegate/marketing-types` package.** Publish TypeScript types as an npm package generated from the OpenAPI spec. Both frontend and any future services consume the same types.

4. **Move CRM data access behind an API boundary.** Instead of direct SQL queries against `clients`/`orders`, call the CRM service's API or subscribe to CRM events. This decouples the marketing service from the CRM schema.

---

## EXECUTIVE SUMMARY

**For non-technical stakeholders — 10 key takeaways:**

1. **The system is functional and well-architected.** A production-quality marketing automation engine exists with multi-channel delivery (email, SMS, WhatsApp, push), campaign workflows with branching and A/B testing, real-time analytics, and a polished admin dashboard.

2. **Critical security defaults must be fixed before production.** The system starts with publicly-known secrets and a default admin password of "admin". This is the #1 priority fix — estimated 3 hours.

3. **The Integrations page is completely broken.** The frontend has a full Integrations management UI, but the backend API endpoints don't exist. Users see 404 errors. Fix or remove — estimated 1-8 hours.

4. **There are zero frontend tests and minimal backend tests.** The most critical code (campaign execution engine, all 60+ API endpoints) has no test coverage. This means any code change could introduce regressions undetected. Estimated 40+ hours to reach adequate coverage.

5. **Database performance will degrade at scale.** Several dashboard and analytics queries use N+1 patterns (100+ queries per page load). These are straightforward SQL optimizations — estimated 8 hours total.

6. **No continuous deployment pipeline exists.** CI builds and tests code but doesn't deploy it. Deployments are manual. Adding CD is estimated 8 hours.

7. **Type definitions are manually duplicated** between the Go backend and TypeScript frontend, with confirmed drift already. An OpenAPI specification would solve this — estimated 8 hours.

8. **The feature set is comprehensive for an MVP.** Campaign management, multi-channel delivery, audience segmentation, consent management, analytics, reporting, audit logging, and RBAC are all implemented and working.

9. **Key missing features for market competitiveness:** visual drag-and-drop workflow builder, dynamic audience segments, AI-generated copy, and campaign duplication. These represent the next wave of development.

10. **Estimated total effort for critical + high-priority fixes: ~60 hours (Sprints 1-2).** This brings the system to production-ready quality. An additional ~60 hours (Sprints 3-4) addresses tech debt and feature gaps.
