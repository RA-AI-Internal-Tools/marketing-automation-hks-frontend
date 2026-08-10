/**
 * DTO field drift: fields the API serves that the UI does not type.
 *
 * WHY THIS EXISTS
 * ---------------
 * `src/api/types.ts` is hand-written. `npm run generate-types` produces a
 * DIFFERENT file — `src/api/generated-types.ts` — which was last written on
 * 13 April and is imported by nothing. So the generated contract is dead and
 * the live one is maintained by hand, which means the backend can add a field
 * and the frontend simply never learns about it. Nothing fails. The data
 * arrives on the wire and is dropped at the type boundary.
 *
 * That is not hypothetical. `gate_unavailable` was added to the backend so an
 * infrastructure failure would stop being recorded as a business outcome, and
 * it was served from THREE structs — ChannelStats, CampaignPerformance and
 * DailyVolume — while the frontend typed none of them. It stayed invisible
 * until someone read the Go source by hand (issue #20).
 *
 * WHAT THIS ASSERTS, AND WHAT IT DELIBERATELY DOES NOT
 * ----------------------------------------------------
 * Only one direction: every json tag on a Go struct whose name matches a TS
 * interface must appear as a field on that interface. That is the direction
 * with teeth — a served-but-untyped field is silently discarded data.
 *
 * The reverse (typed but not served) is NOT asserted, on purpose. The Go
 * store structs are not the only response shape: handlers compose and rename,
 * some interfaces here describe request bodies or client-only view models,
 * and several legitimately have no Go counterpart. Asserting that direction
 * would produce a wall of false failures, and this guard would be deleted or
 * muted within a week — which is worse than not having it.
 *
 * Matching is by struct/interface NAME. That is a real limitation, and it is
 * why the non-vacuity floors below matter: if the naming convention ever
 * diverges the intersection empties out, and this file would pass while
 * checking nothing. It fails instead.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  FRONTEND_ROOT,
  backendCandidates,
  SKIP_BACKEND_SYNC,
  warnBackendSyncDisabled,
} from './backendRepo'

if (SKIP_BACKEND_SYNC) {
  warnBackendSyncDisabled('dtoDrift', 'served-field <-> src/api/types.ts')
}

/** Every `.go` file under a directory, recursively, excluding tests. */
function goFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry)
    if (statSync(p).isDirectory()) out.push(...goFiles(p))
    else if (entry.endsWith('.go') && !entry.endsWith('_test.go')) out.push(p)
  }
  return out
}

/** struct name -> set of json tag names (excluding `-`). */
function parseGoStructs(files: string[]): Map<string, Set<string>> {
  const structs = new Map<string, Set<string>>()
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/type\s+(\w+)\s+struct\s*\{([\s\S]*?)\n\}/g)) {
      const name = m[1]
      const body = m[2]
      if (!name || !body) continue
      const tags = new Set<string>()
      for (const t of body.matchAll(/json:"([^",]+)/g)) {
        const tag = t[1]
        // `json:"-"` means "never serialise me" — the opposite of a field
        // the UI is missing. Counting it would invent a permanent failure.
        if (tag && tag !== '-') tags.add(tag)
      }
      if (tags.size) {
        const existing = structs.get(name)
        if (existing) for (const t of tags) existing.add(t)
        else structs.set(name, tags)
      }
    }
  }
  return structs
}

/** interface name -> set of property names. */
function parseTsInterfaces(src: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const m of src.matchAll(/export interface (\w+)\s*\{([\s\S]*?)\n\}/g)) {
    const name = m[1]
    const rawBody = m[2]
    if (!name || !rawBody) continue
    // Strip line comments first: several fields here carry `// foo: bar`
    // prose that would otherwise parse as a property named `foo`.
    const body = rawBody.replace(/\/\/[^\n]*/g, '')
    const props = new Set<string>()
    for (const p of body.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\??\s*:/gm)) {
      if (p[1]) props.add(p[1])
    }
    out.set(name, props)
  }
  return out
}

const STORE_DIRS = backendCandidates('internal', 'store')

describe('API DTO drift', () => {
  const name = SKIP_BACKEND_SYNC
    ? 'DISABLED by MA_SKIP_BACKEND_SYNC=1 — served fields are NOT checked against src/api/types.ts'
    : 'every field the backend store structs serve is typed in src/api/types.ts'

  it.skipIf(SKIP_BACKEND_SYNC)(name, () => {
    const dir = STORE_DIRS.find((p) => existsSync(p))
    expect(
      dir,
      'backend internal/store not found. Searched:\n  ' +
        STORE_DIRS.join('\n  ') +
        '\nSet MA_BACKEND_REPO, or MA_SKIP_BACKEND_SYNC=1 to disable this guard ' +
        'deliberately. It is not skipped automatically: a guard that vanishes ' +
        'when its input is missing is the defect it exists to catch.',
    ).toBeTruthy()

    const files = goFiles(dir as string)
    expect(
      files.length,
      `no non-test .go files under ${dir} — this guard is reading nothing`,
    ).toBeGreaterThan(0)

    const go = parseGoStructs(files)
    const ts = parseTsInterfaces(
      readFileSync(path.join(FRONTEND_ROOT, 'src', 'api', 'types.ts'), 'utf8'),
    )

    // Non-vacuity, three ways. Each has a real failure mode behind it: a
    // changed struct syntax, a changed interface syntax, or a naming split
    // that empties the intersection. Any one of them would let the
    // comparison below pass while comparing nothing.
    expect(go.size, 'parsed no Go structs with json tags — the parser broke').toBeGreaterThan(5)
    expect(ts.size, 'parsed no TS interfaces from types.ts — the parser broke').toBeGreaterThan(5)

    const shared = [...go.keys()].filter((n) => ts.has(n)).sort()

    // NAME THE PAIRS, do not just count them.
    //
    // Matching is by name, so this guard only covers structs that share a name
    // with an interface: 6 of the 22 Go structs parsed today. A bare
    // `toBeGreaterThan(3)` accepts that falling to 4 — a third of the coverage
    // gone, silently, still green. Renaming a struct on either side is exactly
    // how that happens, and it is invisible in a count.
    //
    // Adding a pair is free. Losing one now fails and says which. If a struct
    // is deliberately retired or renamed, edit this list in the same commit and
    // say why in the message.
    const EXPECTED_PAIRS = [
      'CampaignFunnelStats',
      'CampaignPerformance',
      'ChannelStats',
      'DailyVolume',
      'OverviewStats',
      'VariantPerformance',
    ]
    expect(
      EXPECTED_PAIRS.filter((n) => !shared.includes(n)),
      'these Go structs no longer pair with a same-named interface in ' +
        'types.ts, so their fields are no longer compared at all — the guard ' +
        'silently stopped covering them. Most likely one side was renamed. ' +
        'Either restore the name, or update EXPECTED_PAIRS deliberately.\n' +
        'Currently paired: ' +
        (shared.join(', ') || '(none)'),
    ).toEqual([])

    const drift: string[] = []
    for (const structName of shared) {
      const goFields = go.get(structName) as Set<string>
      const tsFields = ts.get(structName) as Set<string>
      const missing = [...goFields].filter((f) => !tsFields.has(f)).sort()
      if (missing.length) drift.push(`  ${structName}: ${missing.join(', ')}`)
    }

    expect(
      drift,
      'The backend serves these fields and src/api/types.ts does not declare ' +
        'them, so they arrive on the wire and are dropped:\n' +
        drift.join('\n') +
        '\n\nAdd them to the interface (REQUIRED, not optional, if the Go field ' +
        'has no omitempty — an optional renders undefined as a confident zero), ' +
        'and decide where they are shown. If a field is deliberately not ' +
        'rendered it still belongs on the type: DASHBOARD_UNRENDERED_STATUSES ' +
        'in src/constants/logStatus.ts is how this repo records that decision.',
    ).toEqual([])
  })
})
