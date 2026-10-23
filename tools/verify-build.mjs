/**
 * Asserts that every client package produced a loadable DSH bundle.
 * Cheap invariants only: presence, loader header, id match, sync-require allowlist.
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { PLATFORM_MODULES } from './build-client.mjs'

const root = path.resolve(fileURLToPath(import.meta.url), '../..')
const packagesDir = path.join(root, 'packages')

const problems = []
const checked = []

const entries = await readdir(packagesDir, { withFileTypes: true })
for (const entry of entries) {
  if (!entry.isDirectory()) continue
  const pkgDir = path.join(packagesDir, entry.name)
  let pkg
  try {
    pkg = JSON.parse(await readFile(path.join(pkgDir, 'package.json'), 'utf8'))
  } catch {
    problems.push(`${entry.name}: package.json missing or invalid`)
    continue
  }
  if (!pkg.dsh?.client) continue

  const label = pkg.name
  const outfile = path.join(pkgDir, 'lib/client.js')
  let code
  try {
    code = await readFile(outfile, 'utf8')
  } catch {
    problems.push(`${label}: lib/client.js not built`)
    continue
  }

  const head = 'window.__ModuleLoader__.load({'
  if (!code.startsWith(head)) problems.push(`${label}: bundle does not start with the module-loader header`)
  // Ported reference bundles use single quotes and two-space indentation; ours
  // use JSON-style strings — accept either spelling of the same declaration.
  const idPattern = new RegExp(`\\bid:\\s*(["'])${pkg.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1`)
  if (!idPattern.test(code)) problems.push(`${label}: bundle id does not match package name`)
  if (!code.trimEnd().endsWith('});')) problems.push(`${label}: bundle does not end with the loader terminator`)

  const allowed = new Set([...PLATFORM_MODULES, ...(pkg.dsh.client.external ?? []), 'react/jsx-dev-runtime'])
  for (const match of code.matchAll(/\brequire\(\s*(["'])([^"']+)\1\s*\)/g)) {
    const spec = match[2]
    if (spec.startsWith('.') || spec.startsWith('/')) {
      problems.push(`${label}: relative sync require("${spec}") is not allowed in a client bundle`)
      continue
    }
    if (!allowed.has(spec)) problems.push(`${label}: require("${spec}") is outside the platform module table`)
  }

  checked.push(label)
}

for (const label of checked) console.log(`ok ${label}`)
if (problems.length > 0) {
  for (const problem of problems) console.error(`FAIL ${problem}`)
  process.exitCode = 1
} else {
  console.log(`verified ${checked.length} client bundle(s)`)
}
