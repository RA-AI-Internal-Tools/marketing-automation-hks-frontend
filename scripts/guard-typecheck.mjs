#!/usr/bin/env node
/**
 * Guard: keep the type-check from silently checking nothing.
 *
 * This repo's root tsconfig.json is solution-style (`"files": []` +
 * `references`). That layout has a specific, proven failure mode: it matches
 * ZERO input files on its own, so `vue-tsc --noEmit` (or `tsc --noEmit`)
 * exits 0 in under a second no matter how broken the code is. Only
 * `--build`, which follows `references`, checks anything. A second, quieter
 * variant of the same failure: a source file that belongs to no referenced
 * project at all is walked by nothing even under `--build` — that is exactly
 * how all 38 spec files went unchecked until tsconfig.vitest.json existed.
 *
 * Both failures are invisible: they produce a green result, not an error.
 * So they need a check of their own.
 *
 * ARM A — no `--noEmit` type-check invocation that walks zero files, in
 *         package.json scripts or .github/workflows/*.yml.
 *
 *         This arm originally exempted any command carrying an explicit
 *         `-p`/`--project`, on the assumption that naming a project means
 *         naming something that walks files. That assumption is false here and
 *         was proven false: `vue-tsc --noEmit -p tsconfig.json` names the ROOT
 *         config, which is the solution-style one, so it is exactly as vacuous
 *         as the bare form — exit 0, no output, against a file with a planted
 *         type error. An exemption that hands a green result to the precise
 *         command this guard exists to forbid is worse than no exemption.
 *
 *         So the exemption is now earned, not assumed: a `-p <project>` is
 *         accepted only if that project actually walks at least one file,
 *         measured the same way Arm B measures — by running
 *         `vue-tsc -p <project> --listFilesOnly` and counting. Consistent with
 *         this file's own rule: ask what a config DOES, never what its globs
 *         look like.
 *
 * ARM B — every source file on disk that should be type-checked is claimed
 *         by at least one project referenced from the root tsconfig.json.
 *         Proven by asking each project which files it actually walks
 *         (`vue-tsc -p <project> --listFilesOnly`) rather than by re-reading
 *         the include/exclude globs, so a glob that looks right but matches
 *         nothing is still caught.
 *
 * Exit 0 = both arms pass. Exit 1 = a violation, named on stderr.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const problems = []

// ── Arm A: no project-less `--noEmit` type-check ────────────────────────────

/** @returns {string[]} human-readable "location :: command" strings */
function collectCommandStrings() {
  const found = []

  const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
  for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
    found.push([`package.json :: scripts.${name}`, String(cmd)])
  }

  const workflowDir = path.join(repoRoot, '.github', 'workflows')
  if (existsSync(workflowDir)) {
    for (const file of readdirSync(workflowDir)) {
      if (!/\.ya?ml$/.test(file)) continue
      // Whole-file scan rather than a YAML parse: this only needs to find a
      // command line, and a scan cannot be defeated by an unusual `run:`
      // block style (folded, literal, multi-line) the way a naive parse can.
      const text = readFileSync(path.join(workflowDir, file), 'utf8')
      text.split('\n').forEach((line, i) => {
        found.push([`.github/workflows/${file}:${i + 1}`, line])
      })
    }
  }

  return found
}

/**
 * Arm A proper. Deferred until Arm B has measured how many files each project
 * actually walks, so that a `-p <project>` exemption can be granted on evidence
 * instead of on the mere presence of the flag.
 *
 * @param {Map<string, number>} walkedBy absolute project path -> files walked
 */
function checkNoEmitInvocations(walkedBy) {
  for (const [where, cmd] of collectCommandStrings()) {
    // Comment lines in the workflows discuss `--noEmit` on purpose (they
    // document this very trap). Only real command lines count.
    if (/^\s*#/.test(cmd)) continue
    if (!/\b(vue-)?tsc\b/.test(cmd)) continue
    if (!/--no-?emit\b/i.test(cmd)) continue

    const named = /(?:^|\s)(?:-p|--project)(?:\s+|=)(['"]?)([^\s'"]+)\1/.exec(cmd)
    if (!named) {
      problems.push(
        `${where}\n    ${cmd.trim()}\n` +
          `    ^ project-less --noEmit against a solution-style root tsconfig.json ` +
          `matches zero files and exits 0 unconditionally. Use \`vue-tsc --build\`.`,
      )
      continue
    }

    const proj = named[2]
    const resolved = path.resolve(repoRoot, proj)
    const walked = walkedBy.get(resolved)
    if (walked > 0) continue // exemption earned: this project really does check code

    const why =
      resolved === path.resolve(repoRoot, 'tsconfig.json')
        ? `names the solution-style ROOT config, which has "files": [] and therefore ` +
          `walks zero files by construction — this is the single most misleading form, ` +
          `because it looks explicit while checking exactly as little as the bare command`
        : walked === 0
          ? `names a project that walks 0 files`
          : `names a project that is not referenced from tsconfig.json, so nothing here ` +
            `measured what it walks and the exemption cannot be granted on evidence`

    problems.push(
      `${where}\n    ${cmd.trim()}\n` +
        `    ^ --noEmit -p ${proj} ${why}. It therefore exits 0 no matter how broken ` +
        `the code is. Use \`vue-tsc --build\`, or name a referenced project that walks files.`,
    )
  }
}

// ── Arm B: no source file orphaned from every referenced project ────────────

const rootTsconfigText = readFileSync(path.join(repoRoot, 'tsconfig.json'), 'utf8')
// tsconfig.json permits comments; strip line comments before parsing.
const rootTsconfig = JSON.parse(rootTsconfigText.replace(/^\s*\/\/.*$/gm, ''))
const references = (rootTsconfig.references ?? []).map((r) => r.path)

if (references.length === 0) {
  problems.push('tsconfig.json has no "references" — nothing would be type-checked by --build.')
}

const covered = new Set()
/** absolute project path -> number of non-node_modules files it walks (Arm A reads this) */
const walkedBy = new Map()
for (const ref of references) {
  let out = ''
  try {
    out = execFileSync(
      process.execPath,
      [path.join(repoRoot, 'node_modules', 'vue-tsc', 'bin', 'vue-tsc.js'), '-p', ref, '--listFilesOnly'],
      { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    )
  } catch (err) {
    // --listFilesOnly still prints the list on a non-zero exit; use what we got.
    out = String(err.stdout ?? '')
    if (!out) {
      problems.push(`could not list files for ${ref}: ${err.message}`)
      continue
    }
  }
  let walked = 0
  for (const line of out.split('\n')) {
    const file = line.trim()
    if (!file || file.includes('node_modules')) continue
    walked += 1
    covered.add(path.relative(repoRoot, path.resolve(repoRoot, file)))
  }
  walkedBy.set(path.resolve(repoRoot, ref), walked)
}

// Arm A runs here, not earlier: it needs walkedBy to tell a real project from a
// solution-style one that checks nothing.
checkNoEmitInvocations(walkedBy)

const tracked = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
  .split('\n')
  .map((f) => f.trim())
  .filter(Boolean)

// Files that MUST be type-checked by something. Deliberately explicit: a new
// top-level source directory is an orphan until it is added here AND given a
// project, which is the point.
const mustBeChecked = tracked.filter(
  (f) =>
    f === 'env.d.ts' ||
    /^src\/.*\.(ts|tsx|vue)$/.test(f) ||
    /^e2e\/.*\.ts$/.test(f) ||
    /^[^/]+\.config\.ts$/.test(f),
)

if (mustBeChecked.length === 0) {
  problems.push('found no source files to check — this guard is not looking at the right tree.')
}

const orphans = mustBeChecked.filter((f) => !covered.has(f))
if (orphans.length > 0) {
  problems.push(
    `${orphans.length} source file(s) belong to NO project referenced from tsconfig.json, ` +
      `so \`vue-tsc --build\` walks straight past them and they are type-checked by nothing:\n` +
      orphans.map((f) => `      ${f}`).join('\n'),
  )
}

// ── Report ─────────────────────────────────────────────────────────────────

if (problems.length > 0) {
  console.error('type-check guard FAILED:\n')
  for (const p of problems) console.error(`  - ${p}\n`)
  process.exit(1)
}

console.log(
  `type-check guard OK — ${references.length} referenced project(s) cover all ` +
    `${mustBeChecked.length} source files, and no project-less --noEmit invocation exists.`,
)
