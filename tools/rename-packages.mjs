/**
 * One-shot migration: renames the seven workspace packages to the
 * `dsh-fairy-next*` family so they can be published to npm (the unprefixed
 * name `dsh-balance-meter` already belongs to another author, and `dsh-fairy`
 * is taken as well).
 *
 * Only package *specifiers* are rewritten — CSS class names, the
 * `data-dsh-fairy-*` DOM contract and the `/dsh-fairy/*` host routes keep
 * their existing spelling, because they are the visual contract the reference
 * theme and our tooling depend on.
 *
 *   node tools/rename-packages.mjs [--dry]
 */
import { readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..')
const dry = process.argv.includes('--dry')

/** old package name -> new package name */
const RENAMES = new Map([
  ['dsh-fairy', 'dsh-fairy-next'],
  ['dsh-fairy-visual', 'dsh-fairy-next-visual'],
  ['dsh-fairy-voice', 'dsh-fairy-next-voice'],
  ['dsh-fairy-startup', 'dsh-fairy-next-startup'],
  ['dsh-balance-meter', 'dsh-fairy-next-balance'],
  ['dsh-browser-dock', 'dsh-fairy-next-browser-dock'],
  ['dsh-fairy-contracts', 'dsh-fairy-next-contracts'],
])

const SKIP_DIR = new Set([
  '.git', 'node_modules', '.pnpm-store', '.dsh-dev-home', '.dsh-market-home',
  'dist', 'coverage', '.turbo',
])
const TEXT_EXT = /\.(m?js|cjs|json|yml|yaml|md|ts|html)$/

/** Files scanned for specifier rewrites (relative to the repo root). */
const ROOTS = ['packages', 'tools', 'docs', 'dev/profile/package.json', 'README.md', 'NOTICE', 'THIRD_PARTY_NOTICES.md']

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Files where a quoted `dsh-fairy` really is the anchor package name. */
const ANCHOR_FILES = new Set([
  join('packages', 'dsh-fairy', 'package.json'),
  join('packages', 'dsh-fairy', 'skin.json'),
  join('dev', 'profile', 'package.json'),
])

let currentFile = ''

/**
 * Rewrites a single file's text. Three shapes are safe to touch:
 *   1. `dsh-fairy-contracts/...` — always a module specifier.
 *   2. `'name'` / `"name"`       — a package name used as a value.
 *   3. `packages/name`           — a path inside this repo.
 */
function rewrite(text) {
  let next = text
  const notes = []

  if (next.includes('dsh-fairy-contracts')) {
    next = next.split('dsh-fairy-contracts').join('dsh-fairy-next-contracts')
    notes.push('contracts-specifier')
  }

  for (const [from, to] of RENAMES) {
    // `dsh-fairy-contracts` is always a module specifier, and the bare anchor
    // name `dsh-fairy` is handled explicitly below — a quoted `'dsh-fairy'`
    // also shows up as a CSS class prefix (`.dsh-fairy-toggle`), which must
    // keep its spelling.
    if (from === 'dsh-fairy-contracts' || from === 'dsh-fairy') {
      if (from === 'dsh-fairy') {
        const anchorPath = new RegExp(`packages/${escape(from)}(?![\\w-])`, 'g')
        if (anchorPath.test(next)) {
          next = next.replace(anchorPath, `packages/${to}`)
          notes.push(`path:${from}`)
        }
      }
      continue
    }
    const quoted = new RegExp(`(['"])${escape(from)}\\1`, 'g')
    if (quoted.test(next)) {
      next = next.replace(quoted, (_m, q) => `${q}${to}${q}`)
      notes.push(`value:${from}`)
    }
    const pathRef = new RegExp(`packages/${escape(from)}(?![\\w-])`, 'g')
    if (pathRef.test(next)) {
      next = next.replace(pathRef, `packages/${to}`)
      notes.push(`path:${from}`)
    }
  }

  if (ANCHOR_FILES.has(currentFile)) {
    const anchor = /(['"])dsh-fairy\1/g
    if (anchor.test(next)) {
      next = next.replace(anchor, (_m, q) => `${q}dsh-fairy-next${q}`)
      notes.push('value:dsh-fairy')
    }
  }

  return { next, notes }
}

const changed = []

async function walk(entry) {
  const abs = join(repo, entry)
  if (!existsSync(abs)) return
  const info = await stat(abs)
  if (info.isFile()) {
    if (!TEXT_EXT.test(abs)) return
    if (relative(repo, abs) === join('tools', 'rename-packages.mjs')) return
    const text = await readFile(abs, 'utf8')
    currentFile = relative(repo, abs)
    const { next, notes } = rewrite(text)
    if (next !== text) {
      changed.push({ file: currentFile, notes })
      if (!dry) await writeFile(abs, next, 'utf8')
    }
    return
  }
  for (const child of await readdir(abs)) {
    if (SKIP_DIR.has(child)) continue
    await walk(join(entry, child))
  }
}

/** Directory renames have to happen last: the walk above uses the old paths. */
async function renameDirectories() {
  for (const [from, to] of RENAMES) {
    const src = join(repo, 'packages', from)
    const dst = join(repo, 'packages', to)
    if (!existsSync(src)) continue
    if (existsSync(dst)) throw new Error(`refusing to overwrite ${dst}`)
    if (dry) {
      console.log(`would rename packages/${from} -> packages/${to}`)
    } else {
      await rename(src, dst)
      console.log(`renamed packages/${from} -> packages/${to}`)
    }
  }
}

for (const entry of ROOTS) await walk(entry)

console.log(`\n${changed.length} file(s) rewritten${dry ? ' (dry run)' : ''}:`)
for (const item of changed) console.log(`  ${item.file}  [${[...new Set(item.notes)].join(', ')}]`)

await renameDirectories()
