/**
 * Persona composition for the Fairy host half.
 *
 * The prose shipped with the reference project lives under `assets/persona`; the
 * user's own text and the identity selection are layered on top of it. The result
 * is registered as one `systemPrompt` section, so a settings change takes effect
 * on the next turn without restarting anything.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const PERSONA_DIR = fileURLToPath(new URL('../assets/persona/', import.meta.url))
const CORPUS_DIR = join(PERSONA_DIR, 'corpus')

export const DEFAULT_PERSONA = Object.freeze({
  enabled: true,
  text: '',
  corpus: [],
})

let cachedDefaultText = ''

/** The reference project's persona prose, used whenever the user has not written one. */
export const defaultPersonaText = () => {
  if (cachedDefaultText) return cachedDefaultText
  try {
    cachedDefaultText = readFileSync(join(PERSONA_DIR, 'fairy-persona.md'), 'utf8').trim()
  } catch {
    cachedDefaultText = ''
  }
  return cachedDefaultText
}

const IDENTITY_NAMES = { ling: '铃', zhe: '哲' }

/** Turn the identity settings into the one paragraph the persona text defers to. */
export const identityClause = (identity) => {
  const mode = typeof identity?.mode === 'string' ? identity.mode : 'ling'
  const customName = typeof identity?.customName === 'string' ? identity.customName.trim() : ''
  const secondAssistant = typeof identity?.secondAssistant === 'string' ? identity.secondAssistant.trim() : ''
  const household = Array.isArray(identity?.household)
    ? identity.household.map((item) => String(item).trim()).filter(Boolean)
    : []
  const owner = mode === 'custom' ? (customName || '（未填写自定义称呼）') : (IDENTITY_NAMES[mode] ?? '铃')
  const lines = [`【本次会话身份】当前「主人」是${owner}。称呼主人时使用这个名字，不要凭对话内容猜测或改写。`]
  if (mode === 'custom' && secondAssistant) lines.push(`另一位被明确指派的协作人是${secondAssistant}；只有你被要求代为转达时才提到这个名字。`)
  if (household.length) lines.push(`家庭成员：${household.join('、')}。这些是主人提供的真实关系，不要自行扩展。`)
  return lines.join('\n')
}

const corpusFiles = () => {
  const found = []
  const walk = (dir) => {
    let entries = []
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile()) found.push(full)
    }
  }
  walk(CORPUS_DIR)
  return found.sort()
}

/** Stable ids (`behavior/fairy_behavior_rules.json`) so the client never sends a path. */
export const listCorpus = () =>
  corpusFiles().map((full) => {
    const id = relative(CORPUS_DIR, full).split('\\').join('/')
    let bytes = 0
    try {
      bytes = statSync(full).size
    } catch {
      bytes = 0
    }
    return { id, bytes }
  })

export const readCorpus = (id) => {
  const normalized = String(id ?? '').split('\\').join('/')
  if (!normalized || normalized.includes('..')) return null
  const match = listCorpus().find((entry) => entry.id === normalized)
  if (!match) return null
  try {
    return readFileSync(join(CORPUS_DIR, normalized), 'utf8')
  } catch {
    return null
  }
}

const MAX_CORPUS_CHARS = 400_000

/** Compose the prompt body: user text (or the bundled default) + identity + picked corpus. */
export const composePersonaPrompt = ({ persona, identity } = {}) => {
  const settings = { ...DEFAULT_PERSONA, ...(persona && typeof persona === 'object' ? persona : {}) }
  if (settings.enabled === false) return { text: '', chars: 0, source: 'disabled', corpus: [] }
  const own = typeof settings.text === 'string' ? settings.text.trim() : ''
  const source = own ? 'custom' : 'bundled'
  const parts = [own || defaultPersonaText()]
  const usedCorpus = []
  let corpusChars = 0
  if (Array.isArray(settings.corpus)) {
    for (const id of settings.corpus) {
      const body = readCorpus(id)
      if (!body) continue
      if (corpusChars + body.length > MAX_CORPUS_CHARS) break
      corpusChars += body.length
      usedCorpus.push(id)
      parts.push(`【参考语料 ${id}】\n${body}`)
    }
  }
  parts.push(identityClause(identity))
  const text = parts.filter(Boolean).join('\n\n')
  return { text, chars: text.length, source, corpus: usedCorpus }
}
