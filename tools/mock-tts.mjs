#!/usr/bin/env node
/**
 * Mock GPT-SoVITS-compatible local TTS endpoint for end-to-end verification.
 *
 * The ported dsh-fairy-voice host half posts {text, text_lang, ref_audio_path,
 * prompt_text, prompt_lang, text_split_method} to http://127.0.0.1:9880/tts and
 * streams the response body straight to the browser as 32 kHz / 16-bit mono PCM.
 * This server answers the same contract with a synthesised tone so the whole
 * chain (browser -> /fairy-voice/tts -> 127.0.0.1:9880/tts -> browser) can be
 * verified without a real model.
 *
 * Usage: node tools/mock-tts.mjs [--port=9880] [--ms-per-char=40]
 */
import http from 'node:http';

const arg = (name, fallback) => {
	const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
	return hit ? hit.slice(name.length + 3) : fallback;
};

const port = Number(arg('port', '9880'));
const msPerChar = Number(arg('ms-per-char', '40'));
const sampleRate = 32000;
const toneHz = 220;

const secondsFor = (text) => Math.min(2.5, Math.max(0.6, (String(text || '').length * msPerChar) / 1000));

function synthPcm(text) {
	const total = Math.floor(sampleRate * secondsFor(text));
	const out = Buffer.alloc(total * 2);
	for (let i = 0; i < total; i += 1) {
		const t = i / sampleRate;
		const envelope = Math.min(1, t / 0.05, (total / sampleRate - t) / 0.05);
		// Two soft partials so the WAV is recognisable as speech-ish output.
		const value =
			Math.sin(2 * Math.PI * toneHz * t) * 0.35 + Math.sin(2 * Math.PI * (toneHz * 2.02) * t) * 0.12;
		out.writeInt16LE(Math.round(value * envelope * 32000), i * 2);
	}
	return out;
}

const seen = { tts: null, docs: null, ttsCount: 0, status: null, generate: null, generateCount: 0, lastGenerateBody: null };

/** yovoice answers /v1/generate with a finished WAV, not a raw PCM stream. */
function wavFromPcm(pcm) {
	const header = Buffer.alloc(44);
	header.write('RIFF', 0, 'ascii');
	header.writeUInt32LE(36 + pcm.length, 4);
	header.write('WAVE', 8, 'ascii');
	header.write('fmt ', 12, 'ascii');
	header.writeUInt32LE(16, 16);
	header.writeUInt16LE(1, 20); // PCM
	header.writeUInt16LE(1, 22); // mono
	header.writeUInt32LE(sampleRate, 24);
	header.writeUInt32LE(sampleRate * 2, 28);
	header.writeUInt16LE(2, 32);
	header.writeUInt16LE(16, 34);
	header.write('data', 36, 'ascii');
	header.writeUInt32LE(pcm.length, 40);
	return Buffer.concat([header, pcm]);
}

const readJsonBody = async (req) => {
	const chunks = [];
	for await (const chunk of req) chunks.push(chunk);
	try {
		return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
	} catch {
		return {};
	}
};

const server = http.createServer(async (req, res) => {
	const url = new URL(req.url, `http://127.0.0.1:${port}`);
	if (req.method === 'GET' && url.pathname === '/__auth') {
		res.writeHead(200, { 'content-type': 'application/json' });
		res.end(JSON.stringify(seen));
		return;
	}
	/* ---- yovoice-compatible surface, used while the real engine is down ---- */
	if (req.method === 'GET' && url.pathname === '/v1/status') {
		seen.status = req.headers.authorization ?? null;
		res.writeHead(200, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ ready: true, engineVersion: 'mock-v0.9.1', runtimeVersion: 'mock', activity: { status: 'idle' } }));
		return;
	}
	if (req.method === 'GET' && url.pathname === '/v1/models') {
		res.writeHead(200, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ installed: [{ id: 'mock-index-tts2', path: 'mock.gguf', managed: true }] }));
		return;
	}
	if (req.method === 'GET' && url.pathname === '/v1/voices') {
		res.writeHead(200, { 'content-type': 'application/json' });
		res.end(JSON.stringify([{ source: 'import', id: 'mock-voice-001', name: 'Mock 音色', duration: 1.2 }]));
		return;
	}
	if (req.method === 'POST' && url.pathname === '/v1/generate') {
		seen.generate = req.headers.authorization ?? null;
		seen.generateCount += 1;
		const body = await readJsonBody(req);
		seen.lastGenerateBody = { keys: Object.keys(body), modelId: body.modelId ?? null, voiceId: body.voiceId ?? null, referenceText: body.referenceText ?? null };
		const wav = wavFromPcm(synthPcm(body.text || ''));
		console.error(`[mock-tts] generate text=${JSON.stringify(String(body.text || '').slice(0, 40))} modelId=${body.modelId ?? '-'} voiceId=${body.voiceId ?? '-'} bytes=${wav.length}`);
		res.writeHead(200, { 'content-type': 'audio/wav', 'cache-control': 'no-store', 'x-mock-tts': 'yovoice' });
		res.end(wav);
		return;
	}
	if (req.method === 'GET' && (url.pathname === '/docs' || url.pathname === '/')) {
		seen.docs = req.headers.authorization ?? null;
		res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
		res.end('<html><body>mock GPT-SoVITS API</body></html>');
		return;
	}
	if (url.pathname !== '/tts') {
		res.writeHead(404, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ error: 'not found' }));
		return;
	}
	seen.tts = req.headers.authorization ?? null;
	seen.ttsCount += 1;

	const body = await readJsonBody(req);
	const text = body.text || '';
	const pcm = synthPcm(text);
	console.error(
		`[mock-tts] ${new Date().toISOString()} text=${JSON.stringify(String(text).slice(0, 60))} chars=${String(text).length} bytes=${pcm.length} ref=${body.ref_audio_path ? 'yes' : 'no'} lang=${body.text_lang || '-'}`,
	);

	res.writeHead(200, {
		'content-type': 'audio/pcm',
		'cache-control': 'no-store',
		'x-mock-tts': '1',
	});
	// Stream in bursts to emulate a real synthesiser ramping up.
	const burst = Math.floor(sampleRate * 0.2) * 2;
	for (let offset = 0; offset < pcm.length; offset += burst) {
		res.write(pcm.subarray(offset, Math.min(offset + burst, pcm.length)));
		await new Promise((r) => setTimeout(r, 20));
	}
	res.end();
});

server.listen(port, '127.0.0.1', () => {
	console.error(`[mock-tts] listening on http://127.0.0.1:${port} (sampleRate=${sampleRate})`);
});
