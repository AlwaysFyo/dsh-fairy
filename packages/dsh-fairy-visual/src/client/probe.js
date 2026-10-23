/**
 * Development probe. Not a product surface: it answers "is this runtime really
 * what we think it is" from inside the real browser and posts the answer back to
 * the host half (`POST /dsh-fairy/report`), which is the only way to observe a
 * client plugin from the terminal in this environment.
 */
import * as React from 'react'
import { MODE_ATTR, VISUAL_ATTR } from 'dsh-fairy-contracts'

const h = React.createElement

const CANDIDATE_SLOTS = [
  'shell.overlay',
  'conversation.session.header.utilities',
  'conversation.session.header.actions',
  'settings.section',
  'sidebar.footer.action',
  'conversation.input.left',
  'conversation.composer.dock',
  'conversation.input.dock',
  'conversation.hero.workspace',
  'conversation.input.attachments',
  'shell.bottom',
]

const CANDIDATE_SERVICES = [
  'slots',
  'sessions',
  'uiSession',
  'settingsScope',
  'settings',
  'locale',
  'connection',
  'remote',
  'layout',
  'theme',
  'commands',
  'uiWorkspace',
  'workspaces',
  'resources',
]

const describe = (value) => {
  if (value === undefined) return 'missing'
  if (value === null) return 'null'
  if (typeof value === 'function') return 'function'
  if (typeof value !== 'object') return typeof value
  try {
    return `object{${Object.keys(value).slice(0, 20).join(',')}}`
  } catch {
    return 'object'
  }
}

const safeGet = (ctx, key) => {
  try {
    return ctx?.get?.(key)
  } catch {
    return undefined
  }
}

function probeServices(ctx) {
  const out = {}
  for (const key of CANDIDATE_SERVICES) out[key] = describe(safeGet(ctx, key))
  return out
}

function probeSlots(ctx) {
  const out = {}
  for (const slot of CANDIDATE_SLOTS) {
    try {
      const entries = ctx?.slots?.entries?.(slot)
      out[slot] = Array.isArray(entries) ? `entries=${entries.length}` : describe(entries)
    } catch (error) {
      out[slot] = `error: ${error?.message ?? error}`
    }
  }
  return out
}

const DOM_SELECTORS = [
  '[data-conversation-scroll]',
  '[data-input-scroll="true"]',
  '[data-composer-card="true"]',
  '[data-composer-input="true"]',
  '[data-composer-seat]',
  '[data-composer-dock]',
  '[data-shell-overlay]',
  '[data-slot="shell.overlay"]',
  '[data-slot="conversation.session.header.utilities"]',
  '[data-slot="settings.section"]',
  '[data-dsh-fairy-hdd-toggle]',
  '[data-dsh-fairy-stage]',
  '[role="tree"][aria-label="会话"]',
  '[data-chat-flow]',
  '.toBottomSlot',
  'textarea',
  '.dsh-hdd-background-host',
  '#dsh-fairy-root',
]

function probeShapes(ctx) {
  const describeSurface = (value) => {
    if (!value || typeof value !== 'object') return describe(value)
    const keys = []
    let cursor = value
    for (let depth = 0; cursor && depth < 3; depth += 1) {
      for (const key of Object.keys(cursor)) {
        const member = cursor[key]
        if (typeof member === 'function') keys.push(`${key}()`)
        else if (typeof member === 'undefined') keys.push(`${key}?`)
      }
      cursor = Object.getPrototypeOf(cursor)
    }
    return [...new Set(keys)].slice(0, 60)
  }

  const out = {}
  for (const service of ['workspaces', 'uiWorkspace', 'uiSession', 'sessions']) {
    try {
      out[service] = describeSurface(ctx?.get ? ctx.get(service) : undefined)
    } catch (error) {
      out[service] = `error: ${error?.message ?? error}`
    }
  }
  return out
}

function probeDom() {
  const out = { selectors: {} }
  if (typeof document === 'undefined') return out
  out.readyState = document.readyState
  for (const selector of DOM_SELECTORS) {
    try {
      out.selectors[selector] = document.querySelectorAll(selector).length
    } catch (error) {
      out.selectors[selector] = `error: ${error?.message ?? error}`
    }
  }
  out.attrs = {
    visual: document.documentElement.getAttribute(VISUAL_ATTR),
    mode: document.documentElement.getAttribute(MODE_ATTR),
  }
  out.bodyChildren = Array.prototype.map
    .call(document.body.children, (node) => node.id || `${node.className || node.tagName}`.slice(0, 40))
    .slice(0, 12)
  return out
}

const describeNode = (node, depth) => {
  if (!node) return null
  const attrs = []
  for (const attribute of node.attributes ?? []) {
    attrs.push(attribute.value ? `${attribute.name}=${attribute.value.slice(0, 36)}` : attribute.name)
  }
  return {
    tag: node.tagName?.toLowerCase?.() ?? 'node',
    attrs,
    bg: typeof getComputedStyle === 'function' ? getComputedStyle(node).backgroundColor : null,
    children: depth > 0 ? [...(node.children ?? [])].slice(0, 5).map((child) => describeNode(child, depth - 1)) : undefined,
  }
}

function probeTree() {
  if (typeof document === 'undefined') return null
  return describeNode(document.getElementById('root'), 2)
}

function probeMarkers() {
  if (typeof document === 'undefined') return null
  const out = []
  const selector =
    '[data-dsh-fairy-sidebar-layer], [data-dsh-fairy-sidebar-surface], [data-dsh-fairy-brand-anchor], [data-dsh-fairy-composer-seat]'
  for (const node of document.querySelectorAll(selector)) {
    const rect = node.getBoundingClientRect()
    const style = getComputedStyle(node)
    out.push({
      marks: [...node.attributes].map((a) => a.name).filter((n) => n.startsWith('data-dsh-fairy')),
      tag: node.tagName.toLowerCase(),
      cls: String(node.className || '').slice(0, 40),
      rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)],
      bg: style.backgroundColor,
    })
  }
  return out
}

function probePaint() {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return null
  const pick = (selector) => {
    const node = selector ? document.querySelector(selector) : null
    if (!node) return null
    const style = getComputedStyle(node)
    return { bg: style.backgroundColor, image: style.backgroundImage.slice(0, 40), color: style.color, z: style.zIndex }
  }
  return {
    body: pick('body'),
    root: pick('#root'),
    rootChild: pick('#root > div'),
    rootGrandchild: pick('#root > div > div'),
    phase: pick('[data-phase]'),
    scroll: pick('[data-conversation-scroll]'),
    composer: pick('[data-composer-card="true"]'),
    backgroundHost: pick('.dsh-hdd-background-host'),
    tokens: {
      base: getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-bg-base').trim(),
      layer1: getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-bg-layer-1').trim(),
      label: getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-label-primary').trim(),
    },
  }
}

export function createProbe(ctx) {
  const report = {
    plugin: 'fairy-visual',
    at: new Date().toISOString(),
    boot: (() => {
      const boot = globalThis.__DSH_BOOT__
      return boot ? { version: boot.release?.version ?? boot.version ?? null, rev: boot.rev ?? null } : null
    })(),
    services: probeServices(ctx),
    slots: probeSlots(ctx),
    dom: probeDom(),
    paint: probePaint(),
    tree: probeTree(),
    viewport: { w: typeof innerWidth === 'number' ? innerWidth : null, h: typeof innerHeight === 'number' ? innerHeight : null },
  }

  const send = (payload, phase) => {
    try {
      if (typeof fetch !== 'function') return
      void fetch('/dsh-fairy/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, phase }),
      }).catch(() => {})
    } catch {
      /* best effort */
    }
  }

  send(report, 'apply')
  const timer = setTimeout(
    () =>
      send(
        {
          ...report,
          dom: probeDom(),
          paint: probePaint(),
          tree: probeTree(),
          markers: probeMarkers(),
          shapes: probeShapes(ctx),
          services: probeServices(ctx),
          slots: probeSlots(ctx),
        },
        'settled',
      ),
    3500,
  )

  globalThis.__DSH_FAIRY_PROBE__ = report
  try {
    console.info('[fairy-probe]', report)
  } catch {
    /* console unavailable */
  }

  function ProbePanel() {
    return h(
      'div',
      {
        'data-dsh-fairy-probe': '',
        style: {
          position: 'fixed',
          left: 12,
          bottom: 12,
          width: 420,
          maxHeight: '60vh',
          overflow: 'auto',
          zIndex: 20,
          font: '11px/1.45 ui-monospace, Menlo, monospace',
          color: '#d8f6ff',
          background: 'rgba(4,12,20,0.94)',
          border: '1px solid #1d4a63',
          borderRadius: 8,
          padding: 10,
          pointerEvents: 'auto',
        },
      },
      h('pre', { style: { margin: 0, whiteSpace: 'pre-wrap' } }, JSON.stringify(report, null, 1).slice(0, 6000)),
    )
  }

  return {
    ProbePanel,
    dispose() {
      clearTimeout(timer)
    },
  }
}
