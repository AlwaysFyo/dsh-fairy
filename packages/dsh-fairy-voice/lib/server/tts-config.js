/**
 * Persisted TTS connection settings for the Fairy voice bridge.
 *
 * Environment variables stay the fallback so an existing deployment that only
 * sets `DSH_FAIRY_TTS_URL` keeps working; the UI writes this file instead.
 */
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises'
import { existsSync, readFileSync as readFileSyncSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

const dshHome = () => process.env.DSH_HOME || join(homedir(), '.dsh')
export const ttsConfigPath = () => join(dshHome(), 'fairy-voice', 'tts-config.json')
export const referenceDir = () => join(dshHome(), 'fairy-voice', 'runtime', 'reference')

const MAX_PROMPT_LENGTH = 4_000
const MAX_AUDIO_BYTES = 24 * 1024 * 1024

export const envDefaults = () => ({
  ttsUrl: process.env.DSH_FAIRY_TTS_URL || 'http://127.0.0.1:9880/tts',
  docsUrl: process.env.DSH_FAIRY_DOCS_URL || 'http://127.0.0.1:9880/docs',
  referenceAudio: 'fairy_ref.wav',
  promptText: '',
})

const sanitizeUrl = (value, fallback) => {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return fallback
  try {
    const url = new URL(text)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return fallback
    return text
  } catch {
    return fallback
  }
}

const sanitizeAudioName = (value, fallback) => {
  const name = typeof value === 'string' ? basename(value.trim()) : ''
  return name && /^[\w.\- ]+\.(wav|mp3|flac|ogg|m4a)$/i.test(name) ? name : fallback
}

/** Only known keys survive a write, so the file can never grow arbitrary fields. */
export const normalizeTtsConfig = (raw) => {
  const defaults = envDefaults()
  const source = raw && typeof raw === 'object' ? raw : {}
  const promptText = typeof source.promptText === 'string' ? source.promptText.slice(0, MAX_PROMPT_LENGTH) : defaults.promptText
  return {
    ttsUrl: sanitizeUrl(source.ttsUrl, defaults.ttsUrl),
    docsUrl: sanitizeUrl(source.docsUrl, defaults.docsUrl),
    referenceAudio: sanitizeAudioName(source.referenceAudio, defaults.referenceAudio),
    promptText,
  }
}

export const readTtsConfigSync = () => {
  try {
    return normalizeTtsConfig(JSON.parse(readFileSyncSync(ttsConfigPath(), 'utf8')))
  } catch {
    return envDefaults()
  }
}

export const readTtsConfig = async () => {
  try {
    return normalizeTtsConfig(JSON.parse(await readFile(ttsConfigPath(), 'utf8')))
  } catch {
    return envDefaults()
  }
}

export const writeTtsConfig = async (patch) => {
  const current = await readTtsConfig()
  const next = normalizeTtsConfig({ ...current, ...(patch && typeof patch === 'object' ? patch : {}) })
  const path = ttsConfigPath()
  await mkdir(join(path, '..'), { recursive: true })
  await mkdir(referenceDir(), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  await rename(tmp, path)
  return next
}

const decodeAudio = (value) => {
  if (typeof value !== 'string' || !value) throw Object.assign(new Error('missing audio'), { code: 'reference-audio-missing' })
  const payload = value.startsWith('data:') ? value.slice(value.indexOf(',') + 1) : value
  const buffer = Buffer.from(payload, 'base64')
  if (!buffer.length) throw Object.assign(new Error('empty audio'), { code: 'reference-audio-missing' })
  if (buffer.length > MAX_AUDIO_BYTES) throw Object.assign(new Error('audio too large'), { code: 'reference-audio-too-large' })
  return buffer
}

/** Persist an uploaded reference clip and (optionally) its transcript. */
export const saveReferenceAudio = async ({ audioBase64, filename, promptText } = {}) => {
  const buffer = decodeAudio(audioBase64)
  const name = sanitizeAudioName(filename, 'fairy_ref.wav')
  await mkdir(referenceDir(), { recursive: true })
  const target = join(referenceDir(), name)
  const tmp = `${target}.tmp`
  await writeFile(tmp, buffer)
  await rename(tmp, target)
  const config = await writeTtsConfig({
    referenceAudio: name,
    ...(typeof promptText === 'string' ? { promptText } : {}),
  })
  return { config, file: target, bytes: buffer.length }
}

export const referenceAudioPath = (config) => join(referenceDir(), config?.referenceAudio || 'fairy_ref.wav')

export const referencePromptPath = () => join(referenceDir(), 'fairy_ref.txt')

const REFERENCE_PROMPT_FALLBACK = '根据用户协议，我无权回复该问题。主人将在合适的时间与合适的场合获知答案。'

export const referencePromptText = (config) => {
  const inline = typeof config?.promptText === 'string' ? config.promptText.trim() : ''
  if (inline) return inline
  try {
    const text = readFileSyncSync(referencePromptPath(), 'utf8').trim()
    if (text) return text
  } catch {
    /* fall through to the fixed default */
  }
  return REFERENCE_PROMPT_FALLBACK
}

export const describeTtsConfig = async () => {
  const config = await readTtsConfig()
  const file = referenceAudioPath(config)
  let reference = { file, present: false, bytes: 0 }
  try {
    const info = await stat(file)
    reference = { file, present: info.isFile(), bytes: info.size }
  } catch {
    /* missing file is a normal state */
  }
  return {
    ...config,
    referencePath: reference.file,
    referencePresent: reference.present,
    referenceBytes: reference.bytes,
    referenceDir: referenceDir(),
    configPath: ttsConfigPath(),
    env: {
      ttsUrl: process.env.DSH_FAIRY_TTS_URL ?? null,
      docsUrl: process.env.DSH_FAIRY_DOCS_URL ?? null,
      overridden: Boolean(process.env.DSH_FAIRY_TTS_URL || process.env.DSH_FAIRY_DOCS_URL),
    },
    effectivePrompt: referencePromptText(config),
  }
}

export { existsSync, REFERENCE_PROMPT_FALLBACK }
