/** Read-only DOM helpers shared by the Fairy client plugins. */
import { ANCHORS, MARKERS } from './index.js'

/** Returns the first element matching the public semantic anchor, or null. */
export function findAnchor(doc, key) {
  const selector = ANCHORS[key]
  if (!selector) return null
  return doc.querySelector(selector)
}

/** Collects every anchor explicitly marked by the visual plugin. */
export function findMarker(doc, key) {
  const attr = MARKERS[key]
  if (!attr) return null
  return doc.querySelector(`[${attr}]`)
}

/** True when the HDD presentation is currently claimed on the document root. */
export function isHddActive(doc) {
  return doc.documentElement.getAttribute('data-dsh-fairy-mode') === 'hdd'
}
