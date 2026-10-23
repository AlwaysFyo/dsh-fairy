import { openPage } from './client.mjs'

const url = process.argv[2]
const session = await openPage()
await session.send('Runtime.enable')
await session.navigate(url)
await session.waitFor("document.querySelectorAll('[data-slot]').length > 20", { timeoutMs: 40000 })
await new Promise((r) => setTimeout(r, 2500))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const press = async (x, y, settle = 1300) => {
  await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
  await sleep(settle)
}

await session.evaluate(`(() => {
  window.__fairyProbe = { transitions: [], activity: [], lifecycle: [] };
  const record = (bucket, value) => window.__fairyProbe[bucket].push({ at: Math.round(performance.now()), ...value });
  const root = document.querySelector('.dsh-fairy-stage');
  if (root) record('activity', { initial: root.getAttribute('data-fairy-state') });
  window.__fairyObs = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1 && node.classList && node.classList.contains('dsh-hdd-session-transition')) {
          const region = node.querySelector('[data-dsh-session-transition-region]');
          const rect = region ? region.getBoundingClientRect() : null;
          window.__fairyProbe.transitions.push({
            at: Math.round(performance.now()),
            frames: node.querySelectorAll('[data-dsh-transition-frame]').length,
            layers: node.querySelectorAll('[data-dsh-transition-layer]').length,
            region: rect ? { y: Math.round(rect.y), h: Math.round(rect.height), w: Math.round(rect.width) } : null,
            clip: region ? getComputedStyle(region).clipPath : null,
          });
        }
      }
      if (record.type === 'attributes' && record.attributeName === 'data-fairy-state' && record.target.classList.contains('dsh-fairy-stage')) {
        record('activity', { state: record.target.getAttribute('data-fairy-state') });
      }
    }
  });
  window.__fairyObs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-fairy-state'] });
  return true;
})()`)

const steps = []
const rowsExpr = `(() => {
  const tree = document.querySelector('[role="tree"]');
  if (!tree) return [];
  return [...tree.querySelectorAll('[role="treeitem"]')].map((n) => {
    const r = n.getBoundingClientRect();
    return { sel: n.getAttribute('aria-selected'), text: (n.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 26), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), h: Math.round(r.height) };
  });
})()`

let rows = await session.evaluate(rowsExpr)
if (!rows.some((row) => row.sel)) {
  const workspace = rows.find((row) => row.h <= 36) || rows[0]
  if (workspace) await press(workspace.x, workspace.y, 1300)
  rows = await session.evaluate(rowsExpr)
}
steps.push({ step: 'rows', sessionRows: rows.filter((row) => row.sel) })

const target = rows.find((row) => row.sel === 'false')
if (target) {
  await press(target.x, target.y, 1800)
  steps.push({ step: 'switched to ' + target.text })
}

// A failing run still flips the Session into `running` for a moment, which is
// what the mascot's thinking state keys off.
const box = await session.evaluate(`(() => {
  const el = document.querySelector('[data-composer-input]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
})()`)
if (box) {
  await press(box.x, box.y, 350)
  await session.send('Input.insertText', { text: 'fairy activity probe' })
  await sleep(250)
  for (const type of ['keyDown', 'keyUp']) {
    await session.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, ...(type === 'keyDown' ? { text: '\r' } : {}) })
  }
  await sleep(4000)
  steps.push({ step: 'sent probe prompt' })
}

const probe = await session.evaluate(`(() => {
  window.__fairyObs?.disconnect();
  const root = document.querySelector('.dsh-fairy-stage');
  return {
    ...window.__fairyProbe,
    stageState: root ? root.getAttribute('data-fairy-state') : null,
    overlaysLeftBehind: document.querySelectorAll('.dsh-hdd-session-transition').length,
  };
})()`)

console.log(JSON.stringify({ steps, probe }, null, 2))
session.close()
