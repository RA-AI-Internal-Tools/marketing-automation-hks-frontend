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
| _(missing)_  | `/api/integrations`       | `/api/production/integrations`       |
| any          | `/api/sandbox/foo`        | `/api/sandbox/foo` _(idempotent)_    |
| any          | `/api/sse`                | `/api/sse` _(bypass — see below)_    |
| any          | `https://other.com/x`     | _(untouched — only `/api/*` rewrites)_ |

The store of record is the existing `useEnvironmentStore` (Pinia, at
`src/stores/environment.ts`). The interceptor reads `localStorage` directly
rather than the store because axios interceptors aren't reactive, and the
store already persists every mutation back to `localStorage` under the key
`STORAGE_KEYS.ENVIRONMENT` (`ma_environment`). This means call sites that
import `api` from `@/api/client` don't need to import the store.

## Default = production, not sandbox

If nothing is stored (first load, cleared storage, private window) the
interceptor sends `production`. Defaulting to sandbox would silently
downgrade real customers' writes into sandbox data on any storage hiccup.
The env-toggle UI is the only supported way to opt into sandbox.

> **Note:** The Pinia store itself defaults the in-memory `mode` to
> `sandbox` on cold boot so the toggle UI shows the safer side highlighted.
> The axios interceptor's `production` fallback only triggers when the store
> hasn't yet persisted a value at all (very first paint, before any toggle
> interaction). In practice the two defaults converge as soon as the user
> sees the toggle.

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
