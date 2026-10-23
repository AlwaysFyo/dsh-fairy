/**
 * Builds a DSH client bundle: <pkg>/src/client/index.js -> <pkg>/lib/client.js
 *
 * The official 0.2.1 loader consumes classic scripts whose only job is to register
 * a lazy CommonJS factory:
 *
 *   window.__ModuleLoader__.load({ id, factory: (require) => { ...; return module.exports } })
 *
 * Only the platform module table may be required synchronously at runtime; every
 * other import is inlined here. Rollup is used instead of esbuild because it runs
 * fully in-process (no child process, so it also works under the Windows file
 * sandbox). See docs/official-api-notes.md.
 */
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { rollup } from 'rollup'

/** @deepseek-ai/dsh-client-web PLATFORM_MODULES (0.2.1-rc.2, frozen). */
export const PLATFORM_MODULES = Object.freeze([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  'zod',
  '@tanstack/react-virtual',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
])

const ENTRY = 'src/client/index.js'

export async function buildClient(pkgDir) {
  const pkg = JSON.parse(await readFile(path.join(pkgDir, 'package.json'), 'utf8'))
  const clientManifest = pkg.dsh?.client
  if (!clientManifest || typeof clientManifest !== 'object') {
    throw new Error(`${pkg.name}: package.json is missing "dsh.client"`)
  }

  const entry = path.join(pkgDir, ENTRY)
  const externals = [...new Set([...PLATFORM_MODULES, ...(clientManifest.external ?? [])])]
  const warnings = []

  const bundle = await rollup({
    input: entry,
    external: (id) => externals.includes(id),
    plugins: [
      nodeResolve({ browser: true, exportConditions: ['browser', 'import', 'default'], preferBuiltins: false }),
      commonjs({ transformMixedEsModules: true }),
    ],
    onwarn: (warning) => {
      if (warning.code === 'CIRCULAR_DEPENDENCY' || warning.code === 'THIS_IS_UNDEFINED') return
      warnings.push(`${warning.code}: ${warning.message}`)
    },
  })

  const { output } = await bundle.generate({
    format: 'cjs',
    exports: 'named',
    inlineDynamicImports: true,
    generatedCode: 'es2015',
    freeze: false,
  })
  await bundle.close()

  const code = output.filter((chunk) => chunk.type === 'chunk').map((chunk) => chunk.code).join('\n')
  const wrapped =
    'window.__ModuleLoader__.load({\n' +
    `\tid: ${JSON.stringify(pkg.name)},\n` +
    '\tfactory: (require) => {\n' +
    '\t\tvar module = { exports: {} };\n' +
    '\t\tvar exports = module.exports;\n' +
    `${code}\n` +
    '\t\treturn module.exports;\n' +
    '\t}\n' +
    '});\n'

  const outDir = path.join(pkgDir, 'lib')
  await mkdir(outDir, { recursive: true })
  const outfile = path.join(outDir, 'client.js')
  const tmp = path.join(outDir, 'client.tmp.js')
  await writeFile(tmp, wrapped, 'utf8')
  await rename(tmp, outfile)

  // Host half: plain ESM, copied verbatim (it is already valid Node ESM).
  let hostBytes = 0
  try {
    const hostSource = await readFile(path.join(pkgDir, 'src', 'index.js'), 'utf8')
    await writeFile(path.join(outDir, 'index.js'), hostSource, 'utf8')
    hostBytes = Buffer.byteLength(hostSource, 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }

  return { name: pkg.name, entry, outfile, bytes: Buffer.byteLength(wrapped, 'utf8'), hostBytes, warnings }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const result = await buildClient(path.resolve(process.argv[2] ?? process.cwd()))
  for (const warning of result.warnings) console.warn(`warn ${warning}`)
  console.log(`built ${result.name} -> ${path.relative(process.cwd(), result.outfile)} (${result.bytes} bytes)`)
}
