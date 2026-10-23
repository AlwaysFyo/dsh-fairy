/**
 * Reports how the settings panel is reached in this build and audits the Fairy section.
 *
 *   node tools/cdp/settings-audit.mjs <url> [--section=Fairy]
 *
 * The launcher lives behind the sidebar account menu, so the audit walks that
 * path: account menu -> settings item -> Fairy section, printing a compact
 * report at each hop instead of dumping DOM text (a style element would swamp it).
 */
import { openPage } from './client.mjs'

const args = process.argv.slice(2)
const url = args.find((arg) => !arg.startsWith('--'))
const sectionFlag = args.find((arg) => arg.startsWith('--section='))
const SECTION = sectionFlag ? sectionFlag.split('=')[1] : 'Fairy'

if (!url) {
  console.error('usage: node tools/cdp/settings-audit.mjs <url> [--section=Fairy]')
  process.exit(2)
}

const session = await openPage()
await session.send('Runtime.enable')

const clickLabel = async (fragment, settleMs = 900) => {
  const box = await session.evaluate(`(() => {
    const fragment = ${JSON.stringify(fragment)};
    const el = [...document.querySelectorAll('button, [role="button"], [role="menuitem"], [role="option"], [role="tab"]')]
      .find((node) => { const r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0 && ((node.getAttribute('aria-label') || '') + ' ' + (node.textContent || '')).includes(fragment); });
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), label: ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).replace(/\\s+/g, ' ').trim().slice(0, 24) };
  })()`)
  if (!box) return null
  const press = { x: box.x, y: box.y, button: 'left', clickCount: 1 }
  await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y })
  await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...press })
  await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...press })
  await new Promise((resolve) => setTimeout(resolve, settleMs))
  return box
}

const menu = async () => session.evaluate(`(() => {
  const short = (el) => ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).replace(/\\s+/g, ' ').trim().slice(0, 24);
  const items = [...document.querySelectorAll('[role="menu"] [role="menuitem"], [role="menu"] button, [role="listbox"] [role="option"], [data-slot="settings.launcher"] button, [data-slot="settings.launcher"] [role="button"]')]
    .map((el) => { const r = el.getBoundingClientRect(); return { label: short(el), rect: r.width > 0 ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null }; })
    .filter((item) => item.label);
  return [...new Map(items.map((item) => [item.label, item])).values()].slice(0, 20);
})()`)

await session.navigate(url)
await session.waitFor("document.querySelectorAll('[data-slot]').length > 20", { timeoutMs: 40000 })
await new Promise((resolve) => setTimeout(resolve, 1200))

// The settings panel has a dedicated shortcut (shown as "设置 Ctrl + Alt + ," in the
// account menu), which is far more reliable to automate than a two-hop menu walk.
const CTRL_ALT = 3
await session.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers: CTRL_ALT, key: ',', code: 'Comma', windowsVirtualKeyCode: 188, nativeVirtualKeyCode: 188 })
await session.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: CTRL_ALT, key: ',', code: 'Comma', windowsVirtualKeyCode: 188, nativeVirtualKeyCode: 188 })
await new Promise((resolve) => setTimeout(resolve, 1200))
const shortcutOpened = await session.evaluate("!!document.querySelector('[data-slot=\"settings.section\"]')")

let accountClick = null
let afterAccount = null
let settingsClick = null
if (!shortcutOpened) {
  accountClick = await clickLabel('更多', 700)
  afterAccount = await menu()
  settingsClick = afterAccount.length ? await clickLabel('设置', 1200) : null
}
const afterSettings = shortcutOpened ? [] : await menu()

const report = await session.evaluate(`(() => {
  const short = (el) => ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).replace(/\\s+/g, ' ').trim().slice(0, 26);
  const section = ${JSON.stringify(SECTION)};
  const panelOpen = !!document.querySelector('[data-slot="settings.section"]');
  const tabs = panelOpen
    ? [...new Set([...document.querySelectorAll('[data-slot="settings.section"] button, [data-slot="settings.section"] [role="tab"], [data-slot="settings.section"] a')]
        .map(short).filter((text) => text && text.length < 27))].slice(0, 24)
    : [];
  const fairyIndex = tabs.findIndex((text) => text.includes(section));
  return {
    panelOpen,
    tabs,
    fairyTab: fairyIndex >= 0 ? tabs[fairyIndex] : null,
    controls: panelOpen ? [...new Set([...document.querySelectorAll('[data-slot="settings.section"] [role="switch"], [data-slot="settings.section"] input, [data-slot="settings.section"] button')]
      .map(short).filter((text) => text && text.length < 27))].slice(0, 30) : [],
  };
})()`)

console.log(JSON.stringify({ shortcutOpened, afterSettings, report }, null, 2))
session.close()

