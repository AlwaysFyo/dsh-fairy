/**
 * ESM entry for the client half.
 *
 * The ported source is CommonJS (`module.exports = { apply, inject, name }`) so it
 * can be dropped in unchanged; this file is the only place that adapts it to the
 * ESM entry shape rollup expects. `@rollup/plugin-commonjs` turns the default
 * import into the module's `exports` object.
 *
 * `apply` also parks the plugin context on `globalThis.__dshFairyCtx` when
 * `localStorage['dsh-fairy:debug'] === '1'`. That is what the CDP probes use to
 * read the live service surface (`sessions`, `uiSession`, …) of a running page;
 * without it nothing outside the plugin can inspect those objects.
 */
import visual from './index.js'

export const name = visual.name
export const inject = visual.inject

const debugEnabled = () => {
  try {
    return globalThis.localStorage?.getItem('dsh-fairy:debug') === '1'
  } catch {
    return false
  }
}

export const apply = (ctx) => {
  if (debugEnabled()) {
    try {
      globalThis.__dshFairyCtx = ctx
    } catch {
      /* ignore */
    }
  }
  return visual.apply(ctx)
}
