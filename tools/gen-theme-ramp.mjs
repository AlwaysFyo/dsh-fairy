/**
 * Generate the HDD neutral ramp from the official light-theme static ramp.
 *
 * Why: the Fairy theme paints a dark HDD interface over an application whose
 * stock theme is light. Every official alias token resolves through the
 * `--dsw-static-neutral-*` ramp, so inverting that ramp once — instead of
 * patching surfaces one by one at runtime — flips every surface and every label
 * the application renders. Chromatic ramps (blue/red/green/amber/deepseek) are
 * left alone: they read correctly on both schemes.
 *
 * Rule: keep hue and saturation, invert lightness, and re-tint near-neutral
 * colors toward the Fairy void blue so all surfaces read as one material.
 *
 * Usage: node tools/gen-theme-ramp.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..')
const themeSource = join(
  repo,
  'node_modules',
  '@deepseek-ai',
  'dsh-client-ui-theme',
  'lib',
  'client.js',
)
const outFile = join(repo, 'packages', 'dsh-fairy-next-visual', 'src', 'client', 'tokens.generated.js')

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function parseColor(raw) {
  const value = String(raw).trim()
  let match = /^#([0-9a-f]{3,8})$/i.exec(value)
  if (match) {
    let hex = match[1]
    if (hex.length === 3 || hex.length === 4) hex = hex.split('').map((c) => c + c).join('')
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    }
  }
  match = /^rgba?\(([^)]+)\)$/i.exec(value)
  if (match) {
    const parts = match[1].split(/[,/\s]+/).filter(Boolean).map(Number)
    if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 }
    }
  }
  return null
}

function rgbToHsl({ r, g, b }) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
  else if (max === gn) h = ((bn - rn) / d + 2) * 60
  else h = ((rn - gn) / d + 4) * 60
  return { h, s, l }
}

function hslToRgb({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const table =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  return table.map((channel) => Math.round((channel + m) * 255))
}

function toHex(rgb, alpha) {
  const hex = rgb.map((v) => v.toString(16).padStart(2, '0')).join('')
  if (alpha >= 0.999) return `#${hex}`
  return `#${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`
}

/** Invert lightness, keep hue, tint near-neutrals toward the Fairy accent hue. */
function invertNeutral(raw) {
  const color = parseColor(raw)
  if (!color) return null
  const { h, s, l } = rgbToHsl(color)
  const inverted = clamp(1 - l, 0.045, 0.955)
  const neutral = s < 0.12
  const hue = neutral ? 205 : h
  const saturation = neutral ? (inverted < 0.4 ? 0.3 : 0.14) : clamp(s, 0, 0.8)
  return toHex(hslToRgb({ h: hue, s: saturation, l: inverted }), color.a)
}

const source = readFileSync(themeSource, 'utf8')
const start = source.indexOf('body{--dsw-static-')
if (start < 0) throw new Error('official static block not found — theme package layout changed?')
const end = source.indexOf('}', start)
const block = source.slice(start + 'body{'.length, end)

const statics = {}
for (const declaration of block.split(';')) {
  const index = declaration.indexOf(':')
  if (index < 0) continue
  const name = declaration.slice(0, index).trim()
  const value = declaration.slice(index + 1).trim()
  if (!name.startsWith('--dsw-static-') || !value) continue
  statics[name] = value
}

const neutral = Object.entries(statics).filter(([name]) => /--dsw-static-neutral(-bluish)?-/.test(name))
const generated = {}
for (const [name, value] of neutral) {
  const inverted = invertNeutral(value)
  generated[name] = inverted ?? value
}

const lines = Object.entries(generated)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([name, value]) => `  '${name}': '${value}',`)
  .join('\n')

const banner = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Source: node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js
 *         (${Object.keys(statics).length} official static tokens, ${neutral.length} neutral)
 * Regenerate: node tools/gen-theme-ramp.mjs
 *
 * The HDD interface is dark while the stock application theme is light. Every
 * official alias token resolves through this neutral ramp, so inverting the
 * ramp flips surfaces and labels together and no white surface can leak
 * through a component that re-declares its own fill.
 */
export const HDD_STATICS = Object.freeze({
${lines}
})
`

writeFileSync(outFile, banner)
console.log(`generated ${Object.keys(generated).length} neutral statics -> ${outFile}`)
