/**
 * Prepares the seven workspace packages for `npm publish`: drops `private`,
 * fills in the repository/homepage fields, pins the public registry and copies
 * the workspace LICENSE into each package (npm always ships `LICENSE`, but only
 * from the package directory).
 *
 *   node tools/prepare-publish.mjs [--dry]
 */
import { copyFile, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..')
const dry = process.argv.includes('--dry')

const REPO_URL = 'https://github.com/AlwaysFyo/dsh-fairy'

const KEYWORDS = {
  'dsh-fairy-next': ['dsh', 'dsh-plugin', 'theme', 'fairy', 'zenless-zone-zero', 'hdd', 'skin'],
  'dsh-fairy-next-visual': ['dsh', 'dsh-plugin', 'theme', 'fairy', 'hdd', 'zenless-zone-zero'],
  'dsh-fairy-next-voice': ['dsh', 'dsh-plugin', 'tts', 'voice', 'gpt-sovits', 'index-tts'],
  'dsh-fairy-next-startup': ['dsh', 'dsh-plugin', 'session', 'startup'],
  'dsh-fairy-next-balance': ['dsh', 'dsh-plugin', 'balance', 'usage', 'sidebar'],
  'dsh-fairy-next-browser-dock': ['dsh', 'dsh-plugin', 'browser', 'playwright', 'dock'],
  'dsh-fairy-next-contracts': ['dsh', 'dsh-plugin', 'contracts', 'dom-anchors'],
}

const packages = (await readdir(join(repo, 'packages'), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

const license = join(repo, 'LICENSE')
if (!existsSync(license)) throw new Error(`missing workspace LICENSE: ${license}`)

for (const dir of packages) {
  const manifestPath = join(repo, 'packages', dir, 'package.json')
  if (!existsSync(manifestPath)) continue
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

  const next = { ...manifest }
  delete next.private
  next.author = 'AlwaysFyo'
  next.homepage = `${REPO_URL}#readme`
  next.repository = { type: 'git', url: `git+${REPO_URL}.git`, directory: `packages/${dir}` }
  next.bugs = { url: `${REPO_URL}/issues` }
  next.keywords = KEYWORDS[manifest.name] ?? ['dsh', 'dsh-plugin']
  next.publishConfig = { access: 'public', registry: 'https://registry.npmjs.org/' }

  // Keep a stable key order so the manifest diff stays readable.
  const ordered = {}
  for (const key of ['name', 'version', 'description', 'type', 'main', 'icon', 'exports', 'dsh', 'dependencies', 'peerDependencies', 'engines', 'files', 'keywords', 'author', 'license', 'homepage', 'repository', 'bugs', 'publishConfig']) {
    if (next[key] !== undefined) ordered[key] = next[key]
  }
  for (const [key, value] of Object.entries(next)) {
    if (!(key in ordered)) ordered[key] = value
  }

  const text = `${JSON.stringify(ordered, null, 2)}\n`
  console.log(`${dir}: ${manifest.name}@${manifest.version} -> publishes (${ordered.files?.join(', ') ?? 'no files field'})`)
  if (!dry) {
    await writeFile(manifestPath, text, 'utf8')
    const licenseTarget = join(repo, 'packages', dir, 'LICENSE')
    const info = await stat(license)
    if (info.isFile()) await copyFile(license, licenseTarget)
  }
}

console.log(`\n${packages.length} package(s) prepared${dry ? ' (dry run)' : ''}.`)
