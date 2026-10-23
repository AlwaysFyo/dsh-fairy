#!/usr/bin/env node
/**
 * End-to-end check of the voice chain against the mock local TTS.
 *
 *   browser -> POST /fairy-voice/status   (host probes http://127.0.0.1:9880/docs)
 *   browser -> POST /fairy-voice/tts      (host posts to .../tts, streams PCM back)
 *   browser -> WebAudio decode/play       (32 kHz / 16-bit mono PCM)
 *
 * Usage: node tools/cdp/voice-e2e.mjs <url> [--text=你好]
 */
import { openPage } from './client.mjs';

const url = process.argv[2];
const textArg = process.argv.find((a) => a.startsWith('--text='));
const text = textArg ? textArg.slice('--text='.length) : '你好主人，我是Fairy。';
if (!url) {
	console.error('usage: node tools/cdp/voice-e2e.mjs <url> [--text=…]');
	process.exit(2);
}

const page = await openPage();
try {
	await page.navigate(url);
	await page.waitFor("!!document.querySelector('[data-composer-card]')", { timeoutMs: 20000 });

	const status = await page.evaluate(`(async () => {
    const r = await fetch('/fairy-voice/status', { cache: 'no-store' });
    const body = await r.json().catch(() => null);
    return { http: r.status, body };
  })()`);

	const tts = await page.evaluate(`(async () => {
    const started = performance.now();
    const r = await fetch('/fairy-voice/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: ${JSON.stringify(text)} }),
    });
    const ct = r.headers.get('content-type');
    const buf = await r.arrayBuffer();
    const view = new Int16Array(buf.slice(0, buf.byteLength - (buf.byteLength % 2)));
    let peak = 0;
    for (let i = 0; i < Math.min(view.length, 40000); i += 1) peak = Math.max(peak, Math.abs(view[i]));
    // Play it through WebAudio exactly like the client does (32 kHz mono PCM16).
    let played = null;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx({ sampleRate: 32000 });
      const frames = Math.floor(buf.byteLength / 2);
      const audio = ctx.createBuffer(1, frames, 32000);
      const channel = audio.getChannelData(0);
      for (let i = 0; i < frames; i += 1) channel[i] = view[i] / 32768;
      const src = ctx.createBufferSource();
      src.buffer = audio;
      src.connect(ctx.destination);
      src.start();
      played = { sampleRate: ctx.sampleRate, durationSec: Number(audio.duration.toFixed(2)) };
      await new Promise((r2) => setTimeout(r2, 250));
      await ctx.close();
    } catch (error) {
      played = { error: String(error) };
    }
    return {
      http: r.status,
      contentType: ct,
      bytes: buf.byteLength,
      samples: view.length,
      peak: peak / 32768,
      ms: Math.round(performance.now() - started),
      played,
    };
  })()`);

	const ui = await page.evaluate(`(() => {
    const control = document.querySelector('[aria-label="Fairy 朗读控制"]');
    const volume = document.querySelector('[aria-label="语音音量"]');
    const waveform = document.querySelector('.dsh-fairy-voice-waveform');
    const bars = document.querySelectorAll('.dsh-fairy-voice-wave-bar').length;
    return {
      control: control ? control.getBoundingClientRect().toJSON() : null,
      controlState: control ? { ...control.dataset } : null,
      volume: volume ? { ...volume.dataset } : null,
      waveform: waveform ? waveform.getBoundingClientRect().toJSON() : null,
      bars,
    };
  })()`);

	console.log(JSON.stringify({ status, tts, ui }, null, 2));
} finally {
	await page.close();
}
