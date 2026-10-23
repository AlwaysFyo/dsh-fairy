/**
 * Diffs the Fairy theme's live DOM against a reference instance.
 *
 *   node tools/cdp/parity.mjs <referenceUrl> <candidateUrl> [--tolerance=2]
 *
 * Both pages are measured with the same probe set, so a regression shows up as a
 * named mismatch instead of "looks off". Geometry is compared with a pixel
 * tolerance because a few layouts differ by a frame of measurement.
 */
import { openPage } from './client.mjs'

const [referenceUrl, candidateUrl, ...rest] = process.argv.slice(2)
if (!referenceUrl || !candidateUrl) {
  console.error('usage: node tools/cdp/parity.mjs <referenceUrl> <candidateUrl> [--tolerance=2]')
  process.exit(2)
}
const toleranceArg = rest.find((arg) => arg.startsWith('--tolerance='))
const TOLERANCE = toleranceArg ? Number(toleranceArg.split('=')[1]) : 2

const PROBE = `(() => {
  const round = (value) => (typeof value === 'number' ? Math.round(value) : value);
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [round(r.x), round(r.y), round(r.width), round(r.height)]; };
  const one = (sel) => document.querySelector(sel);
  const style = (el, property, pseudo) => (el ? getComputedStyle(el, pseudo || null).getPropertyValue(property).trim() : null);
  const css = (property) => style(document.body, property);
  const count = (sel) => document.querySelectorAll(sel).length;
  const labels = [...document.querySelectorAll('[data-slot="conversation.input.left"] [aria-label], [class*="input"] [aria-label]')]
    .map((el) => el.getAttribute('aria-label')).filter(Boolean);

  const heroHost = one('.dsh-fairy-hero-host');
  return {
    tokens: {
      'bg-base': css('--dsw-alias-bg-base'),
      'bg-layer-1': css('--dsw-alias-bg-layer-1'),
      'label-primary': css('--dsw-alias-label-primary'),
      'brand-primary': css('--dsw-alias-brand-primary'),
    },
    html: {
      visual: document.documentElement.hasAttribute('data-dsh-fairy-visual'),
      mode: document.documentElement.getAttribute('data-dsh-fairy-mode'),
      theme: document.documentElement.getAttribute('data-dsh-fairy-theme'),
      startupReset: document.documentElement.getAttribute('data-dsh-fairy-startup-reset'),
    },
    counts: {
      backgroundHost: count('.dsh-hdd-background-host'),
      hddFx: count('.dsh-hdd-fx'),
      glow: count('[class*="dsh-hdd-glow"]'),
      stage: count('.dsh-fairy-stage'),
      fairyRoot: count('#dsh-fairy-root'),
      bodyFairyRoot: count('body > #dsh-fairy-root'),
      composerCard: count('[data-composer-card="true"]'),
      voiceControl: count('[data-dsh-fairy-voice-control]'),
    },
    grid: {
      size: style(one('.dsh-hdd-fx'), 'background-size', '::before'),
      opacity: style(one('.dsh-hdd-fx'), 'opacity', '::before'),
    },
    geometry: {
      stage: rect(one('.dsh-fairy-stage')),
      eye: rect(one('#dsh-fairy-root')),
      sidebarLayer: rect(one('[data-dsh-fairy-sidebar-layer]')),
      sidebar: rect(one('[data-slot="sidebar"]') ? one('[data-slot="sidebar"]').firstElementChild : null),
      brandAnchor: rect(one('[data-dsh-fairy-brand-anchor]')),
      brandHost: rect(one('.dsh-fairy-brand-host')),
      newSession: rect(one('[data-dsh-fairy-native-new-session]')),
      heroToggle: rect(one('.dsh-fairy-hero-toggle-host')),
      powerHost: rect(one('.dsh-fairy-power-host')),
      card: rect(one('[data-composer-card="true"]')),
      seat: rect(one('[data-dsh-fairy-composer-seat]')),
      voiceControl: rect(one('[data-dsh-fairy-voice-control]')),
    },
    heroClip: heroHost ? { left: style(heroHost, 'left'), clip: style(heroHost, 'clip-path'), active: heroHost.dataset.active } : null,
    labels,
  };
})()`

const measure = async (url) => {
  const session = await openPage()
  await session.send('Runtime.enable')
  await session.navigate(url)
  await session.waitFor("document.querySelectorAll('[data-slot]').length > 20", { timeoutMs: 40000 })
  await new Promise((resolve) => setTimeout(resolve, 2500))
  const value = await session.evaluate(PROBE)
  session.close()
  return value
}

const flatten = (value, prefix = '', out = {}) => {
  if (value === null || typeof value !== 'object') {
    out[prefix] = value
    return out
  }
  if (Array.isArray(value)) {
    out[prefix] = JSON.stringify(value)
    return out
  }
  for (const [key, child] of Object.entries(value)) flatten(child, prefix ? `${prefix}.${key}` : key, out)
  return out
}

const similar = (a, b) => {
  if (a === b) return true
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= TOLERANCE
  if (typeof a === 'string' && typeof b === 'string' && a.startsWith('[') && b.startsWith('[')) {
    try {
      const left = JSON.parse(a)
      const right = JSON.parse(b)
      return left.length === right.length && left.every((item, index) => Math.abs(item - right[index]) <= TOLERANCE)
    } catch {
      return false
    }
  }
  return false
}

const reference = flatten(await measure(referenceUrl))
const candidate = flatten(await measure(candidateUrl))
const keys = [...new Set([...Object.keys(reference), ...Object.keys(candidate)])].sort()

const mismatches = []
for (const key of keys) {
  const left = reference[key]
  const right = candidate[key]
  if (similar(left, right)) continue
  mismatches.push({ key, reference: left, candidate: right })
}

console.log(`compared ${keys.length} probes, tolerance ${TOLERANCE}px, ${mismatches.length} mismatch(es)`)
for (const item of mismatches) {
  console.log(`- ${item.key}\n    reference: ${JSON.stringify(item.reference)}\n    candidate: ${JSON.stringify(item.candidate)}`)
}
process.exitCode = mismatches.length === 0 ? 0 : 1
