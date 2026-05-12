# Dual-environment API routing

The Marketing Automation backend runs as **two separate Go processes** on the
production host — one pinned to `MA_ENVIRONMENT=sandbox`, one to
`MA_ENVIRONMENT=production`. The SPA targets each via a path prefix; the host
nginx strips the prefix and forwards to the right container.

```
SPA ──► /api/sandbox/integrations  ──► host nginx ──► 127.0.0.1:8081 (api-sandbox)
SPA ──► /api/production/integrations ──► host nginx ──► 127.0.0.1:8082 (api-production)
```

Both backends share the same Postgres and the same `MA_CRED_MASTER_KEY`, but
each process is structurally incapable of writing to the other env's rows
because `enforceEnvScope` (in `internal/middleware`) rejects any request whose
header env disagrees with `MA_ENVIRONMENT`. A bad sandbox deploy therefore
cannot corrupt production data — the rails are at the process boundary, not
just in convention.

## How the rewrite works

`src/api/client.ts` installs an axios request interceptor that rewrites the
outgoing URL based on `localStorage['ma_environment']`:

| Stored value | Incoming URL              | Outgoing URL                         |
| ------------ | ------------------------- | ------------------------------------ |
| `sandbox`    | `/api/integrations`       | `/api/sandbox/integrations`          |
| `production` | `/api/integrations`       | `/api/production/integrations`       |
| _(missing)_  | `/api/integrations`       | `/api/sandbox/integrations`          |
| any          | `/api/sandbox/foo`        | `/api/sandbox/foo` _(idempotent)_    |
| any          | `/api/sse`                | `/api/sse` _(bypass — see below)_    |
| any          | `https://other.com/x`     | _(untouched — only `/api/*` rewrites)_ |

The store of record is the existing `useEnvironmentStore` (Pinia, at
`src/stores/environment.ts`). The interceptor reads `localStorage` directly
rather than the store because axios interceptors aren't reactive, and the
store already persists every mutation back to `localStorage` under the key
`STORAGE_KEYS.ENVIRONMENT` (`ma_environment`). This means call sites that
import `api` from `@/api/client` don't need to import the store.

## Default = sandbox (explicit click required to enter production)

If nothing is stored (first load, cleared storage, private window) the
interceptor sends `sandbox`. This aligns with the Pinia store's cold-boot
default (`src/stores/environment.ts`), so a user with empty/cleared
localStorage cannot have a write silently hit production before they have
deliberately clicked the env-toggle into production. Entering production
is an explicit user action, not a silent fallback.

> **Note:** Both the Pinia store's in-memory `mode` and the axios
> interceptor's localStorage-empty fallback default to `sandbox`. The two
> defaults stay aligned; there is no "very first paint" window where the
> store reads sandbox while the interceptor sends production.

## Bypasses

Two path patterns skip rewriting:

1. **`/api/sse`** — a single server-sent-events stream. The host nginx
   currently routes it to the sandbox backend for compatibility. Splitting it
   per env is a separate change that needs the SSE client to also become
   env-aware.
2. **Anything already prefixed with `/api/sandbox/` or `/api/production/`** —
   so call sites can opt out and explicitly target an env if needed
   (e.g. an admin tool that audits both envs from one screen).

## Header still emitted (for now)

The interceptor still attaches `X-Environment: <env>` on every request. The
backend uses it for audit-log breadcrumbs even though the URL is now the
load-bearing routing signal. Once the legacy `/api/*` (without env prefix)
returns 410 in production and we've confirmed no stale clients are calling
it, the header can be dropped.

## Local development

`vite.config.ts` proxies `/api/*` to `http://localhost:8080` — that proxy
will faithfully forward the rewritten `/api/sandbox/...` and
`/api/production/...` paths. Local backends don't currently understand the
env prefix; the simplest local workaround is to run a single backend and
add a quick nginx (or vite plugin) shim that strips the prefix. Optional —
most contributors won't hit this because the toggle defaults sit fine
locally without dual processes.
