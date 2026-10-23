/**
 * Exercises the Fairy settings toggles and reports the state each one changes.
 *
 *   node tools/cdp/settings-toggles.mjs <url>
 *
 * Opens the settings panel, clicks each labelled toggle, records a compact state
 * snapshot, then clicks it again so the profile is left as it was found.
 */
import { openPage } from './client.mjs'

const url = process.argv.find((arg) => !arg.startsWith('--'))
if (!url) {
  console.error('usage: node tools/cdp/settings-toggles.mjs <url>')
  process.exit(2)
}

const TOGGLES = ['切换到日间模式', '切换到夜间模式', '开启省电模式', '关闭省电模式', '隐藏 Fairy 主视觉', '显示 Fairy 主视觉']

const SNAPSHOT = `(() => {
  const css = (property) => getComputedStyle(document.body).getPropertyValue(property).trim();
  const mascot = document.querySelector('[data-dsh-fairy-mascot-root="true"]');
  const lash = document.querySelector('[data-dsh-fairy-mascot-root="true"] .dsh-fairy-corners');
  return {
    theme: document.documentElement.getAttribute('data-dsh-fairy-theme'),
    mode: document.documentElement.getAttribute('data-dsh-fairy-mode'),
    power: document.documentElement.getAttribute('data-dsh-fairy-power-mode'),
    lowPowerAttr: mascot ? mascot.hasAttribute('data-low-power') : null,
    mascotDisplay: mascot ? getComputedStyle(mascot).display : null,
    lashAnimation: lash ? getComputedStyle(lash).animationName : null,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    bgBase: css('--dsw-alias-bg-base'),
    labelPrimary: css('--dsw-alias-label-primary'),
  };
})()`

const session = await openPage()
await session.send('Runtime.enable')

const clickLabel = async (fragment) => {
  const box = await session.evaluate(`(() => {
    const fragment = ${JSON.stringify(fragment)};
    const el = [...document.querySelectorAll('button, [role="button"], [role="menuitem"], [role="switch"], [role="tab"]')]
      .find((node) => { const r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0 && ((node.getAttribute('aria-label') || '') + ' ' + (node.textContent || '')).includes(fragment); });
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`)
  if (!box) return false
  const press = { x: box.x, y: box.y, button: 'left', clickCount: 1 }
  await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y })
  await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...press })
  await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...press })
  await new Promise((resolve) => setTimeout(resolve, 900))
  return true
}

await session.navigate(url)
await session.waitFor("document.querySelectorAll('[data-slot]').length > 20", { timeoutMs: 40000 })
await new Promise((resolve) => setTimeout(resolve, 1200))
await clickLabel('更多')
await clickLabel('设置')

const baseline = await session.evaluate(SNAPSHOT)
const results = []
for (const label of TOGGLES) {
  const clicked = await clickLabel(label)
  if (!clicked) {
    results.push({ label, clicked: false })
    continue
  }
  const state = await session.evaluate(SNAPSHOT)
  results.push({ label, clicked: true, state })
}

await session.evaluate(`(() => { const close = document.querySelector('[data-slot="settings.close"] button'); if (close) close.click(); return true })()`)
console.log(JSON.stringify({ baseline, results }, null, 2))
session.close()
