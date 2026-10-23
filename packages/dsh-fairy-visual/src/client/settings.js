/**
 * Settings transport. The host half owns the file; the client only projects it.
 * Everything is same-origin and cookie-authenticated, so no token handling here.
 */
import { DEFAULT_SETTINGS, SCHEMA_VERSION, clampDockHeight } from 'dsh-fairy-contracts'

const SETTINGS_URL = '/dsh-fairy/settings'

export function normalize(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  if (source.version !== SCHEMA_VERSION) return { ...DEFAULT_SETTINGS }
  return {
    ...DEFAULT_SETTINGS,
    ...source,
    version: SCHEMA_VERSION,
    composerDockHeight: clampDockHeight(source.composerDockHeight, typeof innerWidth === 'number' ? innerWidth : 1280),
  }
}

export async function loadSettings() {
  try {
    const response = await fetch(SETTINGS_URL, { headers: { accept: 'application/json' } })
    if (!response.ok) return { ...DEFAULT_SETTINGS }
    return normalize(await response.json())
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(settings) {
  try {
    const response = await fetch(SETTINGS_URL, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(settings),
    })
    if (!response.ok) return { ok: false, status: response.status }
    return { ok: true, settings: normalize(await response.json()) }
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) }
  }
}

/**
 * Tiny external store so every slot component reads the same projection and
 * every write is optimistic with a host round-trip behind it.
 */
export function createSettingsStore(React) {
  let state = { ...DEFAULT_SETTINGS }
  const listeners = new Set()

  const emit = () => {
    for (const listener of listeners) listener()
  }

  const set = (patch, { persist = true } = {}) => {
    const next = normalize({ ...state, ...patch })
    state = next
    emit()
    if (persist) void saveSettings(next)
    return next
  }

  const subscribe = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  const getSnapshot = () => state

  const useSettings = () => React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return {
    get: getSnapshot,
    set,
    subscribe,
    useSettings,
    replace(next) {
      state = normalize(next)
      emit()
    },
    dispose() {
      listeners.clear()
    },
  }
}
