/**
 * Paint-only background host. It is deliberately a plain DOM node, not a React
 * root: one node, inserted before `#root`, `pointer-events: none`, z-index 0.
 * `#root` keeps z-index 1 so nothing of the app is ever covered by paint.
 */
export const HOST_CLASS = 'dsh-hdd-background-host'

export function mountBackgroundHost(doc = document) {
  if (doc.querySelector(`body > .${HOST_CLASS}`)) {
    return () => unmountBackgroundHost(doc)
  }
  const host = doc.createElement('div')
  host.className = HOST_CLASS
  host.setAttribute('data-dsh-fairy-background-surface', '')
  host.setAttribute('aria-hidden', 'true')
  const root = doc.getElementById('root')
  if (root?.parentNode) root.parentNode.insertBefore(host, root)
  else doc.body.append(host)
  return () => unmountBackgroundHost(doc)
}

export function unmountBackgroundHost(doc = document) {
  for (const node of doc.querySelectorAll(`body > .${HOST_CLASS}`)) node.remove()
}
