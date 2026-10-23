import { openPage } from './client.mjs'

const url = process.argv[2]
const reduced = process.argv.includes('--reduced-motion')

const session = await openPage()
await session.send('Runtime.enable')
if (reduced) {
  await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
}
await session.navigate(url)
await session.waitFor("document.querySelectorAll('[data-slot]').length > 20", { timeoutMs: 40000 })
await new Promise((r) => setTimeout(r, 2000))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const press = async (x, y, settle = 1200) => {
  await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
  await sleep(settle)
}

// Record every session-switch overlay the plugin appends for the whole run, so
// the transient 420ms animation cannot be missed between round trips.
await session.evaluate(`(() => {
  window.__tlog = [];
  window.__firstAt = performance.now();
  window.__tobs = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1 || !node.classList || !node.classList.contains('dsh-hdd-session-transition')) continue;
        const region = node.querySelector('[data-dsh-session-transition-region]');
        const rect = region ? region.getBoundingClientRect() : null;
        window.__tlog.push({
          at: Math.round(performance.now()),
          frames: node.querySelectorAll('[data-dsh-transition-frame]').length,
          layers: node.querySelectorAll('[data-dsh-transition-layer]').length,
          region: rect ? { y: Math.round(rect.y), h: Math.round(rect.height), w: Math.round(rect.width) } : null,
          clip: region ? getComputedStyle(region).clipPath : null,
          parent: node.parentElement ? String(node.parentElement.className || node.parentElement.tagName).slice(0, 40) : null,
        });
      }
    }
  });
  window.__tobs.observe(document.body, { childList: true, subtree: true });
  return true;
})()`)

const rowsExpr = `(() => {
  const tree = document.querySelector('[role="tree"]');
  if (!tree) return [];
  return [...tree.querySelectorAll('[role="treeitem"]')].map((node) => {
    const r = node.getBoundingClientRect();
    return {
      text: (node.textContent || '').trim().slice(0, 26),
      sel: node.getAttribute('aria-selected'),
      x: Math.round(r.x + r.width / 2),
      y: Math.round(r.y + r.height / 2),
      h: Math.round(r.height),
    };
  });
})()`

const clickNewSession = async () => {
  const button = await session.evaluate(`(() => {
    const el = [...document.querySelectorAll('button, [role="button"]')].find((n) => (n.getAttribute('aria-label') || '').includes('新建会话'));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`)
  if (button) await press(button.x, button.y, 1500)
  return !!button
}

let rows = await session.evaluate(rowsExpr)
// Sessions live inside the workspace row; expand it when it starts collapsed.
if (!rows.some((row) => row.sel)) {
  const workspace = rows.find((row) => row.h <= 40)
  if (workspace) await press(workspace.x, workspace.y, 1200)
  rows = await session.evaluate(rowsExpr)
}

if (rows.filter((row) => row.sel === 'false' || row.sel === 'true').length < 2) await clickNewSession()
rows = await session.evaluate(rowsExpr)

const target = rows.find((row) => row.sel === 'false') || null
let clicked = null
if (target) {
  clicked = target
  await press(target.x, target.y, 1600)
}

await sleep(600)
const log = await session.evaluate(`(() => {
  window.__tobs?.disconnect();
  const frames = [...document.querySelectorAll('.dsh-hdd-session-transition')].length;
  return {
    entries: window.__tlog || [],
    overlaysLeftBehind: frames,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    liveAnimations: document.getAnimations ? document.getAnimations().length : null,
  };
})()`)

console.log(JSON.stringify({ reducedMotionMode: reduced, sessionRows: rows.filter((r) => r.sel), clicked, log }, null, 2))
session.close()
