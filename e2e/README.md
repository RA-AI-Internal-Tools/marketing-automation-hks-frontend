# E2E tests (Playwright)

End-to-end suite for the MA frontend. Runs against a **deployed** instance —
there's no dev-server bootstrap in `playwright.config.ts`, so point
`E2E_BASE_URL` at a live target (staging / prod / local `vite dev`).

All specs auto-skip when `E2E_EMAIL` / `E2E_PASSWORD` are absent so CI jobs
without secrets stay green.

## Running

```bash
E2E_BASE_URL=https://ma.internal.hksglobal.group \
E2E_EMAIL=you@example.com \
E2E_PASSWORD=... \
npm run test:e2e
```

Interactive debug UI:

```bash
E2E_BASE_URL=... E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e:ui
```

If browsers are missing, run `npx playwright install chromium` once.

## Specs

| Spec | Coverage |
| --- | --- |
| `auth.spec.ts` | Valid login lands authenticated; wrong password keeps user on `/login` with an error; unauthenticated `/overview` visit redirects to `/login`. |
| `smoke.spec.ts` | End-to-end happy path: login → campaigns list → create a campaign → analytics executive page renders. |

## Helpers

- `helpers/login.ts` — `login(page)` shared by every spec that needs an
  authenticated session. Update the selectors here, not per-spec, when the
  login UI changes. Also exports `hasE2ECreds()` for the skip gate.

## Adding a new spec

1. Create `e2e/<feature>.spec.ts`.
2. Import `{ test, expect }` from `@playwright/test`.
3. If the scenario needs an authenticated session:
   ```ts
   import { hasE2ECreds, login } from './helpers/login'

   test.beforeEach(async ({ page }) => {
     test.skip(!hasE2ECreds(), 'E2E_EMAIL / E2E_PASSWORD not set')
     await login(page)
   })
   ```
4. Use **relative paths** in `page.goto('/foo')` — Playwright resolves them
   against `baseURL`. Never hardcode hostnames.
5. Prefer role/label selectors (`getByRole`, `getByLabel`) over CSS/XPath.
