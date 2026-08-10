/**
 * Locating the backend checkout, for the specs that read it directly.
 *
 * NOT a spec — a helper shared by every guard that compares this repo
 * against `marketing-automation-hks`. It exists because there are now two
 * such guards (LOG_STATUSES vocabulary, and DTO field drift) and a second
 * hand-written copy of this resolution logic would be exactly the
 * duplicate-that-drifts problem those guards were written to catch.
 *
 * The backend being a sibling checkout is not an assumption invented for
 * tests: package.json's `generate-types` script already reads
 * `../marketing-automation-hks/docs/swagger.json`. MA_BACKEND_REPO
 * overrides the location for non-standard layouts.
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

/**
 * Walk up from cwd to the package.json that identifies THIS repo.
 *
 * Deliberately not derived from import.meta.url: under the vitest
 * transform that is not a file: URL and fileURLToPath throws. If the walk
 * fails it returns cwd, which simply makes the candidate paths not exist,
 * and the caller fails loudly listing what it searched. There is no path
 * through this function that lets a guard pass without reading the backend.
 */
function resolveFrontendRoot(): string {
  let dir = process.cwd()
  for (let i = 0; i < 8; i++) {
    const pkg = path.join(dir, 'package.json')
    if (existsSync(pkg)) {
      try {
        if (JSON.parse(readFileSync(pkg, 'utf8')).name === 'marketing-automation-hks-frontend') {
          return dir
        }
      } catch {
        // Unparseable package.json — keep walking.
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

export const FRONTEND_ROOT = resolveFrontendRoot()

/** Candidate absolute paths for `relPath` inside the backend checkout. */
export function backendCandidates(...relPath: string[]): string[] {
  return (
    process.env.MA_BACKEND_REPO
      ? [process.env.MA_BACKEND_REPO]
      : [
          path.resolve(FRONTEND_ROOT, '..', 'marketing-automation-hks'),
          path.resolve(FRONTEND_ROOT, '..', 'backend'),
        ]
  ).map((root) => path.join(root, ...relPath))
}

/**
 * Explicit, visible opt-out for environments without the backend checked
 * out. Deliberately NOT the default: a guard that quietly disappears when
 * its input is missing is the failure mode these guards exist to close, so
 * absent this flag a missing backend is a loud FAILURE, not a skip.
 */
export const SKIP_BACKEND_SYNC = process.env.MA_SKIP_BACKEND_SYNC === '1'

/**
 * Announce a disabled guard on stderr.
 *
 * process.stderr.write, not console.warn: vitest's default reporter does
 * not print module-scope console output to the terminal at all (verified —
 * under `vitest run` a bare console.warn at this scope never reaches
 * stdout/stderr). This is the one call guaranteed to reach a human or a CI
 * log when the flag is set.
 */
export function warnBackendSyncDisabled(specName: string, what: string): void {
  process.stderr.write(
    `[${specName}] MA_SKIP_BACKEND_SYNC=1 — the ${what} drift guard is DISABLED for this run.\n`,
  )
}
