/**
 * Non-visual visual audit: contrast, opacity chains and geometry, computed in
 * the real page. Used because the agent cannot look at screenshots.
 *
 * Usage: node tools/cdp/audit.mjs <url> [--no-hdd]
 */
import { openPage } from './client.mjs'

const [, , url, ...flags] = process.argv
const wantHdd = !flags.includes('--no-hdd')
const scopeFlag = flags.find((flag) => flag.startsWith('--scope='))

const session = await openPage({ timeoutMs: 30000 })
await session.send('Page.enable')
await session.send('Runtime.enable')
await session.send('Emulation.setDeviceMetricsOverride', {
  width: 2040,
  height: 1200,
  deviceScaleFactor: 1,
  mobile: false,
})

await session.navigate(url)
await session.waitFor("document.querySelector('#root') && document.querySelector('[data-composer-card]')", {
  timeoutMs: 60000,
})
await new Promise((resolve) => setTimeout(resolve, 2500))

await session.evaluate(`(() => {
  const wantHdd = ${wantHdd}
  const on = document.documentElement.hasAttribute('data-dsh-fairy-visual')
  if (on !== wantHdd) document.querySelector('[data-dsh-fairy-hdd-toggle]')?.click()
  return true
})()`)
await new Promise((resolve) => setTimeout(resolve, 1200))

const report = await session.evaluate(`(() => {
  const parse = (value) => {
    const match = String(value).match(/rgba?\\(([^)]+)\\)/)
    if (!match) return null
    const parts = match[1].split(/[,/\\s]+/).filter(Boolean).map(Number)
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 }
  }
  const luminance = ({ r, g, b }) => {
    const channel = (v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }
  const contrast = (a, b) => {
    if (!a || !b) return null
    const la = luminance(a)
    const lb = luminance(b)
    return Math.round(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)) * 100) / 100
  }
  const blend = (top, bottom) => {
    if (!top || !bottom) return bottom
    const a = top.a
    return {
      r: Math.round(top.r * a + bottom.r * (1 - a)),
      g: Math.round(top.g * a + bottom.g * (1 - a)),
      b: Math.round(top.b * a + bottom.b * (1 - a)),
      a: 1,
    }
  }
  const effectiveBg = (node) => {
    let cursor = node
    let acc = null
    while (cursor && cursor !== document.documentElement.parentElement) {
      const bg = parse(getComputedStyle(cursor).backgroundColor)
      if (bg && bg.a > 0) {
        acc = acc ? blend(acc, bg) : bg
        if (acc.a >= 0.999) return acc
      }
      cursor = cursor.parentElement
    }
    return acc || { r: 21, g: 21, b: 23, a: 1 }
  }

  const worst = []
  const sidebar = document.querySelector(${JSON.stringify(scopeFlag ? scopeFlag.slice('--scope='.length) : '[data-dsh-fairy-sidebar-layer]')})
  const scope = sidebar || document.getElementById('root')
  if (scope) {
    for (const node of scope.querySelectorAll('*')) {
      const text = (node.textContent || '').trim()
      if (!text || text.length > 80) continue
      if (node.children.length > 0 && text !== node.textContent.trim()) continue
      const style = getComputedStyle(node)
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.05) continue
      const rect = node.getBoundingClientRect()
      if (rect.width < 4 || rect.height < 4) continue
      const color = parse(style.color)
      if (!color) continue
      const bg = effectiveBg(node)
      const fg = blend(color, bg)
      const ratio = contrast(fg, bg)
      worst.push({
        tag: node.tagName.toLowerCase(),
        cls: String(node.className || '').slice(0, 30),
        text: text.slice(0, 24),
        color: style.color,
        bg: 'rgb(' + bg.r + ', ' + bg.g + ', ' + bg.b + ')',
        ratio,
      })
    }
  }
  worst.sort((a, b) => (a.ratio ?? 99) - (b.ratio ?? 99))

  const tokens = {}
  const rootStyle = getComputedStyle(document.documentElement)
  for (const name of [
    '--dsw-alias-bg-base',
    '--dsw-alias-bg-layer-1',
    '--dsw-alias-label-primary',
    '--dsw-alias-label-secondary',
    '--dsw-alias-interactive-bg-hover',
  ]) {
    tokens[name] = rootStyle.getPropertyValue(name).trim()
  }

  return {
    attrs: {
      visual: document.documentElement.getAttribute('data-dsh-fairy-visual'),
      mode: document.documentElement.getAttribute('data-dsh-fairy-mode'),
    },
    tokens,
    lowContrast: worst.filter((item) => (item.ratio ?? 99) < 3).slice(0, 12),
    sampleContrast: worst.filter((item) => (item.ratio ?? 99) >= 3).slice(0, 5),
    hostVisible: (() => {
      const host = document.querySelector('.dsh-hdd-background-host')
      if (!host) return null
      const style = getComputedStyle(host)
      const rect = host.getBoundingClientRect()
      return { display: style.display, opacity: style.opacity, z: style.zIndex, rect: [rect.width, rect.height], image: style.backgroundImage.slice(0, 60) }
    })(),
  }
})()`)

session.close()
console.log(JSON.stringify(report, null, 2))
