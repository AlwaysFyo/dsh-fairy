/**
 * Ports the remaining four Fairy plugins from the reference checkout.
 *
 * The reference ships prebuilt `lib/client.js` bundles already in the
 * `window.__ModuleLoader__.load({ id, factory })` shape that 0.2.1 consumes, so
 * these packages are copied as artifacts instead of being rebuilt: their only
 * runtime requests are `react`, `react/jsx-runtime`,
 * `@deepseek-ai/dsh-client-ui-primitives` and node builtins, all of which the
 * host already provides.
 *
 *   node tools/port-packages.mjs <referenceRoot>
 */
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const referenceRoot = resolve(process.argv[2] ?? 'D:\\Projects\\Fairy-DSH')

/** Reference directory -> ported package shape. */
const PACKAGES = [
  {
    dir: 'fairy-startup/dsh-fairy-startup',
    name: 'dsh-fairy-next-startup',
    version: '1.0.0',
    description: 'Fairy startup: every new document lands on a fresh session instead of restoring the previous one.',
    inject: [
      '@deepseek-ai/dsh-client-connection',
      '@deepseek-ai/dsh-client-ui-slots',
      '@deepseek-ai/dsh-client-ui-conversation',
      '@deepseek-ai/dsh-client-ui-workspace',
    ],
    extraDependencies: {},
    copy: ['lib', 'test', 'README.md'],
  },
  {
    dir: 'balance-meter/dsh-balance-meter',
    name: 'dsh-fairy-next-balance',
    version: '0.2.0',
    description: 'DeepSeek balance card plus local daily token/cost estimate, rendered in the sidebar footer.',
    inject: [
      '@deepseek-ai/dsh-client-connection',
      '@deepseek-ai/dsh-client-locale',
      '@deepseek-ai/dsh-client-ui-slots',
      '@deepseek-ai/dsh-client-ui-sidebar',
    ],
    extraDependencies: {},
    copy: ['lib', 'test', 'README.md'],
  },
  {
    dir: 'fairy-voice/dsh-fairy-voice',
    name: 'dsh-fairy-next-voice',
    version: '1.0.0',
    description: 'Fairy voice: local TTS playback for assistant replies through an external local TTS runtime.',
    inject: [
      '@deepseek-ai/dsh-client-connection',
      '@deepseek-ai/dsh-client-ui-slots',
      '@deepseek-ai/dsh-client-ui-settings',
      '@deepseek-ai/dsh-client-ui-conversation',
      '@deepseek-ai/dsh-client-ui-primitives',
    ],
    extraDependencies: {
      'mdast-util-from-markdown': '2.0.3',
      'mdast-util-gfm': '3.1.0',
      'micromark-extension-gfm': '3.0.0',
    },
    copy: ['lib', 'test'],
  },
  {
    dir: 'browser-dock/dsh-browser-dock',
    name: 'dsh-fairy-next-browser-dock',
    version: '0.1.0',
    description: 'Browser dock: an in-app browser surface plus the Playwright proxy it drives.',
    inject: [
      '@deepseek-ai/dsh-client-connection',
      '@deepseek-ai/dsh-client-ui-slots',
      '@deepseek-ai/dsh-client-ui-layout',
    ],
    extraDependencies: {},
    copy: ['lib', 'src', 'test', 'proxy.cjs'],
  },
]

const manifestFor = (spec) => ({
  name: spec.name,
  version: spec.version,
  private: true,
  description: spec.description,
  type: 'module',
  main: './lib/index.js',
  exports: {
    '.': './lib/index.js',
    './client': './lib/client.js',
    './package.json': './package.json',
  },
  dsh: {
    client: {
      platform: 'web',
      inject: spec.inject,
    },
  },
  dependencies: {
    'dsh-fairy-next-contracts': 'link:../dsh-fairy-next-contracts',
    ...spec.extraDependencies,
  },
  peerDependencies: {
    '@deepseek-ai/cordis': '~4.0.5',
  },
  engines: {
    node: '>=22.12.0',
  },
  files: ['lib'],
  license: 'Apache-2.0',
})

const report = []
for (const spec of PACKAGES) {
  const from = join(referenceRoot, spec.dir)
  const to = join(repoRoot, 'packages', spec.name)
  if (!existsSync(from)) throw new Error(`missing reference package: ${from}`)
  await mkdir(to, { recursive: true })
  for (const entry of spec.copy) {
    const source = join(from, entry)
    if (!existsSync(source)) continue
    await cp(source, join(to, entry), { recursive: true, force: true })
  }
  await writeFile(join(to, 'package.json'), `${JSON.stringify(manifestFor(spec), null, 2)}\n`, 'utf8')
  const client = join(to, 'lib', 'client.js')
  const bundle = existsSync(client) ? await readFile(client, 'utf8') : ''
  report.push({
    package: spec.name,
    client: bundle.length,
    header: bundle.slice(0, 40).replace(/\s+/g, ' '),
    hostIndex: existsSync(join(to, 'lib', 'index.js')),
  })
}

console.log(JSON.stringify(report, null, 2))
