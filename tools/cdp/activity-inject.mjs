#!/usr/bin/env node
/**
 * Drives the real activity projection path with a synthetic running session.
 *
 * The session *source* is stubbed (no model credentials on the isolated
 * instance), but everything downstream is the shipping code: controller.update()
 * -> deriveSessionActivity -> emit -> React -> stage attributes -> mascot CSS.
 *
 * Usage: node tools/cdp/activity-inject.mjs <url>
 */
import { openPage } from './client.mjs';

const url = process.argv[2];
if (!url) {
	console.error('usage: node tools/cdp/activity-inject.mjs <url>');
	process.exit(2);
}

const MEASURE = `(() => {
  const stage = document.querySelector('.dsh-fairy-stage');
  const pupil = document.querySelector('.dsh-fairy-pupil') || document.querySelector('[class*="pupil"]');
  const eye = document.querySelector('#dsh-fairy-root');
  const shape = document.querySelector('[class*="thinking-clip-shape"], [class*="comforting-clip-shape"]');
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const pup = cs(pupil);
  return {
    activity: globalThis.__dshFairyController?.state?.activity ?? null,
    lifecycle: globalThis.__dshFairyController?.state?.lifecycle ?? null,
    stageState: stage?.getAttribute('data-fairy-state') ?? null,
    stageDataset: stage ? { ...stage.dataset } : null,
    pupilAnimation: pup ? pup.animationName + ' ' + pup.animationDuration : null,
    eyeClassCount: eye ? eye.querySelectorAll('[class*="dsh-fairy-"]').length : 0,
    hasClipShape: !!shape,
  };
})()`;

const page = await openPage();
try {
	await page.navigate(url);
	await page.waitFor("!!document.querySelector('[data-composer-card]')", { timeoutMs: 20000 });
	await page.evaluate("localStorage.setItem('dsh-fairy:debug','1')");
	await page.send('Page.reload', { ignoreCache: true });
	await page.waitFor("!!document.querySelector('.dsh-fairy-stage') && !!globalThis.__dshFairyController", {
		timeoutMs: 20000,
	});
	await new Promise((r) => setTimeout(r, 1200));

	const idle = await page.evaluate(MEASURE);

	await page.evaluate(`(() => {
    const c = globalThis.__dshFairyController;
    c.sessionOff?.();
    c.session = { sessionId: 'probe-running', getSnapshot: () => ({ running: true, blank: false }), subscribe: () => () => {} };
    c.update();
    return true;
  })()`);
	await new Promise((r) => setTimeout(r, 700));
	const thinking = await page.evaluate(MEASURE);

	await page.evaluate(`(() => {
    const c = globalThis.__dshFairyController;
    const snapshot = {
      running: false,
      blank: false,
      chat: {
        order: ['u1'],
        nodes: new Map([['u1', { kind: 'user', data: { text: '我今天很难过，什么都做不好' } }]]),
      },
    };
    c.session = { sessionId: 'probe-comforting', getSnapshot: () => snapshot, subscribe: () => () => {} };
    c.update();
    return true;
  })()`);
	await new Promise((r) => setTimeout(r, 700));
	const comforting = await page.evaluate(MEASURE);

	await page.evaluate(`(() => {
    const c = globalThis.__dshFairyController;
    c.session = { sessionId: 'probe-blank', getSnapshot: () => ({ running: false, blank: true }), subscribe: () => () => {} };
    c.update();
    return true;
  })()`);
	await new Promise((r) => setTimeout(r, 700));
	const blank = await page.evaluate(MEASURE);

	console.log(JSON.stringify({ idle, thinking, comforting, blank }, null, 2));
} finally {
	await page.close();
}
