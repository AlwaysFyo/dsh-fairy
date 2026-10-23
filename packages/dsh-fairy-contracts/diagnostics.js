/**
 * Diagnostics boundary shared by the Fairy host and client halves.
 * Callers pass in their own logger so this module owns no transport.
 */
export function createFairyDiagnostics({ scope, enabled = false, sink } = {}) {
  const emit = (level, message, detail) => {
    const record = { scope, level, message, at: new Date().toISOString() }
    if (detail !== undefined) record.detail = detail
    if (typeof sink === 'function') sink(record)
    if (level === 'warn' && typeof console !== 'undefined' && console.warn) console.warn(`[${scope}] ${message}`, detail ?? '')
    if (level === 'error' && typeof console !== 'undefined' && console.error) console.error(`[${scope}] ${message}`, detail ?? '')
  }
  return {
    get enabled() {
      return enabled
    },
    info: (message, detail) => emit('info', message, detail),
    warn: (message, detail) => emit('warn', message, detail),
    error: (message, detail) => emit('error', message, detail),
  }
}
