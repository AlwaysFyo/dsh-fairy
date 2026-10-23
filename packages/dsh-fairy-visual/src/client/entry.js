/**
 * ESM entry for the client half.
 *
 * The ported source is CommonJS (`module.exports = { apply, inject, name }`) so it
 * can be dropped in unchanged; this file is the only place that adapts it to the
 * ESM entry shape rollup expects. `@rollup/plugin-commonjs` turns the default
 * import into the module's `exports` object.
 */
import visual from './index.js'

export const name = visual.name
export const inject = visual.inject
export const apply = visual.apply
