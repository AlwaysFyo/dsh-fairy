import { openPage } from './client.mjs'

const url = process.argv[2]
const session = await openPage()
await session.send('Runtime.enable')
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

const center = (expr) => session.evaluate(expr)

const newSessionButton = `(() => {
  const el = [...document.querySelectorAll('button, [role="button"]')].find((n) => (n.getAttribute('aria-label') || '').includes('新建会话'));
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
})()`

const sendPrompt = async (text) => {
  const box = await center(`(() => {
    const el = document.querySelector('[data-composer-input]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`)
  if (!box) return false
  await press(box.x, box.y, 350)
  await session.send('Input.insertText', { text })
  await sleep(250)
  for (const type of ['keyDown', 'keyUp']) {
    await session.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, ...(type === 'keyDown' ? { text: '\r' } : {}) })
  }
  await sleep(2500)
  return true
}

const treeRows = `(() => {
  const tree = document.querySelector('[role="tree"]');
  if (!tree) return [];
  return [...tree.querySelectorAll('[role="treeitem"]')].map((node) => {
    const r = node.getBoundingClientRect();
    return { text: (node.textContent || '').trim().slice(0, 26), selected: node.getAttribute('aria-selected'), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), h: Math.round(r.height) };
  });
})()`

const created = []
for (const prompt of ['fairy session A', 'fairy session B']) {
  let button = await center(newSessionButton)
  if (button) await press(button.x, button.y, 1500)
  const sent = await sendPrompt(prompt)
  const rows = await session.evaluate(treeRows)
  created.push({ prompt, sent, rows: rows.length })
}

const rows = await session.evaluate(treeRows)

await session.evaluate(`(() => {
  window.__tlog = [];
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
          region: rect ? { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) } : null,
          clip: region ? getComputedStyle(region).clipPath : null,
        });
      }
    }
  });
  window.__tobs.observe(document.body, { childList: true, subtree: true });
  return true;
})()`)

const target = rows.find((row) => row.selected !== 'true' && row.h > 20) || rows[rows.length - 1] || null
let clicked = null
if (target) {
  clicked = target
  await press(target.x, target.y, 1600)
}

const log = await session.evaluate(`(() => {
  window.__tobs?.disconnect();
  return { entries: window.__tlog || [], remaining: document.querySelectorAll('.dsh-hdd-session-transition').length };
})()`)

console.log(JSON.stringify({ created, rows, clicked, log }, null, 2))
session.close()
