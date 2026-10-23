#!/usr/bin/env node
/**
 * Samples the visual controller's activity projection while a real run is in
 * flight, so the `thinking` state can be verified without guessing from pixels.
 *
 * Usage: node tools/cdp/activity-run.mjs <url> [--prompt="hi"] [--samples=60]
 */
import { openPage } from './client.mjs';

const url = process.argv[2];
const promptArg = process.argv.find((a) => a.startsWith('--prompt='));
const prompt = promptArg ? promptArg.slice('--prompt='.length) : '请只回复两个字：收到';
const samples = Number((process.argv.find((a) => a.startsWith('--samples=')) || '--samples=60').slice(10));
if (!url) {
	console.error('usage: node tools/cdp/activity-run.mjs <url> [--prompt=text] [--samples=n]');
	process.exit(2);
}

const STATE = `(() => {
  const c = globalThis.__dshFairyController;
  const stage = document.querySelector('.dsh-fairy-stage');
  const composer = document.querySelector('[data-composer-card]');
  return {
    activity: c?.state?.activity ?? null,
    lifecycle: c?.state?.lifecycle ?? null,
    stage: stage?.getAttribute('data-fairy-state') ?? null,
    phase: composer?.querySelector('[data-phase]')?.getAttribute('data-phase') ?? null,
  };
})()`;

const page = await openPage();
try {
	await page.navigate(url);
	await page.waitFor("!!document.querySelector('[data-composer-input]')", { timeoutMs: 20000 });
	await page.evaluate("localStorage.setItem('dsh-fairy:debug','1')");
	await page.send('Page.reload', { ignoreCache: true });
	await page.waitFor("!!document.querySelector('[data-composer-input]') && !!globalThis.__dshFairyController", {
		timeoutMs: 20000,
	});
	await new Promise((r) => setTimeout(r, 1000));

	// Focus the composer through a real click, then type through the input method
	// so the framework's own handlers see the text.
	const box = await page.evaluate(`(() => {
    const el = document.querySelector('[data-composer-input]');
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
	await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
	await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
	await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
	await page.send('Input.insertText', { text: prompt });
	await new Promise((r) => setTimeout(r, 300));
	await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
	await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });

	const seen = [];
	for (let i = 0; i < samples; i += 1) {
		const state = await page.evaluate(STATE);
		const key = `${state.activity}/${state.lifecycle}/${state.stage}/${state.phase}`;
		if (!seen.length || seen[seen.length - 1].key !== key) seen.push({ atMs: i * 100, key, ...state });
		await new Promise((r) => setTimeout(r, 100));
	}

	const tail = await page.evaluate(`(() => {
    const text = document.body.innerText || '';
    const idx = text.indexOf('本轮运行');
    return idx === -1 ? text.slice(-240) : text.slice(idx, idx + 160);
  })()`);

	console.log(JSON.stringify({ transitions: seen, bodyTail: tail }, null, 2));
} finally {
	await page.close();
}
