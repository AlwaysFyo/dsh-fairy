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
import {
  DEFAULT_PERSONA,
  composePersonaPrompt,
  defaultPersonaText,
  identityClause,
  listCorpus,
  readCorpus,
} from './persona.js'

export const name = 'fairy-visual'

const ROUTE_PREFIX = '/dsh-fairy'
const MAX_BODY_BYTES = 2 * 1024 * 1024
const SCHEMA_VERSION = 2
/** Section order: right after the deployment persona prefix, before plan policy. */
const PERSONA_SECTION_ORDER = 100

const DEFAULT_SETTINGS = Object.freeze({
  version: SCHEMA_VERSION,
  enabled: false,
  theme: 'dark',
  mascotVisible: true,
  mascotScale: 1,
  mascotAnimationSpeed: 1,
  chibiThumb: false,
  powerMode: 'normal',
  composerDockHeight: 132,
  accent: 'fairy-blue',
  diagnostics: false,
  coexistence: 'auto',
})

const KNOWN_KEYS = new Set(Object.keys(DEFAULT_SETTINGS))

/* Mirrors `client/settings-normalizer.cjs` so the authoritative copy on disk can
 * never disagree with what the browser accepted optimistically. */
const SPEED_STOPS = Object.freeze([0.7, 1, 1.5])
const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value))
const finiteNumber = (value) => {
  if (value === '' || value == null) return NaN
  const number = Number(value)
  return Number.isFinite(number) ? number : NaN
}
const nearestStop = (value) => SPEED_STOPS.reduce((best, item) => (Math.abs(item - value) < Math.abs(best - value) ? item : best), SPEED_STOPS[0])

/** Browser-side probe reports, newest last. In memory only, capped. */
const clientReports = []
const MAX_REPORTS = 5

const dshHome = () => process.env.DSH_HOME || join(homedir(), '.dsh')
const settingsDir = () => join(dshHome(), 'fairy-visual')
const settingsFile = () => join(settingsDir(), 'settings.json')

/**
 * Every persisted scope lives in its own file. `fairy-visual` keeps the original
 * `settings.json` name; the others are named after their namespace so a reader can
 * find them without this file.
 */
const NAMESPACES = Object.freeze({
  'fairy-visual': { file: 'settings.json', schema: SCHEMA_VERSION },
  'fairy-identity': { file: 'identity.json', schema: null },
  'fairy-persona': { file: 'persona.json', schema: null },
})
const DEFAULT_NAMESPACE = 'fairy-visual'
const DEFAULT_IDENTITY = Object.freeze({ mode: 'ling', customName: '', secondAssistant: '', household: [] })
const resolveNamespace = (raw) => (typeof raw === 'string' && raw in NAMESPACES ? raw : DEFAULT_NAMESPACE)
const scopeFile = (namespace) => join(settingsDir(), NAMESPACES[namespace].file)

/** Rendered persona for the next prompt assembly; refreshed on every relevant write. */
let personaCache = { text: '', chars: 0, source: 'bundled', corpus: [] }
/** Kept for the diagnostics probe so a real assembly can be inspected. */
let systemPromptService = null

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
  next.enabled = next.enabled === true
  next.theme = next.theme === 'light' ? 'light' : 'dark'
  next.mascotVisible = next.mascotVisible !== false
  /* The reasoning slider ships a running-fish sprite thumb; the reference theme
   * replaces it with a plain knob, so the plain knob is the default here and the
   * sprite is an opt-in. */
  next.chibiThumb = next.chibiThumb === true
  next.powerMode = next.powerMode === 'low-power' ? 'low-power' : 'normal'
  const scale = finiteNumber(next.mascotScale)
  next.mascotScale = Number.isFinite(scale) ? clampNumber(scale, 0.55, 1) : 1
  const speed = finiteNumber(next.mascotAnimationSpeed)
  next.mascotAnimationSpeed = Number.isFinite(speed) ? nearestStop(speed) : 1
  const dockHeight = finiteNumber(next.composerDockHeight)
  next.composerDockHeight = Number.isFinite(dockHeight) ? Math.round(clampNumber(dockHeight, 132, 420)) : 132
  return next
}

const readScope = async (namespace) => {
  const raw = await readJsonFile(scopeFile(namespace))
  if (namespace === DEFAULT_NAMESPACE) return normalize(raw)
  if (namespace === 'fairy-persona') return { ...DEFAULT_PERSONA, ...(raw && typeof raw === 'object' ? raw : {}) }
  const base = namespace === 'fairy-identity' ? DEFAULT_IDENTITY : {}
  return { ...base, ...(raw && typeof raw === 'object' ? raw : {}) }
}

const writeScope = async (namespace, value) => {
  const source = value && typeof value === 'object' ? value : {}
  /* Merge over the persisted document first: a partial patch (a single field)
   * must not reset the whole scope to defaults, which is what normalizing a
   * version-less object used to do. An explicit `version` in the patch is still
   * honoured so a mismatched schema keeps being rejected. */
  const current = await readScope(namespace)
  const merged = { ...current, ...source }
  if (!('version' in source)) merged.version = namespace === DEFAULT_NAMESPACE ? SCHEMA_VERSION : current.version
  const stored = namespace === DEFAULT_NAMESPACE
    ? normalize(merged)
    : { ...(namespace === 'fairy-identity' ? DEFAULT_IDENTITY : namespace === 'fairy-persona' ? DEFAULT_PERSONA : {}), ...merged }
  await mkdir(settingsDir(), { recursive: true })
  const target = scopeFile(namespace)
  const tmp = `${target}.tmp`
  await writeFile(tmp, `${JSON.stringify(stored, null, 2)}\n`, 'utf8')
  await rename(tmp, target)
  if (namespace !== DEFAULT_NAMESPACE) await refreshPersona()
  return stored
}

/** Rebuild the cached prompt body from the persisted persona + identity scopes. */
const refreshPersona = async () => {
  try {
    const [persona, identity] = await Promise.all([readScope('fairy-persona'), readScope('fairy-identity')])
    personaCache = composePersonaPrompt({ persona, identity })
  } catch (error) {
    personaCache = { text: '', chars: 0, source: 'error', corpus: [], error: String(error?.message ?? error) }
  }
  return personaCache
}

const readSettings = () => readScope(DEFAULT_NAMESPACE)

export function apply(ctx) {
  void refreshPersona()

  /* Persona rows own the deployment prompt, so this row names its own section
   * instead of colliding with `deployment:persona-prefix`. The text is a provider
   * so a settings save applies to the very next assembly. */
  ctx.inject(['systemPrompt'], (promptCtx) => {
    const systemPrompt = promptCtx.get('systemPrompt')
    if (!systemPrompt || typeof systemPrompt.section !== 'function') {
      ctx.logger?.warn?.('[fairy-visual] systemPrompt service is unavailable; persona injection disabled')
      return
    }
    systemPromptService = systemPrompt
    promptCtx.effect(
      () =>
        systemPrompt.section({
          name: 'fairy:persona',
          order: PERSONA_SECTION_ORDER,
          text: () => personaCache.text,
          interpolate: false,
        }),
      'fairy-visual: persona section',
    )
  })

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
              const namespace = resolveNamespace(url.searchParams.get('ns'))
              if (req.method === 'GET' || req.method === 'HEAD') {
                json(200, { ok: true, namespace, value: await readScope(namespace) })
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
                const saved = await writeScope(namespace, incoming?.value ?? incoming?.settings ?? incoming)
                json(200, { ok: true, namespace, value: saved })
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
                identity: await readScope('fairy-identity'),
                persona: {
                  enabled: (await readScope('fairy-persona')).enabled !== false,
                  chars: personaCache.chars,
                  source: personaCache.source,
                  corpus: personaCache.corpus,
                  defaultChars: defaultPersonaText().length,
                },
                clientReports,
              })
              return
            }

            if (url.pathname === `${ROUTE_PREFIX}/persona`) {
              const [persona, identity] = await Promise.all([readScope('fairy-persona'), readScope('fairy-identity')])
              const composed = composePersonaPrompt({ persona, identity })
              json(200, {
                ok: true,
                value: {
                  persona,
                  identity,
                  identityClause: identityClause(identity),
                  defaultText: defaultPersonaText(),
                  composed: { chars: composed.chars, source: composed.source, corpus: composed.corpus },
                },
              })
              return
            }

            if (url.pathname === `${ROUTE_PREFIX}/persona/probe`) {
              // Runs one real assembly so the operator can see whether the
              // `fairy:persona` section actually reaches the prompt pipeline.
              if (!systemPromptService || typeof systemPromptService.assemble !== 'function') {
                json(200, { ok: true, value: { available: false, reason: 'systemPrompt service is not injected' } })
                return
              }
              try {
                const assembly = await systemPromptService.assemble({})
                const ours = (assembly.sections ?? []).find((section) => section.name === 'fairy:persona')
                json(200, {
                  ok: true,
                  value: {
                    available: true,
                    sectionCount: (assembly.sections ?? []).length,
                    sectionNames: (assembly.sections ?? []).map((section) => section.name),
                    ourChars: typeof ours?.text === 'string' ? ours.text.length : 0,
                    ourHead: typeof ours?.text === 'string' ? ours.text.slice(0, 120) : '',
                    hasIdentityClause: typeof ours?.text === 'string' && ours.text.includes('【本次会话身份】'),
                    cachedChars: personaCache.chars,
                  },
                })
              } catch (error) {
                json(500, { ok: false, error: String(error?.message ?? error) })
              }
              return
            }

            if (url.pathname === `${ROUTE_PREFIX}/persona/corpus`) {
              json(200, { ok: true, value: listCorpus() })
              return
            }

            if (url.pathname === `${ROUTE_PREFIX}/persona/corpus/file`) {
              const id = url.searchParams.get('id')
              const text = readCorpus(id)
              if (text == null) {
                json(404, { ok: false, error: 'corpus file not found' })
                return
              }
              json(200, { ok: true, value: { id, text } })
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
