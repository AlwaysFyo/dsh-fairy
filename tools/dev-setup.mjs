/**
 * Prepares the isolated probe environment:
 *   .dsh-dev-home/                     <- DSH_HOME (throwaway, gitignored)
 *   .dsh-dev-home/profiles/fairy-dev   <- junction to ./dev/profile
 *
 * Mirror of the reference repo's test-isolated.sh trick: the profile stays in the
 * repository while the CLI sees it at the location it expects.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(import.meta.url), '../..')
const home = path.join(root, '.dsh-dev-home')
const profileSource = path.join(root, 'dev', 'profile')
const profileLink = path.join(home, 'profiles', 'fairy-dev')

await mkdir(path.join(home, 'profiles'), { recursive: true })

if (existsSync(profileLink)) {
  const stats = await import('node:fs/promises').then((fs) => fs.lstat(profileLink))
  if (!stats.isSymbolicLink() && !stats.isDirectory()) throw new Error(`${profileLink} is not a directory`)
  await rm(profileLink, { recursive: false, force: true })
  console.log(`removed stale ${profileLink}`)
}

execFileSync('cmd', ['/c', 'mklink', '/J', profileLink, profileSource], { stdio: 'inherit' })

const homeConfig = path.join(home, 'config.yml')
if (!existsSync(homeConfig)) {
  await writeFile(homeConfig, '# isolated probe home: intentionally empty\n', 'utf8')
}

console.log(`DSH_HOME=${home}`)
console.log(`profile=${profileLink} -> ${profileSource}`)
console.log('next: pnpm install --ignore-workspace (in dev/profile), then pnpm probe:web')
