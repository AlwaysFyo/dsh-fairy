import { openPage } from './client.mjs'

const url = process.argv[2]
const session = await openPage()
await session.send('Runtime.enable')
await session.navigate(url)
await session.waitFor("document.querySelectorAll('[data-slot]').length > 20", { timeoutMs: 40000 })
await session.evaluate(`(() => { try { localStorage.setItem('dsh-fairy:debug', '1') } catch (e) {} return true })()`)
await session.send('Page.reload')
await session.waitFor("!!globalThis.__dshFairyCtx", { timeoutMs: 40000 })
await new Promise((r) => setTimeout(r, 2500))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const press = async (x, y, settle = 1300) => {
  await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
  await sleep(settle)
}

const probe = `(() => {
  const ctx = globalThis.__dshFairyCtx;
  const u = ctx.get('uiSession');
  const s = ctx.get('sessions');
  const list = s.list.getSnapshot();
  const key = u.current && u.current.value ? u.current.value.key : undefined;
  let statusKeys = null;
  try { const snap = u.sessionStatus.getSnapshot(); statusKeys = snap && snap.keys ? [...snap.keys()].slice(0, 5).map(String) : null } catch (e) { statusKeys = 'THROW' }
  const selected = document.querySelector('[role="treeitem"][aria-selected="true"]');
  const rowId = selected ? (selected.id || selected.getAttribute('data-id') || selected.getAttribute('data-session-id') || null) : null;
  return {
    hasCtx: !!ctx,
    currentKeyType: typeof key,
    currentKey: typeof key === 'symbol' ? key.toString() : (key == null ? null : String(key)),
    listIds: (list.ids || []).slice(0, 5).map(String),
    statusKeys,
    selectedRowId: rowId,
    selectedRowText: selected ? (selected.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 30) : null,
    uiActive: u.active,
    probeAt: Date.now(),
  };
})()`

const steps = []
steps.push({ step: 'after load', state: await session.evaluate(probe) })

// Expand the workspace row so session rows exist in the DOM.
const rowsBefore = await session.evaluate(`(() => {
  const tree = document.querySelector('[role="tree"]');
  if (!tree) return [];
  return [...tree.querySelectorAll('[role="treeitem"]')].map((n) => {
    const r = n.getBoundingClientRect();
    return { sel: n.getAttribute('aria-selected'), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), h: Math.round(r.height) };
  });
})()`)
if (!rowsBefore.some((row) => row.sel)) {
  const workspace = rowsBefore.find((row) => row.h <= 36) || rowsBefore[0]
  if (workspace) await press(workspace.x, workspace.y, 1200)
}

const sessionRow = await session.evaluate(`(() => {
  const tree = document.querySelector('[role="tree"]');
  if (!tree) return null;
  const row = [...tree.querySelectorAll('[role="treeitem"]')].find((n) => n.getAttribute('aria-selected') === 'false');
  if (!row) return null;
  const r = row.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), text: (row.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 30) };
})()`)
if (sessionRow) await press(sessionRow.x, sessionRow.y, 1600)
steps.push({ step: 'after selecting session ' + (sessionRow ? sessionRow.text : 'none'), state: await session.evaluate(probe) })

console.log(JSON.stringify(steps, null, 2))
session.close()
