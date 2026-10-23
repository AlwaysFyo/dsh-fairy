/**
 * Headless verification pass: navigate, settle, optionally enable HDD, then
 * capture a screenshot plus a structured DOM report.
 *
 * Usage: node tools/cdp/shoot.mjs <url> [out.png] [--no-hdd]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { openPage } from './client.mjs'

const [, , url, outFile = '.dsh-dev-home/shot.png', ...flags] = process.argv

if (!url) {
  console.error('usage: node tools/cdp/shoot.mjs <url> [out.png] [--no-hdd]')
  process.exit(1)
}

const wantHdd = !flags.includes('--no-hdd')

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

/* Make sure the HDD switch is in the state this run wants. */
const toggleResult = await session.evaluate(`(() => {
  const wantHdd = ${wantHdd}
  const on = document.documentElement.hasAttribute('data-dsh-fairy-visual')
  if (on === wantHdd) return { clicked: false, on }
  const button = document.querySelector('[data-dsh-fairy-hdd-toggle]')
  if (!button) return { clicked: false, on, missing: true }
  button.click()
  return { clicked: true, on }
})()`)

await new Promise((resolve) => setTimeout(resolve, 1500))

const report = await session.evaluate(`(() => {
  const count = (selector) => document.querySelectorAll(selector).length
  const pick = (selector) => {
    const node = selector ? document.querySelector(selector) : null
    if (!node) return null
    const style = getComputedStyle(node)
    const rect = node.getBoundingClientRect()
    return {
      bg: style.backgroundColor,
      image: style.backgroundImage.slice(0, 48),
      color: style.color,
      rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)],
    }
  }
  const markers = [...document.querySelectorAll('[data-dsh-fairy-sidebar-layer], [data-dsh-fairy-brand-anchor], [data-dsh-fairy-composer-seat]')].map((node) => {
    const rect = node.getBoundingClientRect()
    return {
      marks: [...node.attributes].map((a) => a.name).filter((n) => n.startsWith('data-dsh-fairy')),
      tag: node.tagName.toLowerCase(),
      rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)],
      bg: getComputedStyle(node).backgroundColor,
    }
  })
  return {
    attrs: {
      visual: document.documentElement.getAttribute('data-dsh-fairy-visual'),
      mode: document.documentElement.getAttribute('data-dsh-fairy-mode'),
      power: document.documentElement.getAttribute('data-dsh-fairy-power'),
    },
    counts: {
      'background-host': count('.dsh-hdd-background-host'),
      'fairy-root': count('#dsh-fairy-root'),
      stage: count('.dsh-fairy-stage'),
      'hdd-toggle': count('[data-dsh-fairy-hdd-toggle]'),
      'composer-card': count('[data-composer-card="true"]'),
      'composer-input': count('[data-composer-input="true"]'),
      'conversation-scroll': count('[data-conversation-scroll]'),
      'sidebar-layer': count('[data-dsh-fairy-sidebar-layer]'),
      transition: count('.dsh-hdd-mode-transition'),
      'style-tags': count('style[data-plugin="dsh-fairy-visual"]'),
    },
    paint: {
      body: pick('body'),
      root: pick('#root'),
      rootChild: pick('#root > div'),
      rootGrandchild: pick('#root > div > div'),
      scroll: pick('[data-conversation-scroll]'),
      composer: pick('[data-composer-card="true"]'),
      sidebar: pick('[data-dsh-fairy-sidebar-layer]'),
      host: pick('.dsh-hdd-background-host'),
    },
    markers,
    viewport: { w: innerWidth, h: innerHeight },
    errors: (globalThis.__DSH_FAIRY_PROBE__ && globalThis.__DSH_FAIRY_PROBE__.errors) || null,
  }
})()`)

const shot = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, Buffer.from(shot.data, 'base64'))
session.close()

console.log(JSON.stringify({ toggleResult, report, screenshot: outFile }, null, 2))
