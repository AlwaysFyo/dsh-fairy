/**
 * Host half of dsh-fairy-visual.
 *
 * It owns the persisted settings document and a JSON diagnostics endpoint. All
 * presentation lives in the client half; nothing here touches the DOM, and
 * nothing here is served from a public asset prefix.
 */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const name = 'fairy-visual'

const ROUTE_PREFIX = '/dsh-fairy'
const MAX_BODY_BYTES = 256 * 1024
const SCHEMA_VERSION = 2

const DEFAULT_SETTINGS = Object.freeze({
  version: SCHEMA_VERSION,
  enabled: false,
  theme: 'dark',
  mascotVisible: true,
  powerMode: 'normal',
  composerDockHeight: 132,
  accent: 'fairy-blue',
  diagnostics: false,
  coexistence: 'auto',
})

const KNOWN_KEYS = new Set(Object.keys(DEFAULT_SETTINGS))

/** Browser-side probe reports, newest last. In memory only, capped. */
const clientReports = []
const MAX_REPORTS = 5

const dshHome = () => process.env.DSH_HOME || join(homedir(), '.dsh')
const settingsFile = () => join(dshHome(), 'fairy-visual', 'settings.json')

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error(`body exceeds ${MAX_BODY_BYTES} bytes`))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })

const readJsonFile = async (path) => {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return null
  }
}

/** Rejects a mismatched schema version instead of silently migrating it. */
const normalize = (raw) => {
  if (!raw || typeof raw !== 'object' || raw.version !== SCHEMA_VERSION) return { ...DEFAULT_SETTINGS }
  const next = { ...DEFAULT_SETTINGS }
  for (const key of KNOWN_KEYS) if (key in raw) next[key] = raw[key]
  next.version = SCHEMA_VERSION
  return next
}

const readSettings = async () => normalize(await readJsonFile(settingsFile()))

const writeSettings = async (settings) => {
  const dir = join(dshHome(), 'fairy-visual')
  await mkdir(dir, { recursive: true })
  const target = settingsFile()
  const tmp = `${target}.tmp`
  await writeFile(tmp, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
  await rename(tmp, target)
  return settings
}

export function apply(ctx) {
  ctx.inject(['webServer'], (webCtx) => {
    const server = webCtx.get('webServer')
    if (!server || typeof server.register !== 'function') {
      ctx.logger?.warn?.('[fairy-visual] webServer service is unavailable; host routes disabled')
      return
    }
    webCtx.effect(
      () =>
        server.register({
          kind: 'prefix',
          path: ROUTE_PREFIX,
          handler: async (req, res) => {
            const url = new URL(req.url ?? '/', 'http://localhost')
            const json = (status, payload) => {
              const body = JSON.stringify(payload, null, 2)
              res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
              res.end(req.method === 'HEAD' ? undefined : body)
            }

            if (url.pathname === `${ROUTE_PREFIX}/settings`) {
              if (req.method === 'GET' || req.method === 'HEAD') {
                json(200, { ok: true, settings: await readSettings() })
                return
              }
              if (req.method === 'PUT' || req.method === 'POST') {
                let incoming
                try {
                  incoming = JSON.parse(await readBody(req))
                } catch (error) {
                  json(400, { ok: false, error: String(error?.message ?? error) })
                  return
                }
                const saved = await writeSettings(normalize(incoming?.settings ?? incoming))
                json(200, { ok: true, settings: saved })
                return
              }
              json(405, { ok: false, error: 'method not allowed' })
              return
            }

            if (url.pathname === `${ROUTE_PREFIX}/diag`) {
              const pkg = await readJsonFile(new URL('../package.json', import.meta.url))
              json(200, {
                ok: true,
                plugin: name,
                version: pkg?.version ?? null,
                node: process.versions.node,
                platform: process.platform,
                dshHome: process.env.DSH_HOME ?? null,
                profile: process.env.DSH_PROFILE ?? null,
                cwd: process.cwd(),
                settingsFile: settingsFile(),
                settings: await readSettings(),
                clientReports,
              })
              return
            }

            if (url.pathname === `${ROUTE_PREFIX}/report` && req.method === 'POST') {
              let body
              try {
                body = JSON.parse(await readBody(req))
              } catch (error) {
                json(400, { ok: false, error: String(error?.message ?? error) })
                return
              }
              clientReports.push({
                receivedAt: new Date().toISOString(),
                userAgent: String(req.headers['user-agent'] ?? '').slice(0, 200),
                body,
              })
              while (clientReports.length > MAX_REPORTS) clientReports.shift()
              json(200, { ok: true, stored: clientReports.length })
              return
            }

            res.writeHead(404).end()
          },
        }),
      'fairy-visual: host routes',
    )
  })
}
