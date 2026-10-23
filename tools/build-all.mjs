import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { buildClient } from './build-client.mjs'

const root = path.resolve(fileURLToPath(import.meta.url), '../..')
const packagesDir = path.join(root, 'packages')

const entries = await readdir(packagesDir, { withFileTypes: true })
const built = []
const skipped = []
for (const entry of entries) {
  if (!entry.isDirectory()) continue
  const pkgDir = path.join(packagesDir, entry.name)
  let pkg
  try {
    pkg = JSON.parse(await readFile(path.join(pkgDir, 'package.json'), 'utf8'))
  } catch {
    continue
  }
  if (!pkg.dsh?.client) continue
  // Packages ported as prebuilt artifacts have no source tree to bundle; their
  // `lib/client.js` is already in the module-loader shape (see port-packages.mjs).
  if (!existsSync(path.join(pkgDir, 'src', 'client'))) {
    skipped.push(entry.name)
    continue
  }
  built.push(await buildClient(pkgDir))
}

for (const name of skipped) {
  console.log(`kept prebuilt ${name}`)
}

for (const item of built) {
  console.log(`built ${item.name} (${item.bytes} bytes)`)
}
if (built.length === 0) console.log('no client packages found')
void process
