// Composer and header layout audit for the HDD theme.
//
//   node tools/cdp/layout-audit.mjs <url>
//
// Opens a session so the session header exists, then reports across four widths:
//   - the header control order and the gaps between them,
//   - the blank-session (hero) fallback toggle vs the official corner button,
//   - where the native model picker sits relative to the send button,
//   - whether the picker still opens and exposes its model list.
//
// Exit code is non-zero when a layout invariant regresses, so it can gate a bump.

import { openPage } from './client.mjs';

const url = process.argv[2];
if (!url) {
  console.error('usage: node tools/cdp/layout-audit.mjs <url>');
  process.exit(2);
}

const WIDTHS = [2040, 1680, 1440, 1280];
const page = await openPage();
await page.send('Emulation.setDeviceMetricsOverride', { width: 2040, height: 1200, deviceScaleFactor: 1, mobile: false });

const click = async (x, y) => {
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
};

const center = (expr) => page.evaluate(`(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
const resize = async (width) => {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false });
  await new Promise((r) => setTimeout(r, 900));
};

const openSession = async () => {
  for (let attempt = 0; attempt < 6; attempt++) {
    const workspace = await center(`document.querySelector('[role="treeitem"][aria-expanded="false"]')`);
    if (workspace) {
      await click(workspace.x, workspace.y);
      await new Promise((r) => setTimeout(r, 900));
    }
    const row = await center(`document.querySelector('[role="treeitem"][aria-selected="false"]')`);
    if (row) {
      await click(row.x, row.y);
      await new Promise((r) => setTimeout(r, 2500));
    }
    if (await page.evaluate("!!document.querySelector('[data-slot=\"conversation.session.header.utilities\"]')")) return true;
  }
  return false;
};

const headerRun = () => page.evaluate(`(() => {
  const outlet = document.querySelector('[data-slot="conversation.session.header.utilities"]');
  const corner = document.querySelector('[data-slot="conversation.session.header.corner"]');
  const items = [...(outlet ? outlet.children : []), ...(corner ? corner.children : [])]
    .map((c) => {
      const r = c.getBoundingClientRect();
      return {
        ours: String(c.className).includes('dsh-fairy'),
        label: (c.getAttribute('aria-label') || c.textContent || '').trim().slice(0, 14),
        x: Math.round(r.x),
        width: Math.round(r.width),
      };
    })
    .filter((c) => c.width > 0)
    .sort((a, b) => a.x - b.x);
  const gaps = [];
  for (let i = 1; i < items.length; i++) gaps.push(items[i].x - (items[i - 1].x + items[i - 1].width));
  return { order: items.map((c) => (c.ours ? '*' : '') + c.label), gaps };
})()`);

const heroRun = () => page.evaluate(`(() => {
  const pick = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
  const host = document.querySelector('.dsh-fairy-hero-toggle-host');
  const corner = document.querySelector('[class*="headerCorner"]');
  if (!host || !corner) return { applicable: false };
  const a = pick(host);
  const b = pick(corner);
  if (a[2] < 1 || b[2] < 1) return { applicable: false };
  const overlap = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]));
  return { applicable: true, toggle: a, corner: b, overlap };
})()`);

const composerRun = () => page.evaluate(`(() => {
  const card = document.querySelector('[data-composer-card="true"]');
  if (!card) return null;
  const origin = card.getBoundingClientRect();
  const rel = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [Math.round(r.x - origin.x), Math.round(r.y - origin.y), Math.round(r.width), Math.round(r.height)];
  };
  const model = document.querySelector('.re-model-root .re-model-trigger')
    || document.querySelector('[aria-label*="选择模型"], [aria-label*="请选择模型"]');
  const send = document.querySelector('[data-dsh-fairy-composer-send-control="true"]') || document.querySelector('[aria-label="发送消息"]');
  const m = rel(model);
  const s = rel(send);
  return { model: m, send: s, gap: m && s ? s[0] - (m[0] + m[2]) : null, sameRow: m && s ? Math.abs(m[1] - s[1]) <= 4 : null };
})()`);

await page.navigate(url);
await page.waitFor("!!document.querySelector('[data-composer-card]')", { timeoutMs: 30000 });
await new Promise((r) => setTimeout(r, 3000));

const failures = [];
const opened = await openSession();
if (!opened) failures.push('could not open a session (no session header)');

for (const width of WIDTHS) {
  await resize(width);
  const { order, gaps } = await headerRun();
  const oursFirst = order.length > 0 && order.findIndex((label) => label.startsWith('*')) === 0;
  const evenRhythm = gaps.slice(0, 2).every((gap) => gap >= 6 && gap <= 10);
  console.log(`header  ${width}  ${order.join(' | ')}  gaps=${JSON.stringify(gaps)}${oursFirst ? '' : '  <-- ours not first'}${evenRhythm ? '' : '  <-- uneven spacing'}`);
  if (!oursFirst) failures.push(`header order at ${width}: ${order.join(' | ')}`);
  if (!evenRhythm) failures.push(`header spacing at ${width}: ${JSON.stringify(gaps)}`);
}

const composer = await composerRun();
console.log('composer ' + JSON.stringify(composer));
// The reference popup keeps ~35px of air between the model seat and the send
// button; the stock icon button used to sit at 8px.
if (!composer || composer.gap === null) failures.push('model picker not found');
else if (!composer.sameRow || composer.gap < 4 || composer.gap > 40) failures.push('model picker is not left of the send button: ' + JSON.stringify(composer));

const picker = await center(`document.querySelector('.re-model-root .re-model-trigger') || document.querySelector('[aria-label*="选择模型"], [aria-label*="请选择模型"]')`);
if (picker) {
  await click(picker.x, picker.y);
  await new Promise((r) => setTimeout(r, 900));
  // Both the stock two-level menu and the reasoning-effort popup route through a
  // first-level cell before the radio list appears.
  const cell = await center(`document.querySelector('.re-model-menu .re-model-row, [role="menu"] [role="menuitem"]')`);
  if (cell) {
    await click(cell.x, cell.y);
    let count = 0;
    for (let attempt = 0; attempt < 14 && !count; attempt++) {
      await new Promise((r) => setTimeout(r, 400));
      count = await page.evaluate("[...document.querySelectorAll('.re-model-option[role=\"menuitemradio\"], [role=\"menuitemradio\"]')].length");
    }
    console.log('picker  models=' + count);
    if (!count) failures.push('model list did not open');
  } else {
    failures.push('model menu did not open');
  }
} else {
  failures.push('model button not found');
}

// Blank conversation: the fallback pair must clear the official corner button.
await page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].filter((x) => /新建会话|New session/.test(x.getAttribute('aria-label') || '') && x.getBoundingClientRect().height > 30)[0]; if (b) b.scrollIntoView(); return true; })()`);
const newSession = await center(`[...document.querySelectorAll('button')].filter((x) => /新建会话|New session/.test(x.getAttribute('aria-label') || '') && x.getBoundingClientRect().height > 30)[0]`);
if (newSession) {
  await click(newSession.x, newSession.y);
  await new Promise((r) => setTimeout(r, 2600));
  for (const width of WIDTHS) {
    await resize(width);
    const hero = await heroRun();
    if (!hero.applicable) continue;
    console.log(`hero    ${width}  overlap=${hero.overlap}  toggle=${JSON.stringify(hero.toggle)}  corner=${JSON.stringify(hero.corner)}`);
    if (hero.overlap > 0) failures.push(`hero toggle overlaps the corner button at ${width} by ${hero.overlap}px`);
  }
} else {
  failures.push('new-session button not found');
}

await page.send('Emulation.clearDeviceMetricsOverride', {});
await page.close();

if (failures.length > 0) {
  console.error('FAIL\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log('ok layout invariants hold');
