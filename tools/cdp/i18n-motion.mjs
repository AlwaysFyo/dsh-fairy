#!/usr/bin/env node
/**
 * Locale + reduced-motion regression for the ported HDD theme.
 *
 * 1. Switches the client locale to `en` and re-measures the semantic anchors,
 *    so we prove the projection does not depend on Chinese ARIA labels.
 * 2. Emulates `prefers-reduced-motion: reduce`, switches a Session and proves
 *    the upstream early-return keeps the transition/glitch overlays out.
 *
 * Usage: node tools/cdp/i18n-motion.mjs <url>
 */
import { openPage } from './client.mjs';

const url = process.argv[2];
if (!url) {
	console.error('usage: node tools/cdp/i18n-motion.mjs <url>');
	process.exit(2);
}

const MEASURE = `(() => {
  const rect = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  };
  const marked = [...document.querySelectorAll('*')].filter((el) =>
    [...el.attributes].some((a) => a.name.startsWith('data-dsh-fairy-')),
  );
  const tree = document.querySelector('[role="tree"], [role="treeitem"]');
  return {
    lang: document.documentElement.lang,
    markers: marked.length,
    stage: rect('.dsh-fairy-stage'),
    dock: rect('[data-dsh-fairy-composer-dock]'),
    sidebarLayer: rect('[data-dsh-fairy-sidebar-layer]'),
    bgHost: rect('.dsh-hdd-background-host'),
    treeLabel: tree ? tree.getAttribute('aria-label') : null,
    newSessionLabel: (() => {
      const el = document.querySelector('[data-dsh-fairy-native-new-session]');
      return el ? el.getAttribute('aria-label') : null;
    })(),
    brandAnchor: rect('[data-dsh-fairy-brand-anchor]'),
    hdd: document.documentElement.getAttribute('data-dsh-fairy-mode'),
  };
})()`;

const page = await openPage(url);
const out = {};
try {
	await page.evaluate("localStorage.setItem('dsh-fairy:debug','1')");
	await page.send('Page.reload', { ignoreCache: true });
	await page.waitFor("!!document.querySelector('[data-composer-card]') && !!globalThis.__dshFairyCtx", {
		timeoutMs: 20000,
	});
	await new Promise((r) => setTimeout(r, 1500));
	out.zh = await page.evaluate(MEASURE);

	const switched = await page.evaluate(`(() => {
    const ctx = globalThis.__dshFairyCtx;
    const locale = (() => { try { return ctx.get('locale'); } catch { return null; } })();
    if (!locale) return 'no-locale-service';
    const target = locale.runtime || locale;
    if (typeof target.setLocale !== 'function') return 'no-setLocale:' + Object.keys(locale).join(',');
    target.setLocale('en');
    return 'ok';
  })()`);
	out.localeSwitch = switched;
	await new Promise((r) => setTimeout(r, 1200));
	out.en = await page.evaluate(MEASURE);

	await page.evaluate(`(() => {
    const ctx = globalThis.__dshFairyCtx;
    const locale = (() => { try { return ctx.get('locale'); } catch { return null; } })();
    const target = locale?.runtime || locale;
    if (target && typeof target.setLocale === 'function') target.setLocale('zh');
  })()`);
	await new Promise((r) => setTimeout(r, 900));

	// Reduced motion: emulate, reload, then switch Session and look for overlays.
	await page.send('Emulation.setEmulatedMedia', {
		features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
	});
	await page.send('Page.reload', { ignoreCache: true });
	await page.waitFor("!!document.querySelector('[data-composer-card]')", { timeoutMs: 20000 });
	await new Promise((r) => setTimeout(r, 1600));
	out.reducedMotionAtRest = await page.evaluate(`(() => ({
    matches: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    transitions: document.querySelectorAll('.dsh-hdd-session-transition, .dsh-hdd-mode-transition').length,
  }))()`);

	const row = await page.evaluate(`(() => {
    const rows = [...document.querySelectorAll('[role="treeitem"][aria-selected]')]
      .filter((el) => el.getAttribute('aria-selected') === 'false' && el.getBoundingClientRect().height > 20);
    const el = rows[0];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
	if (row) {
		await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: row.x, y: row.y });
		await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: row.x, y: row.y, button: 'left', clickCount: 1 });
		await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: row.x, y: row.y, button: 'left', clickCount: 1 });
		await new Promise((r) => setTimeout(r, 700));
		out.reducedMotionAfterSwitch = await page.evaluate(`(() => ({
      transitions: document.querySelectorAll('.dsh-hdd-session-transition, .dsh-hdd-mode-transition').length,
      glitchAnim: (() => {
        const el = document.querySelector('.dsh-fairy-glitch');
        return el ? getComputedStyle(el).animationName : null;
      })(),
    }))()`);
	}
	await page.send('Emulation.setEmulatedMedia', { features: [] });

	console.log(JSON.stringify(out, null, 2));
} finally {
	await page.close();
}

