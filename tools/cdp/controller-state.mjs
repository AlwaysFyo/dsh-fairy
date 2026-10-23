#!/usr/bin/env node
/**
 * Reads the visual controller's projected state through the opt-in debug hook.
 *
 * The hook is installed by packages/dsh-fairy-visual/src/client/index.js only
 * when localStorage['dsh-fairy:debug'] === '1', so this script seeds the flag,
 * reloads, then reports state before/after switching to another Session.
 *
 * Usage: node tools/cdp/controller-state.mjs <url> [--switch]
 */
import { openPage } from './client.mjs';

const url = process.argv[2];
const doSwitch = process.argv.includes('--switch');
if (!url) {
	console.error('usage: node tools/cdp/controller-state.mjs <url> [--switch]');
	process.exit(2);
}

const READ = `(() => {
  const controller = globalThis.__dshFairyController;
  if (!controller) return { hook: false };
  const s = controller.state || {};
  return {
    hook: true,
    activity: s.activity,
    lifecycle: s.lifecycle,
    sessionId: s.sessionId,
    boundSessionId: controller.boundSessionId,
    hasBoundSession: controller.hasBoundSession,
    enabled: s.settings?.enabled,
  };
})()`;

const page = await openPage();
try {
	await page.navigate(url);
	await page.waitFor("!!document.querySelector('[data-composer-card]')", { timeoutMs: 20000 });
	await page.evaluate("localStorage.setItem('dsh-fairy:debug','1')");
	await page.send('Page.reload', { ignoreCache: true });
	await page.waitFor("!!document.querySelector('[data-composer-card]') && !!globalThis.__dshFairyController", {
		timeoutMs: 20000,
	});
	// Let the controller settle on its restored Session.
	await new Promise((r) => setTimeout(r, 1200));
	const before = await page.evaluate(READ);

	let after = null;
	if (doSwitch) {
		const target = await page.evaluate(`(() => {
      const rows = [...document.querySelectorAll('[role="treeitem"][aria-selected]')]
        .filter((row) => row.getAttribute('aria-selected') === 'false' && row.getBoundingClientRect().height > 20);
      const row = rows[0];
      if (!row) return null;
      const r = row.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: row.textContent.trim().slice(0, 40) };
    })()`);
		if (target) {
			await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: target.x, y: target.y });
			await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: target.x, y: target.y, button: 'left', clickCount: 1 });
			await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target.x, y: target.y, button: 'left', clickCount: 1 });
			await new Promise((r) => setTimeout(r, 1500));
			after = await page.evaluate(READ);
			after.switchedTo = target.text;
		}
	}

	console.log(JSON.stringify({ before, after }, null, 2));
} finally {
	await page.close();
}
