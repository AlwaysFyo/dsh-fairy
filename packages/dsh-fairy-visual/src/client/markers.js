/**
 * Semantic marker projection.
 *
 * The official DOM is built from hashed CSS Modules class names, so the theme
 * never targets a class. Instead this controller projects a few short-lived
 * `data-dsh-fairy-*` attributes onto *real* semantic nodes it resolves from
 * public slot outlets and stable `data-*` anchors. Everything it writes is
 * tracked here and removed on dispose (and never written when the theme is off).
 */
export const MARKER_ATTRS = Object.freeze({
  sidebarLayer: 'data-dsh-fairy-sidebar-layer',
  sidebarSurface: 'data-dsh-fairy-sidebar-surface',
  brandAnchor: 'data-dsh-fairy-brand-anchor',
  composerSeat: 'data-dsh-fairy-composer-seat',
  composerHost: 'data-dsh-fairy-composer-host',
})

const SIDEBAR_SLOT = '[data-slot="sidebar"]'
const BRAND_SLOT = '[data-slot="sidebar.brand.mark"]'
const SEAT = '[data-composer-seat]'
const CARD = '[data-composer-card="true"]'
const COMPOSER_MAX_DEPTH = 6

/** First real box under a `display: contents` slot outlet. */
const outletChild = (doc, selector) => {
  const outlet = doc.querySelector(selector)
  if (!outlet) return null
  return outlet.firstElementChild ?? null
}

/**
 * A candidate is only accepted when its box really looks like the sidebar
 * column. The slot outlet is a layout-neutral wrapper, so its first child can
 * be the whole shell frame on some layouts; painting that would flood the app.
 */
const looksLikeSidebar = (element, doc) => {
  if (!element || typeof element.getBoundingClientRect !== 'function') return false
  const rect = element.getBoundingClientRect()
  const viewport = doc.defaultView?.innerWidth ?? 0
  if (!rect.width || !rect.height) return false
  if (viewport && rect.width > viewport * 0.45) return false
  return true
}

export function createMarkers(doc = document) {
  /** element -> Set of attribute names this controller wrote */
  const written = new Map()
  let frame = 0

  const write = (element, attr) => {
    if (!element) return
    let attrs = written.get(element)
    if (!attrs) {
      attrs = new Set()
      written.set(element, attrs)
    }
    if (attrs.has(attr)) return
    element.setAttribute(attr, '')
    attrs.add(attr)
  }

  const prune = (keep) => {
    for (const [element, attrs] of [...written]) {
      if (!keep.has(element)) {
        for (const attr of attrs) element.removeAttribute(attr)
        written.delete(element)
        continue
      }
      for (const attr of [...attrs]) {
        if (keep.get(element)?.has(attr)) continue
        element.removeAttribute(attr)
        attrs.delete(attr)
      }
      if (attrs.size === 0) written.delete(element)
    }
  }

  const project = () => {
    frame = 0
    if (!doc.documentElement.hasAttribute('data-dsh-fairy-visual')) {
      prune(new Map())
      return
    }
    /** element -> Set of attributes that must stay */
    const keep = new Map()
    const want = (element, attr) => {
      if (!element) return
      let attrs = keep.get(element)
      if (!attrs) {
        attrs = new Set()
        keep.set(element, attrs)
      }
      attrs.add(attr)
      write(element, attr)
    }

    const sidebar = outletChild(doc, SIDEBAR_SLOT)
    if (looksLikeSidebar(sidebar, doc)) {
      want(sidebar, MARKER_ATTRS.sidebarLayer)
      want(sidebar, MARKER_ATTRS.sidebarSurface)
    }

    want(outletChild(doc, BRAND_SLOT), MARKER_ATTRS.brandAnchor)

    for (const seat of doc.querySelectorAll(SEAT)) want(seat, MARKER_ATTRS.composerSeat)

    /* The official composer is capped at a centred reading width. HDD owns the
       full conversation rect, so every real box between the card and the seat
       is projected too; `display: contents` outlets generate no box and are
       skipped so the marker always lands on something that can be styled. */
    const card = doc.querySelector(CARD)
    if (card) {
      let node = card.parentElement
      for (let depth = 0; node && depth < COMPOSER_MAX_DEPTH; depth += 1) {
        if (node === doc.body || node.hasAttribute('data-composer-seat')) break
        let display = ''
        try {
          display = doc.defaultView?.getComputedStyle(node)?.display ?? ''
        } catch {
          display = ''
        }
        if (display && display !== 'contents') want(node, MARKER_ATTRS.composerHost)
        node = node.parentElement
      }
    }

    prune(keep)
  }

  const schedule = () => {
    if (frame) return
    frame = requestAnimationFrame(project)
  }

  const observer = new MutationObserver(schedule)
  const target = doc.body ?? doc.documentElement
  observer.observe(target, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-slot', 'data-phase', 'data-dsh-fairy-visual'],
  })

  schedule()

  return {
    project: schedule,
    dispose() {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      prune(new Map())
    },
  }
}
