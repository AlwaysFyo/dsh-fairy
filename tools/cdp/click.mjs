/**
 * Clicks a control with real CDP mouse events and optionally probes the result.
 *
 *   node tools/cdp/click.mjs <url> <selector|labelFragment> [--probe=file.js] [--wait=expr] [--settle=ms]
 *
 * Synthetic `element.click()` is ignored by some React handlers, so this drives
 * the mouse the way a person would. A selector is anything starting with `[`,
 * `#`, `.`, or `(`; anything else is matched against accessible labels/text.
 */
import { readFile } from 'node:fs/promises'
import { openPage } from './client.mjs'

const args = process.argv.slice(2)
const positional = args.filter((arg) => !arg.startsWith('--'))
const flag = (name, fallback) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const [url, target] = positional
if (!url || !target) {
  console.error('usage: node tools/cdp/click.mjs <url> <selector|labelFragment> [--probe=file.js] [--wait=expr] [--settle=ms]')
  process.exit(2)
}

const isSelector = /^[.#[(]/.test(target)
const settleMs = Number(flag('settle', '1200'))
const waitExpr = flag('wait', "!!document.querySelector('[data-composer-card]')")
const probeFile = flag('probe', null)

const session = await openPage()
await session.send('Runtime.enable')
await session.navigate(url)
await session.waitFor(waitExpr, { timeoutMs: 40000 })

const located = await session.evaluate(`(() => {
  const target = ${JSON.stringify(target)};
  const isSelector = ${JSON.stringify(isSelector)};
  const candidates = isSelector
    ? [...document.querySelectorAll(target)]
    : [...document.querySelectorAll('button, a, [role="button"], [role="menuitem"], [role="tab"]')]
      .filter((node) => ((node.getAttribute('aria-label') || '') + ' ' + (node.textContent || '')).includes(target));
  const el = candidates.find((node) => { const r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: Math.round(r.x + r.width / 2),
    y: Math.round(r.y + r.height / 2),
    label: (el.getAttribute('aria-label') || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40),
    matches: candidates.length,
  };
})()`)

if (!located) {
  console.log(JSON.stringify({ clicked: false, reason: `no visible control for ${target}` }))
  session.close()
  process.exit(1)
}

const press = { x: located.x, y: located.y, button: 'left', clickCount: 1 }
await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: located.x, y: located.y })
await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...press })
await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...press })
await new Promise((resolve) => setTimeout(resolve, settleMs))

const probe = probeFile ? await readFile(probeFile, 'utf8') : null
const result = probe ? await session.evaluate(probe) : null
console.log(JSON.stringify({ clicked: true, located, probeFile: probeFile || null, result }, null, 2))
session.close()
