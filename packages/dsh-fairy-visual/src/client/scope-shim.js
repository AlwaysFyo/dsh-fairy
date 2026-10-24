/**
 * Settings handle for the ported visual code.
 *
 * The reference implementation binds `ctx.settingsScope.bind({ namespace })` and
 * only ever uses three members: `getSnapshot()` (whose `.value` is the persisted
 * object), `subscribe(listener)` and `set(field, value)`. The 0.2.1 browser
 * runtime no longer exposes a settings service, so this module reproduces that
 * exact surface on top of this plugin's own host route:
 *
 *   GET  /dsh-fairy/settings?ns=<namespace>  -> { ok, namespace, value }
 *   PUT  /dsh-fairy/settings?ns=<namespace>  { value } -> { ok, namespace, value }
 *
 * The host stays authoritative: every write echoes the normalized document back
 * and the handle adopts it, so a rejected or migrated value cannot linger in the
 * UI. Reads and writes never block rendering; the first snapshot carries
 * `status: 'loading'` so `syncDocumentMode` keeps the document untouched until
 * the persisted value is known.
 */

const SETTINGS_ROUTE = '/dsh-fairy/settings'

function scopeUrl(namespace) {
  return `${SETTINGS_ROUTE}?ns=${encodeURIComponent(namespace)}`
}

function readValue(payload) {
  if (!payload || typeof payload !== 'object') return null
  if (payload.value && typeof payload.value === 'object') return payload.value
  if (payload.settings && typeof payload.settings === 'object') return payload.settings
  if (!('ok' in payload) && !('namespace' in payload)) return payload
  return null
}

function createSettingsHandle(namespace) {
  let snapshot = { value: {}, status: 'loading' }
  const listeners = new Set()
  let disposed = false

  const emit = () => {
    for (const listener of [...listeners]) {
      if (disposed) return
      try {
        listener(snapshot)
      } catch (error) {
        console.error('[dsh-fairy] settings listener failed', error)
      }
    }
  }

  const adopt = (value) => {
    snapshot = { value: value && typeof value === 'object' ? value : {} }
    emit()
    // Broadcast on the document so sibling plugins (balance meter, voice…) can
    // follow the visual switch without polling the settings route.
    if (typeof document !== 'undefined' && typeof CustomEvent === 'function' && document.documentElement) {
      document.documentElement.dispatchEvent(new CustomEvent('dsh-fairy-settings', { bubbles: false, detail: { namespace, value: snapshot.value } }))
    }
    return snapshot.value
  }

  const load = () =>
    fetch(scopeUrl(namespace), { credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`settings ${response.status}`))))
      .then((payload) => (disposed ? snapshot.value : adopt(readValue(payload))))
      .catch((error) => {
        if (disposed) return snapshot.value
        snapshot = { value: {}, status: 'error' }
        emit()
        console.error(`[dsh-fairy] settings load failed (${namespace})`, error)
        return snapshot.value
      })

  const set = (field, value) => {
    const next = { ...(snapshot.value || {}), [field]: value }
    snapshot = { value: next }
    emit()
    return fetch(scopeUrl(namespace), {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ value: next }),
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`settings ${response.status}`))))
      .then((payload) => adopt(readValue(payload) ?? next))
      .catch((error) => {
        console.error(`[dsh-fairy] settings write failed (${namespace}, ${field})`, error)
        throw error
      })
  }

  const handle = {
    namespace,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set,
    reload: load,
    dispose() {
      disposed = true
      listeners.clear()
    },
  }

  load()
  return handle
}

module.exports = { createSettingsHandle, SETTINGS_ROUTE }
