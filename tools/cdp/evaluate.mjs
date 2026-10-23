/**
 * CLI around the CDP client: navigate, wait, evaluate, print JSON.
 *
 *   node tools/cdp/evaluate.mjs --url http://127.0.0.1:3400/?token=... \
 *        --wait "window.__DSH_FAIRY_PROBE__" --expr "JSON.stringify(window.__DSH_FAIRY_PROBE__)" \
 *        --console
 */
import { readFile } from 'node:fs/promises'
import { openPage } from './client.mjs'

const argv = process.argv.slice(2)
const option = (name, fallback = undefined) => {
  const index = argv.indexOf(`--${name}`)
  if (index < 0) return fallback
  const value = argv[index + 1]
  return value === undefined || value.startsWith('--') ? true : value
}

const url = option('url')
const waitFor = option('wait')
const expressionFile = option('file')
const inlineExpression = option('expr')
const timeoutMs = Number(option('timeout', '30000'))
const captureConsole = option('console', false) === true

const expression = expressionFile ? await readFile(expressionFile, 'utf8') : inlineExpression
if (!expression) {
  console.error('missing --expr or --file')
  process.exit(2)
}

const session = await openPage()
const consoleLines = []
if (captureConsole) {
  await session.send('Runtime.enable')
  session.on((message) => {
    if (message.method !== 'Runtime.consoleAPICalled') return
    const text = (message.params.args ?? []).map((arg) => arg.value ?? arg.description ?? arg.type).join(' ')
    consoleLines.push(`${message.params.type}: ${text}`.slice(0, 4000))
  })
}

const out = {}
try {
  if (url) {
    await session.navigate(url)
    out.navigated = url
  }
  if (waitFor) {
    await session.waitFor(waitFor, { timeoutMs })
    out.waited = true
  }
  out.result = await session.evaluate(expression)
} catch (error) {
  out.error = String(error?.message ?? error)
} finally {
  if (captureConsole) out.console = consoleLines.slice(-40)
  session.close()
}

console.log(JSON.stringify(out, null, 2))
