#!/usr/bin/env node
/**
 * Instrumented reproduction: installs capture-phase listeners on the mascot
 * scale slider and the model trigger, then drives both with real mouse input
 * and reports which events actually arrive.
 *
 * Usage: node tools/cdp/eventprobe.mjs <url>
 */
import { openPage } from './client.mjs';

const url = process.argv[2];
if (!url) {
	console.error('usage: node tools/cdp/eventprobe.mjs <url>');
	process.exit(2);
}

const page = await openPage({ timeoutMs: 20000 });
try {
	await page.navigate(url);
	await page.waitFor("!!document.querySelector('[data-composer-card]')", { timeoutMs: 20000 });
	await new Promise((r) => setTimeout(r, 1500));

	const setup = await page.evaluate(`(() => {
    globalThis.__log = [];
    const push = (s) => globalThis.__log.push(s);
    const model = document.querySelector('[aria-label="请选择模型"], [aria-label="选择模型"]');
    if (model) {
      for (const ev of ['pointerdown', 'mousedown', 'click']) model.addEventListener(ev, () => push('model:' + ev), true);
      push('model:hooked');
    }
    const input = document.querySelector('[data-dsh-fairy-mascot-scale-control] input');
    if (input) {
      for (const ev of ['pointerdown', 'mousedown', 'input', 'change']) {
        input.addEventListener(ev, () => push('scale:' + ev + '=' + input.value), true);
      }
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      globalThis.__setScale = (v) => { setter.call(input, String(v)); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); };
      push('scale:hooked');
    }
    const box = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
    return {
      model: model ? box(model) : null,
      slider: input ? box(input) : null,
      siblings: model && model.parentElement ? [...model.parentElement.children].map((el) => ({ tag: el.tagName, cls: String(el.className || '').slice(0, 26), box: box(el) })) : null,
    };
  })()`);

	const out = { setup };

	// 1a. programmatic value change on the slider (proves the handler, not the pointer)
	if (setup.slider) {
		await page.evaluate('globalThis.__setScale(0.6)');
		await new Promise((r) => setTimeout(r, 500));
		out.afterProgrammatic = await page.evaluate(`(() => {
      const c = globalThis.__dshFairyController;
      const m = document.querySelector('#dsh-fairy-root, .dsh-fairy-root');
      const input = document.querySelector('[data-dsh-fairy-mascot-scale-control] input');
      return { inputValue: input?.value, settingsScale: c?.state?.settings?.mascotScale ?? null,
        transform: m ? getComputedStyle(m).transform : null, log: globalThis.__log.slice() };
    })()`);
	}

	// 1b. real drag
	if (setup.slider) {
		const [x, y, w, h] = setup.slider;
		const cy = y + h / 2;
		await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + w * 0.6, y: cy });
		await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x + w * 0.6, y: cy, button: 'left', clickCount: 1 });
		for (const f of [0.5, 0.35, 0.2]) {
			await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + w * f, y: cy, button: 'left' });
			await new Promise((r) => setTimeout(r, 50));
		}
		await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + w * 0.2, y: cy, button: 'left', clickCount: 1 });
		await new Promise((r) => setTimeout(r, 500));
		out.afterDrag = await page.evaluate(`(() => {
      const input = document.querySelector('[data-dsh-fairy-mascot-scale-control] input');
      return { inputValue: input?.value, scale: globalThis.__dshFairyController?.state?.settings?.mascotScale ?? null, log: globalThis.__log.slice() };
    })()`);
	}

	// 2. model trigger
	if (setup.model) {
		const [x, y, w, h] = setup.model;
		const cx = x + w / 2, cy = y + h / 2;
		await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy });
		await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
		await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
		await new Promise((r) => setTimeout(r, 900));
		out.afterModelClick = await page.evaluate(`(() => ({
      log: globalThis.__log.slice(),
      expanded: document.querySelector('[aria-label="请选择模型"], [aria-label="选择模型"]')?.getAttribute('aria-expanded'),
      popups: document.querySelectorAll('[role="menu"], [role="listbox"], [role="dialog"]').length,
      focused: document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName,
    }))()`);
	}

	console.log(JSON.stringify(out, null, 2));
} finally {
	await page.close();
}
