/** Verifies the yovoice protocol path against the local mock engine. */
const host = process.argv[2] || 'http://127.0.0.1:3400';
const token = process.argv[3];
const mock = process.argv[4] || 'http://127.0.0.1:9881';

const auth = token ? { authorization: `Bearer ${token}` } : {};
const json = async (path, options) => {
  const res = await fetch(`${host}${path}`, { ...options, headers: { 'content-type': 'application/json', ...auth, ...(options?.headers || {}) } });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail === undefined ? '' : ` ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
};

const before = await json('/fairy-voice/config');
check('config exposes protocol', before.status === 200 && typeof before.body?.value?.protocol === 'string', before.body?.value?.protocol);
check('config exposes modelId/voiceId', before.body?.value && 'modelId' in before.body.value && 'voiceId' in before.body.value, { modelId: before.body?.value?.modelId, voiceId: before.body?.value?.voiceId });

const saved = await json('/fairy-voice/config/update', {
  method: 'POST',
  body: JSON.stringify({
    protocol: 'yovoice',
    ttsUrl: `${mock}/v1/generate`,
    docsUrl: `${mock}/v1/status`,
    apiKey: 'test-key-1234',
    modelId: 'mock-index-tts2',
    voiceId: 'mock-voice-001',
  }),
});
check('save yovoice config', saved.status === 200 && saved.body?.value?.protocol === 'yovoice', { status: saved.status, protocol: saved.body?.value?.protocol });
check('key stored as mask', saved.body?.value?.apiKeySet === true && String(saved.body?.value?.apiKeyMask || '').endsWith('1234'), saved.body?.value?.apiKeyMask);
check('no plaintext key in response', JSON.stringify(saved.body || '').includes('test-key-1234') === false);

const status = await json('/fairy-voice/status');
check('probe reports ready', status.status === 200 && status.body?.available === true, status.body);

const engine = await json('/fairy-voice/engine');
check('engine lists models', engine.status === 200 && (engine.body?.value?.models || []).some((m) => m.id === 'mock-index-tts2'), engine.body?.value?.models);
check('engine lists voices', engine.status === 200 && (engine.body?.value?.voices || []).some((v) => v.id === 'mock-voice-001'), engine.body?.value?.voices);

const ttsRes = await fetch(`${host}/fairy-voice/tts`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...auth },
  body: JSON.stringify({ text: '主人，Fairy 在线。' }),
});
const audio = Buffer.from(await ttsRes.arrayBuffer());
const riff = audio.subarray(0, 4).toString('ascii');
check('tts returns WAV', ttsRes.status === 200 && riff === 'RIFF', { status: ttsRes.status, type: ttsRes.headers.get('content-type'), bytes: audio.length, head: riff });
check('wav parses', audio.length > 44 && audio.readUInt32LE(24) === 32000, { rate: audio.length > 44 ? audio.readUInt32LE(24) : null, bits: audio.length > 44 ? audio.readUInt16LE(34) : null });

const seen = await (await fetch(`${mock}/__auth`)).json();
check('status probe carried Bearer', seen.status === 'Bearer test-key-1234', seen.status);
check('generate carried Bearer', seen.generate === 'Bearer test-key-1234', seen.generate);
check('generate body has modelId/voiceId', seen.lastGenerateBody?.modelId === 'mock-index-tts2' && seen.lastGenerateBody?.voiceId === 'mock-voice-001', seen.lastGenerateBody);

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} check(s) failed` : '\nall yovoice checks passed');
process.exit(failed.length ? 1 : 0);
