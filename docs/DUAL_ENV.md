# Dual-environment API routing — RETIRED (2026-07-30)

**This document described a topology that no longer exists. Do not implement
anything on this page.**

## What it used to say

The backend ran as two Go processes — one pinned to `MA_ENVIRONMENT=sandbox`
(`127.0.0.1:8081`), one to `MA_ENVIRONMENT=production` (`127.0.0.1:8082`). The
host nginx routed `/api/sandbox/*` and `/api/production/*` to the matching
container after stripping the prefix, and an axios request interceptor in
`src/api/client.ts` rewrote every outgoing `/api/x` into `/api/{activeEnv}/x`
based on `localStorage['ma_environment']`.

## What is true now

The split was reversed on 2026-07-30. The live topology is:

```
SPA ──► /api/<anything> ──► host nginx ──► 127.0.0.1:8081 (single `api` container)
```

- There is **one** api container. `ENVIRONMENT=production` and
  `MA_ENVIRONMENT=production`.
- The host nginx serves **plain `/api/*`**. `/api/sandbox/*` and
  `/api/production/*` are **retired and return 404**.
- `src/api/client.ts` therefore has **no URL-rewriting interceptor**, and no
  longer sends the `X-Environment` header (the Go backend never read it — its
  only mention is the `Access-Control-Allow-Headers` list in
  `internal/middleware/cors.go`, and requests are same-origin so CORS never
  engages).
- `src/stores/environment.ts` cold-boots to `production` and migrates any
  stored `'sandbox'` value to `'production'` on load.
- Credential UIs (`IntegrationForm.vue`, `IntegrationsPage.vue`) default to
  `production` and disable the sandbox option, because `enforceEnvScope` in
  `internal/api/routes_integrations.go` rejects any cross-env credential read
  or write with a 400.

## The trap this file exists to warn about

Reintroducing the `/api/{env}/` rewrite against the current nginx **404s every
API call and takes the entire dashboard down**. Environment is a property of
the deployment (`MA_ENVIRONMENT` on the container), not of the request. If a
sandbox environment is ever wanted again, give it its own host, its own
hostname, and its own database — do not re-derive it from a URL prefix
generated in the browser.
