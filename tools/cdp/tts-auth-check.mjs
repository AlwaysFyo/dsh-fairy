/**
 * End-to-end check of the TTS API-key surface: the host must persist the key,
 * never echo it back, send it as `Authorization: Bearer …` on both the probe and
 * the synthesis call, keep it across unrelated saves, and clear it on demand.
 *
 * Usage: node tools/cdp/tts-auth-check.mjs <hostUrl> <mockAuthUrl>
 *   e.g. node tools/cdp/tts-auth-check.mjs http://127.0.0.1:3400 http://127.0.0.1:9881/__auth
 *
 * The mock TTS server records the last Authorization header per endpoint
 * (`/__auth`), which is how the header is proven without a real engine.
 * Exits non-zero on any failed assertion so it can gate a release.
 */
const [, , hostUrl, mockAuthUrl] = process.argv
if (!hostUrl || !mockAuthUrl) {
  console.error('usage: node tools/cdp/tts-auth-check.mjs <hostUrl> <mockAuthUrl>')
  process.exit(2)
}

const TEST_KEY = 'sk-fairy-authtest-4242'
const mockBase = new URL(mockAuthUrl).origin
const MOCK_TTS = `${mockBase}/tts`
const MOCK_DOCS = `${mockBase}/docs`

const call = async (path, init) => {
  const response = await fetch(`${hostUrl}${path}`, init)
  const text = await response.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    body = { raw: text.slice(0, 200) }
  }
  return { status: response.status, body }
}
const getConfig = () => call('/fairy-voice/config')
const updateConfig = (value) =>
  call('/fairy-voice/config/update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  })
const seenAuth = async () => {
  const response = await fetch(mockAuthUrl)
  return response.json()
}

const checks = []
const check = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail })

const before = await getConfig()
const initial = before.body?.value ?? {}
if (initial.apiKeySet) {
  console.log(`FAIL a TTS API key is already configured; refusing to overwrite it (apiKeyMask=${initial.apiKeyMask})`)
  process.exit(1)
}

check('GET /fairy-voice/config', before.status === 200, `status ${before.status}`)
check('初始未设置 key', initial.apiKeySet === false && initial.apiKey === '', `apiKeySet=${initial.apiKeySet}`)

/* Point the bridge at the mock for the duration of the check so the header
 * assertions do not depend on whatever engine the profile was left on. */
const pointed = await updateConfig({ ttsUrl: MOCK_TTS, docsUrl: MOCK_DOCS })
check('端点指向 mock', pointed.body?.value?.ttsUrl === MOCK_TTS, `ttsUrl=${pointed.body?.value?.ttsUrl}`)

const saved = await updateConfig({ apiKey: TEST_KEY })
const savedValue = saved.body?.value ?? {}
check('保存 key 成功', saved.status === 200 && savedValue.apiKeySet === true, `status ${saved.status}`)
check('响应不回显明文', savedValue.apiKey === '' && !JSON.stringify(saved.body).includes(TEST_KEY), `apiKey="${savedValue.apiKey}"`)
check('回显掩码末四位', String(savedValue.apiKeyMask ?? '').endsWith('4242'), `mask=${savedValue.apiKeyMask}`)
check('来源标记为 file', savedValue.apiKeySource === 'file', `source=${savedValue.apiKeySource}`)

const status = await call('/fairy-voice/status')
const afterStatus = await seenAuth()
check('探活成功', status.status === 200 && status.body?.available === true, `status ${status.status}`)
check('探活带 Bearer 头', afterStatus.docs === `Bearer ${TEST_KEY}`, `docs=${afterStatus.docs}`)

const tts = await call('/fairy-voice/tts', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ text: '接口鉴权自检。' }),
})
const afterTts = await seenAuth()
check('合成成功', tts.status === 200, `status ${tts.status}`)
check('合成带 Bearer 头', afterTts.tts === `Bearer ${TEST_KEY}`, `tts=${afterTts.tts}`)

const keep = await updateConfig({ promptText: '只改提示文本。' })
check('无关保存保留 key', keep.body?.value?.apiKeySet === true, `apiKeySet=${keep.body?.value?.apiKeySet}`)
check('无关保存不泄漏 key', !JSON.stringify(keep.body).includes(TEST_KEY), 'no plaintext in body')

const cleared = await updateConfig({ clearApiKey: true })
const clearedValue = cleared.body?.value ?? {}
check('清除 key 成功', clearedValue.apiKeySet === false, `apiKeySet=${clearedValue.apiKeySet}`)

await call('/fairy-voice/status')
const afterClear = await seenAuth()
check('清除后不再发送头', afterClear.docs === null, `docs=${afterClear.docs}`)

await updateConfig({ promptText: initial.promptText ?? '', ttsUrl: initial.ttsUrl, docsUrl: initial.docsUrl })

for (const entry of checks) {
  console.log(`${entry.ok ? 'ok  ' : 'FAIL'} ${entry.name}  (${entry.detail})`)
}
const failed = checks.filter((entry) => !entry.ok)
console.log(failed.length === 0 ? `ok ${checks.length} tts api-key invariant(s) hold` : `FAIL ${failed.length}/${checks.length}`)
process.exit(failed.length === 0 ? 0 : 1)
