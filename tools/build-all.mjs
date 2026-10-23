import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { buildClient } from './build-client.mjs'

const root = path.resolve(fileURLToPath(import.meta.url), '../..')
const packagesDir = path.join(root, 'packages')

const entries = await readdir(packagesDir, { withFileTypes: true })
const built = []
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
  built.push(await buildClient(pkgDir))
}

for (const item of built) {
  console.log(`built ${item.name} (${item.bytes} bytes)`)
}
if (built.length === 0) console.log('no client packages found')
void process
