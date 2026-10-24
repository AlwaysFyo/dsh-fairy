/**
 * Read-only check of the two configuration surfaces: the persona prompt that is
 * injected into the system prompt, and the local TTS bridge configuration.
 *
 * Usage: node tools/cdp/persona-check.mjs <url>
 *
 * Every assertion is computed in the real page (same origin as the host), and a
 * failure exits non-zero so it can gate a release.
 */
import { openPage } from './client.mjs'

const [, , url] = process.argv
if (!url) {
  console.error('usage: node tools/cdp/persona-check.mjs <url>')
  process.exit(2)
}

const session = await openPage({ timeoutMs: 30000 })
await session.send('Page.enable')
await session.send('Runtime.enable')
await session.navigate(url)
await session.waitFor("document.querySelector('#root') && document.querySelector('[data-composer-card]')", { timeoutMs: 60000 })
await new Promise((resolve) => setTimeout(resolve, 1500))

const raw = await session.evaluate(`(async () => {
  const get = async (path) => {
    const res = await fetch(path, { headers: { accept: 'application/json' } });
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 200) }; }
    return { status: res.status, body };
  };
  const [persona, corpus, file, traversal, tts, voiceStatus, probe, diag] = await Promise.all([
    get('/dsh-fairy/persona'),
    get('/dsh-fairy/persona/corpus'),
    get('/dsh-fairy/persona/corpus/file?id=canon/fairy_canon.json'),
    get('/dsh-fairy/persona/corpus/file?id=../package.json'),
    get('/fairy-voice/config'),
    get('/fairy-voice/status'),
    get('/dsh-fairy/persona/probe'),
    get('/dsh-fairy/diag'),
  ]);
  return JSON.stringify({ persona, corpus, file, traversal, tts, voiceStatus, probe, diag });
})()`)
session.close()

const data = JSON.parse(raw)
const checks = []
const check = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail })

const persona = data.persona?.body?.value ?? {}
const composed = persona.composed ?? {}
const probe = data.probe?.body?.value ?? {}
const tts = data.tts?.body?.value ?? {}
const corpusItems = Array.isArray(data.corpus?.body?.value) ? data.corpus.body.value : []

check('GET /dsh-fairy/persona', data.persona?.status === 200, `status ${data.persona?.status}`)
check('内置人设可用', typeof persona.defaultText === 'string' && persona.defaultText.length > 500, `${persona.defaultText?.length ?? 0} chars`)
check('人设合成结果非空', composed.chars > 0, `chars=${composed.chars} source=${composed.source}`)
check('身份条款已合成', typeof persona.identityClause === 'string' && persona.identityClause.includes('【本次会话身份】'), (persona.identityClause ?? '').slice(0, 40))
check('语料清单齐全', corpusItems.length >= 11, `${corpusItems.length} file(s)`)
check('语料可按 id 读取', data.file?.status === 200 && (data.file?.body?.value?.text ?? '').length > 100, `status ${data.file?.status}`)
check('语料路径穿越被拒', data.traversal?.status === 404, `status ${data.traversal?.status}`)
check('真实组装包含 fairy:persona', probe.available === true && (probe.sectionNames ?? []).includes('fairy:persona'), `sections=${(probe.sectionNames ?? []).length}`)
check('注入长度与合成一致', probe.ourChars > 0 && probe.ourChars === composed.chars, `probe=${probe.ourChars} composed=${composed.chars}`)
check('身份条款进入提示词', probe.hasIdentityClause === true, `ourChars=${probe.ourChars}`)
check('GET /fairy-voice/config', data.tts?.status === 200 && typeof tts.ttsUrl === 'string', `${tts.ttsUrl ?? ''}`)
check('TTS 状态接口', typeof data.voiceStatus?.body?.available === 'boolean', `available=${data.voiceStatus?.body?.available}`)
check('diag 报告人设', typeof data.diag?.body?.persona?.chars === 'number', `diag=${data.diag?.body?.persona?.chars}`)

for (const entry of checks) {
  console.log(`${entry.ok ? 'ok  ' : 'FAIL'} ${entry.name}  (${entry.detail})`)
}
const failed = checks.filter((entry) => !entry.ok)
console.log(failed.length === 0 ? `ok ${checks.length} persona/tts invariant(s) hold` : `FAIL ${failed.length}/${checks.length}`)
process.exit(failed.length === 0 ? 0 : 1)
