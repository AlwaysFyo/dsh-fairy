#!/usr/bin/env node
/**
 * Reproduces three reported issues in one run:
 *   1. mascot scale slider has no visible effect
 *   2. the model picker in the composer dock does not respond
 *   3. the HDD toggle sits left of the default header buttons
 *
 * Usage: node tools/cdp/bugprobe.mjs <url>
 */
import { openPage } from './client.mjs';

const url = process.argv[2];
if (!url) {
	console.error('usage: node tools/cdp/bugprobe.mjs <url>');
	process.exit(2);
}

const BOX = `const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };`;

const page = await openPage(url);
const report = {};
try {
	await page.evaluate("localStorage.setItem('dsh-fairy:debug','1')");
	await page.send('Page.reload', { ignoreCache: true });
	await page.waitFor("!!document.querySelector('[data-composer-card]')", { timeoutMs: 20000 });
	await new Promise((r) => setTimeout(r, 1800));

	// ---------- 3. header order ----------
	report.header = await page.evaluate(`(() => { ${BOX}
    const outlets = [...document.querySelectorAll('[data-slot="conversation.session.header.utilities"]')];
    return {
      outlets: outlets.length,
      children: outlets.map((outlet) => [...outlet.children].map((el) => ({
        tag: el.tagName,
        aria: el.getAttribute('aria-label'),
        text: (el.textContent || '').trim().slice(0, 18),
        box: box(el),
        ours: !!(el.closest('[data-dsh-fairy-hdd-toggle]') || el.querySelector('[data-dsh-fairy-hdd-toggle]') || el.hasAttribute('data-dsh-fairy-hdd-toggle') || el.querySelector('[data-dsh-fairy-session-metrics]')),
      }))),
      headerKids: [...(document.querySelector('.wSkVaW_header')?.children || [])].map((el) => ({
        tag: el.tagName, cls: String(el.className || '').slice(0, 26), box: box(el),
        text: (el.textContent || '').trim().slice(0, 30),
      })),
      toggle: box(document.querySelector('[data-dsh-fairy-hdd-toggle]')),
    };
  })()`);

	// ---------- 1. scale slider ----------
	const scaleInfo = await page.evaluate(`(() => { ${BOX}
    const input = document.querySelector('[data-dsh-fairy-mascot-scale-control] input');
    if (!input) return null;
    const r = input.getBoundingClientRect();
    return { box: box(input), value: input.value, min: input.min, max: input.max, step: input.step,
      mascotBefore: (() => { const m = document.querySelector('#dsh-fairy-root, .dsh-fairy-root'); return m ? getComputedStyle(m).getPropertyValue('--dsh-fairy-mascot-scale') + '|' + getComputedStyle(m).transform : null; })(),
      cssVar: getComputedStyle(document.documentElement).getPropertyValue('--dsh-fairy-mascot-scale') };
  })()`);
	report.scaleBefore = scaleInfo;

	if (scaleInfo) {
		const [x, y, w, h] = scaleInfo.box;
		const cy = y + h / 2;
		const startX = x + w * 0.95; // thumb at max
		await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: startX, y: cy });
		await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y: cy, button: 'left', clickCount: 1 });
		for (const f of [0.7, 0.45, 0.2]) {
			await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + w * f, y: cy, button: 'left' });
			await new Promise((r) => setTimeout(r, 60));
		}
		await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + w * 0.2, y: cy, button: 'left', clickCount: 1 });
		await new Promise((r) => setTimeout(r, 700));
		report.scaleAfterDrag = await page.evaluate(`(() => {
      const input = document.querySelector('[data-dsh-fairy-mascot-scale-control] input');
      const c = globalThis.__dshFairyController;
      const m = document.querySelector('#dsh-fairy-root, .dsh-fairy-root');
      return { value: input?.value, settingsScale: c?.state?.settings?.mascotScale ?? null,
        hostSettings: null, scaleVar: getComputedStyle(document.documentElement).getPropertyValue('--dsh-fairy-mascot-scale'),
        mascotTransform: m ? getComputedStyle(m).transform : null };
    })()`);
	}

	// ---------- 2. model picker ----------
	const beforeCounts = await page.evaluate(`(() => ({
    menu: document.querySelectorAll('[role="menu"]').length,
    listbox: document.querySelectorAll('[role="listbox"]').length,
    dialog: document.querySelectorAll('[role="dialog"]').length,
    total: document.body.querySelectorAll('*').length,
  }))()`);
	const modelBtn = await page.evaluate(`(() => { ${BOX}
    const btn = document.querySelector('[aria-label="请选择模型"], [aria-label="选择模型"]');
    if (!btn) return null;
    return { box: box(btn), disabled: btn.disabled, ariaExpanded: btn.getAttribute('aria-expanded'), ariaDisabled: btn.getAttribute('aria-disabled') };
  })()`);
	report.modelButton = modelBtn;
	if (modelBtn) {
		const [x, y, w, h] = modelBtn.box;
		const cx = x + w / 2, cy = y + h / 2;
		await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy });
		await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
		await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
		await new Promise((r) => setTimeout(r, 800));
		report.modelAfterClick = await page.evaluate(`(() => { ${BOX}
      const after = { menu: document.querySelectorAll('[role="menu"]').length, listbox: document.querySelectorAll('[role="listbox"]').length, dialog: document.querySelectorAll('[role="dialog"]').length, total: document.body.querySelectorAll('*').length };
      const popups = [...document.querySelectorAll('[role="menu"], [role="listbox"], [role="dialog"]')].map((el) => ({ tag: el.tagName, role: el.getAttribute('role'), box: box(el), text: (el.textContent || '').trim().slice(0, 40) }));
      return { after, popups, activeElement: document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName };
    })()`);
		report.modelClickDelta = {
			before: beforeCounts,
			after: report.modelAfterClick.after,
		};
	}

	console.log(JSON.stringify(report, null, 2));
} finally {
	await page.close();
}
