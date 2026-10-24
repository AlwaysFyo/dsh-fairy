#!/usr/bin/env node
/**
 * Regression check for the three reported composer defects:
 *  1. the mascot scale rail commits its value (host schema accepts it),
 *  2. the model trigger is clickable and opens its menu,
 *  3. the header utility cluster keeps the order the reference shows.
 *
 * Usage: node tools/cdp/verify-composer.mjs <url> [<referenceUrl>]
 */
import { openPage } from './client.mjs';

const url = process.argv[2];
const referenceUrl = process.argv[3];
if (!url) {
	console.error('usage: node tools/cdp/verify-composer.mjs <url> [<referenceUrl>]');
	process.exit(2);
}

const headerProbe = `(() => {
  const slot = document.querySelector('[data-slot="conversation.session.header.utilities"]');
  if (!slot) return null;
  return [...slot.children].map((el) => {
    const b = el.getBoundingClientRect();
    return { tag: el.tagName, marks: [...el.attributes].filter((a) => a.name !== 'class').map((a) => a.name + '=' + a.value.slice(0, 20)).join(' '),
      text: (el.textContent || '').trim().slice(0, 14), x: Math.round(b.x), w: Math.round(b.width) };
  });
})()`;

const page = await openPage({ timeoutMs: 20000 });
try {
	await page.navigate(url);
	await page.waitFor("!!document.querySelector('[data-composer-card]')", { timeoutMs: 20000 });
	await new Promise((r) => setTimeout(r, 1800));

	const out = {};

	out.schema = await page.evaluate(`(async () => {
    const get = async () => (await (await fetch('/dsh-fairy/settings?ns=fairy-visual')).json()).value;
    const before = await get();
    const sent = { ...before, mascotVisible: true, mascotScale: 0.63, mascotAnimationSpeed: 1.5 };
    const put = await (await fetch('/dsh-fairy/settings?ns=fairy-visual', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: sent }) })).json();
    const after = await get();
    return { before: { scale: before.mascotScale, speed: before.mascotAnimationSpeed, visible: before.mascotVisible }, echoed: { scale: put.value?.mascotScale, speed: put.value?.mascotAnimationSpeed }, after: { scale: after.mascotScale, speed: after.mascotAnimationSpeed }, accepted: after.mascotScale === 0.63 && after.mascotAnimationSpeed === 1.5 };
  })()`);

	// reload so the client picks the persisted scale up, then drive the rail for real
	await page.navigate(url);
	await page.waitFor("!!document.querySelector('[data-composer-card]')", { timeoutMs: 20000 });
	await new Promise((r) => setTimeout(r, 1800));

	out.rail = await page.evaluate(`(() => {
    const base = document.querySelector('[data-dsh-fairy-mascot-scale-base]');
    const input = base?.querySelector('input');
    const b = base?.getBoundingClientRect();
    const i = input?.getBoundingClientRect();
    const model = document.querySelector('[aria-label="请选择模型"], [aria-label="选择模型"]');
    const m = model?.getBoundingClientRect();
    const speedBase = document.querySelector('[data-dsh-fairy-mascot-animation-speed-base]')?.getBoundingClientRect();
    const hits = (x, y) => { const el = document.elementFromPoint(x, y); return el ? el.tagName + '#' + (el.getAttribute('aria-label') || String(el.className || '').slice(0, 18)) : null; };
    return {
      baseBox: b ? [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] : null,
      inputBox: i ? [Math.round(i.x), Math.round(i.y), Math.round(i.width), Math.round(i.height)] : null,
      speedBox: speedBase ? [Math.round(speedBase.x - (b ? 0 : 0)), Math.round(speedBase.y), Math.round(speedBase.width), Math.round(speedBase.height)] : null,
      modelBox: m ? [Math.round(m.x), Math.round(m.y), Math.round(m.width), Math.round(m.height)] : null,
      hitModel: m ? hits(m.x + m.width / 2, m.y + m.height / 2) : null,
      overlapModel: b && m ? !(i.x + i.width <= m.x || m.x + m.width <= i.x || i.y + i.height <= m.y || m.y + m.height <= i.y) : null,
    };
  })()`);

	if (out.rail.inputBox) {
		const [x, y, w, h] = out.rail.inputBox;
		const cy = y + h / 2;
		const from = x + w * 0.9;
		await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from, y: cy });
		await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from, y: cy, button: 'left', clickCount: 1 });
		for (const f of [0.6, 0.4]) {
			await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + w * f, y: cy, button: 'left' });
			await new Promise((r) => setTimeout(r, 60));
		}
		await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + w * 0.4, y: cy, button: 'left', clickCount: 1 });
		await new Promise((r) => setTimeout(r, 800));
		out.afterDrag = await page.evaluate(`(async () => {
      const value = (await (await fetch('/dsh-fairy/settings?ns=fairy-visual')).json()).value;
      const root = document.querySelector('#dsh-fairy-root, .dsh-fairy-root');
      return { persistedScale: value.mascotScale, attr: root?.getAttribute('data-dsh-fairy-mascot-scale') ?? document.documentElement.getAttribute('data-dsh-fairy-mascot-scale') };
    })()`);
	}

	out.model = await page.evaluate(`(() => {
    const model = document.querySelector('[aria-label="请选择模型"], [aria-label="选择模型"]');
    const b = model.getBoundingClientRect();
    return { box: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] };
  })()`);
	const [mx, my, mw, mh] = out.model.box;
	await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mx + mw / 2, y: my + mh / 2 });
	await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: mx + mw / 2, y: my + mh / 2, button: 'left', clickCount: 1 });
	await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: mx + mw / 2, y: my + mh / 2, button: 'left', clickCount: 1 });
	await new Promise((r) => setTimeout(r, 900));
	out.afterModelClick = await page.evaluate(`(() => ({
    expanded: document.querySelector('[aria-label="请选择模型"], [aria-label="选择模型"]')?.getAttribute('aria-expanded'),
    popups: document.querySelectorAll('[role="menu"], [role="listbox"], [role="dialog"]').length,
    items: [...document.querySelectorAll('[role="menuitem"], [role="option"]')].map((el) => (el.textContent || '').trim().slice(0, 26)).slice(0, 6),
  }))()`);

	out.header = { ours: await page.evaluate(headerProbe) };
	if (referenceUrl) {
		const ref = await openPage({ timeoutMs: 20000 });
		try {
			await ref.navigate(referenceUrl);
			await ref.waitFor("!!document.querySelector('[data-composer-card]')", { timeoutMs: 20000 });
			await new Promise((r) => setTimeout(r, 1500));
			out.header.reference = await ref.evaluate(headerProbe);
		} finally {
			await ref.close();
		}
	}

	console.log(JSON.stringify(out, null, 2));
} finally {
	await page.close();
}
