window.__ModuleLoader__.load({
	id: "dsh-fairy-visual",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
'use strict';

Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

const React = require('react');

function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: 'Module' } });
  if (e) {
    for (const k in e) {
      if (k !== 'default') {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return n;
}

const React__namespace = /*#__PURE__*/_interopNamespaceDefault(React);

/**
 * Cross-plugin contract constants. Immutable values only: no DOM, no network,
 * no timers, no persistence. Every other Fairy package imports from here so the
 * document attributes and settings shape cannot drift apart.
 */


/** Persisted settings schema version. A mismatch is rejected, never migrated silently. */
const SCHEMA_VERSION = 2;

/** Root CSS gate: every Fairy style is scoped under this attribute. */
const VISUAL_ATTR = 'data-dsh-fairy-visual';

/** ``hdd`` while the Fairy HDD presentation is active, removed in normal mode. */
const MODE_ATTR = 'data-dsh-fairy-mode';

/** Composer dock geometry, in CSS pixels. */
const COMPOSER_DOCK = Object.freeze({ min: 132, max: 420, narrowMin: 260, narrowWidth: 600 });

const DEFAULT_SETTINGS = Object.freeze({
  version: SCHEMA_VERSION,
  enabled: false,
  theme: 'dark',
  mascotVisible: true,
  powerMode: 'normal',
  composerDockHeight: COMPOSER_DOCK.min,
  accent: 'fairy-blue',
  diagnostics: false,
  coexistence: 'auto',
});

/** Clamps a persisted dock height to the geometry the viewport allows. */
function clampDockHeight(value, viewportWidth) {
  const min = viewportWidth < COMPOSER_DOCK.narrowWidth ? COMPOSER_DOCK.narrowMin : COMPOSER_DOCK.min;
  if (!Number.isFinite(value)) return min
  return Math.min(COMPOSER_DOCK.max, Math.max(min, Math.round(value)))
}

/**
 * GENERATED FILE — do not edit by hand.
 *
 * Source: node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js
 *         (77 official static tokens, 35 neutral)
 * Regenerate: node tools/gen-theme-ramp.mjs
 *
 * The HDD interface is dark while the stock application theme is light. Every
 * official alias token resolves through this neutral ramp, so inverting the
 * ramp flips surfaces and labels together and no white surface can leak
 * through a component that re-declares its own fill.
 */
const HDD_STATICS = Object.freeze({
  '--dsw-static-neutral-00': '#080c0f',
  '--dsw-static-neutral-100': '#080c0f',
  '--dsw-static-neutral-1000': '#f2f4f5',
  '--dsw-static-neutral-150': '#0d1317',
  '--dsw-static-neutral-200': '#121b22',
  '--dsw-static-neutral-250': '#18252d',
  '--dsw-static-neutral-300': '#1e2d38',
  '--dsw-static-neutral-400': '#406076',
  '--dsw-static-neutral-50': '#080c0f',
  '--dsw-static-neutral-500': '#6b7f8d',
  '--dsw-static-neutral-550': '#8899a6',
  '--dsw-static-neutral-600': '#9eabb5',
  '--dsw-static-neutral-700': '#bac4cb',
  '--dsw-static-neutral-800': '#d0d7dc',
  '--dsw-static-neutral-850': '#d8dee2',
  '--dsw-static-neutral-900': '#eef0f2',
  '--dsw-static-neutral-bluish-00': '#080c0f',
  '--dsw-static-neutral-bluish-100': '#0d1014',
  '--dsw-static-neutral-bluish-1000': '#eaecf0',
  '--dsw-static-neutral-bluish-150': '#0d1016',
  '--dsw-static-neutral-bluish-200': '#11151e',
  '--dsw-static-neutral-bluish-300': '#1f2f3a',
  '--dsw-static-neutral-bluish-400': '#365063',
  '--dsw-static-neutral-bluish-50': '#090b0e',
  '--dsw-static-neutral-bluish-500': '#44657d',
  '--dsw-static-neutral-bluish-60': '#080c0f',
  '--dsw-static-neutral-bluish-600': '#687b89',
  '--dsw-static-neutral-bluish-700': '#8b9ba7',
  '--dsw-static-neutral-bluish-75': '#0a0c0e',
  '--dsw-static-neutral-bluish-750': '#afbac2',
  '--dsw-static-neutral-bluish-800': '#c1cad0',
  '--dsw-static-neutral-bluish-850': '#ccd3d8',
  '--dsw-static-neutral-bluish-875': '#d7dce0',
  '--dsw-static-neutral-bluish-900': '#e0e4e7',
  '--dsw-static-neutral-bluish-950': '#e6eaec',
});

/**
 * HDD theme stylesheet.
 *
 * Hard rules (from the approved plan, D4):
 *   - every rule is scoped under `html[data-dsh-fairy-visual]`, so removing the
 *     attribute removes the whole theme with zero residue;
 *   - never write `--dsw-alias-*` on `:root`/`body` — the override lives on the
 *     scoped `html[...]` selector, the way the shipped skins do it;
 *   - own tokens are prefixed `--dsh-fairy-*`;
 *   - no `:has()`, no generated class names, no images, no backdrop-filter.
 */

const STYLE_ID = 'dsh-fairy/theme.css';
const PLUGIN_ID = 'dsh-fairy-visual';

const SCOPE = `html[${VISUAL_ATTR}]`;

/* Emitted into the stylesheet once, from the generated inverted ramp. */
const staticRamp = Object.entries(HDD_STATICS)
  .map(([name, value]) => `  ${name}: ${value};`)
  .join('\n');

const css = `
${SCOPE} {
  /* Own palette. */
  --dsh-fairy-accent: #61d7ff;
  --dsh-fairy-accent-dim: #2f7f9c;
  --dsh-fairy-void: #05080e;
  --dsh-fairy-void-2: #0a1220;
  --dsh-fairy-grid: rgba(97, 215, 255, 0.07);
  --dsh-fairy-grid-strong: rgba(97, 215, 255, 0.14);
  --dsh-fairy-plate: #3b4148;
  --dsh-fairy-plate-raised: #454c55;
  --dsh-fairy-plate-active: #515a64;
  --dsh-fairy-ridge: #515a64;
  --dsh-fairy-text: #dff2fb;
  --dsh-fairy-text-dim: #8fa8b8;

  color-scheme: dark;
}

/* The official theme writes its static ramp and its alias ramp on \`body\`, so the
   HDD ramp must be declared there too (and with higher specificity) or light
   surfaces leak through every component that re-declares its own fill. */
${SCOPE},
${SCOPE} body {
  /* Inverted neutral ramp: flips every official surface and label at once. */
${staticRamp}

  /* Hand-tuned Fairy identity on top of the inverted ramp. */
  --dsw-alias-bg-base: var(--dsh-fairy-void);
  --dsw-alias-bg-layer-1: #0b1420;
  --dsw-alias-bg-layer-2: #101c2b;
  --dsw-alias-bg-layer-3: #152436;
  --dsw-alias-border-l1: rgba(97, 215, 255, 0.16);
  --dsw-alias-border-l2: rgba(97, 215, 255, 0.24);
  --dsw-alias-border-l3: rgba(97, 215, 255, 0.34);
  --dsw-alias-brand-primary: var(--dsh-fairy-accent);
  --dsw-alias-label-primary: var(--dsh-fairy-text);
  --dsw-alias-label-secondary: #a9c2d2;
  --dsw-alias-label-tertiary: var(--dsh-fairy-text-dim);
  --dsw-alias-interactive-bg-hover: rgba(97, 215, 255, 0.08);
  --dsw-alias-interactive-bg-active: rgba(97, 215, 255, 0.14);
}

${SCOPE} body {
  background: var(--dsh-fairy-void);
  color: var(--dsh-fairy-text);
}

/* #root keeps its own stacking context above the paint-only background host. */
${SCOPE} #root {
  position: relative;
  z-index: 1;
}

/* ------------------------------------------------------------------ *
 * HDD cut-through: the app's own opaque base would hide the paint host,
 * so every *structural* surface (never a card, message or control) goes
 * transparent under HDD and the grid shows through from below.
 * ------------------------------------------------------------------ */
${SCOPE} {
  --dsw-alias-bg-base: transparent;
}

${SCOPE} body,
${SCOPE} #root,
${SCOPE} #root > div,
${SCOPE} [data-shell-overlay],
${SCOPE} [data-phase],
${SCOPE} [data-conversation-scroll],
${SCOPE} [data-conversation-content],
${SCOPE} [data-composer-seat],
${SCOPE} [data-conversation-region='composer'] {
  background-color: transparent;
  background-image: none;
}

/* The 0.2.1 app frame paints its own opaque base two and three levels under
 * the app root; both are structural, never a card, so both cut through. */
${SCOPE} #root > div > div,
${SCOPE} #root > div > div > div {
  background-color: transparent;
  background-image: none;
}

/* Structural surfaces that still need their own value paint it explicitly. */
${SCOPE} [data-conversation-scroll] {
  --dsw-alias-bg-base: transparent;
}

/* The blank Hero face keeps the themed base under its copy. */
${SCOPE} [data-phase='hero'] {
  background-color: transparent;
}

/* Sidebar structural column becomes the polymer plate, painted by us. */
${SCOPE} [role='tree'][aria-label='会话'] {
  background-color: transparent;
}

/* ------------------------------------------------------------------ *
 * Background host: paint only, never interactive, always under #root.
 * ------------------------------------------------------------------ */
.dsh-hdd-background-host {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  contain: strict;
  background:
    radial-gradient(120% 80% at 50% -10%, rgba(97, 215, 255, 0.12), transparent 60%),
    radial-gradient(90% 60% at 50% 110%, rgba(97, 215, 255, 0.06), transparent 65%),
    linear-gradient(180deg, var(--dsh-fairy-void-2), var(--dsh-fairy-void) 65%);
}

.dsh-hdd-background-host::before,
.dsh-hdd-background-host::after {
  content: '';
  position: absolute;
  inset: 0;
}

/* Fine grid. */
.dsh-hdd-background-host::before {
  background-image:
    linear-gradient(to right, var(--dsh-fairy-grid) 1px, transparent 1px),
    linear-gradient(to bottom, var(--dsh-fairy-grid) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(120% 90% at 50% 40%, #000 40%, transparent 100%);
  -webkit-mask-image: radial-gradient(120% 90% at 50% 40%, #000 40%, transparent 100%);
}

/* Coarse grid + horizon flicker. */
.dsh-hdd-background-host::after {
  background-image:
    linear-gradient(to right, var(--dsh-fairy-grid-strong) 1px, transparent 1px),
    linear-gradient(to bottom, var(--dsh-fairy-grid-strong) 1px, transparent 1px);
  background-size: 160px 160px;
  mask-image: radial-gradient(100% 70% at 50% 50%, #000 20%, transparent 90%);
  -webkit-mask-image: radial-gradient(100% 70% at 50% 50%, #000 20%, transparent 90%);
  opacity: 0.7;
}

/* ------------------------------------------------------------------ *
 * Fairy stage (lives inside the shell overlay slot).
 * ------------------------------------------------------------------ */
#dsh-fairy-root {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  contain: layout style;
}

.dsh-fairy-stage {
  position: absolute;
  right: 28px;
  bottom: 148px;
  width: 132px;
  height: 132px;
  display: grid;
  place-items: center;
  pointer-events: none;
  transition: opacity 260ms ease, transform 260ms ease;
}

.dsh-fairy-stage[data-hidden='true'] {
  opacity: 0;
  transform: translateY(6px);
  pointer-events: none;
}

.dsh-fairy-halo {
  position: absolute;
  inset: -18%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(97, 215, 255, 0.22), transparent 68%);
  filter: blur(2px);
  animation: dsh-fairy-breathe 5.5s ease-in-out infinite;
}

.dsh-fairy-eye {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.dsh-fairy-eye-ring {
  transform-origin: 50% 50%;
  animation: dsh-fairy-spin 18s linear infinite;
}

.dsh-fairy-eye-ring-rev {
  transform-origin: 50% 50%;
  animation: dsh-fairy-spin 26s linear infinite reverse;
}

.dsh-fairy-pupil {
  transform-origin: 50% 50%;
  transition: transform 220ms ease;
}

.dsh-fairy-stage[data-activity='thinking'] .dsh-fairy-pupil {
  animation: dsh-fairy-pulse 1.4s ease-in-out infinite;
}

.dsh-fairy-stage[data-activity='comforting'] .dsh-fairy-halo {
  background: radial-gradient(circle, rgba(255, 150, 200, 0.28), transparent 68%);
}

.dsh-fairy-glitch {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  mix-blend-mode: screen;
  opacity: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    rgba(97, 215, 255, 0.16) 0px,
    rgba(97, 215, 255, 0.16) 1px,
    transparent 1px,
    transparent 3px
  );
}

html[data-dsh-fairy-mode='hdd'][data-dsh-fairy-transition] .dsh-fairy-glitch {
  animation: dsh-fairy-glitch 420ms steps(2, end) 1;
}

@keyframes dsh-fairy-spin {
  to { transform: rotate(360deg); }
}

@keyframes dsh-fairy-breathe {
  0%, 100% { opacity: 0.75; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.04); }
}

@keyframes dsh-fairy-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(0.86); }
}

@keyframes dsh-fairy-glitch {
  0% { opacity: 0; transform: translateX(0); }
  20% { opacity: 0.9; transform: translateX(-3px); }
  45% { opacity: 0.4; transform: translateX(2px); }
  70% { opacity: 0.75; transform: translateX(-1px); }
  100% { opacity: 0; transform: translateX(0); }
}

/* ---------------------------------------------------------------- *
 * Composer accents. The card itself is left alone structurally: only
 * paint is themed, so the official input keeps every behaviour.
 * ---------------------------------------------------------------- */
${SCOPE} [data-composer-card='true'] {
  border-color: var(--dsh-fairy-border, rgba(97, 215, 255, 0.18));
  background-color: rgba(9, 17, 27, 0.86);
  box-shadow: 0 0 0 1px rgba(97, 215, 255, 0.06), 0 18px 60px rgba(0, 0, 0, 0.55);
}

/* HDD turns the card into a wide HUD console flush with the conversation
   rect: no float, no radius, one lit top edge and corner brackets. */
${SCOPE} [data-dsh-fairy-composer-host] {
  max-width: none !important;
  width: 100%;
  margin-inline: 0;
  padding-inline: 0;
}

${SCOPE} [data-composer-card='true'] {
  --dsh-composer-card-max-width: none;
  position: relative;
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 10px 12px 8px;
  border: 0;
  border-top: 1px solid rgba(97, 215, 255, 0.32);
  border-radius: 0;
  background-image: linear-gradient(180deg, rgba(11, 20, 32, 0.96), rgba(5, 8, 14, 0.99));
  box-shadow: 0 -20px 48px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(97, 215, 255, 0.2);
}

${SCOPE} [data-composer-card='true']::before,
${SCOPE} [data-composer-card='true']::after {
  content: '';
  position: absolute;
  top: 0;
  width: 18px;
  height: 18px;
  pointer-events: none;
  border-top: 2px solid var(--dsh-fairy-accent);
  opacity: 0.55;
}

${SCOPE} [data-composer-card='true']::before {
  left: 0;
  border-left: 2px solid var(--dsh-fairy-accent);
}

${SCOPE} [data-composer-card='true']::after {
  right: 0;
  border-right: 2px solid var(--dsh-fairy-accent);
}

${SCOPE} [data-composer-card='true']:focus-within {
  border-color: var(--dsw-alias-border-l2);
  box-shadow: 0 0 0 1px rgba(97, 215, 255, 0.22), 0 18px 60px rgba(0, 0, 0, 0.6);
}

${SCOPE} [data-composer-input='true'] {
  caret-color: var(--dsh-fairy-accent);
}

${SCOPE} [data-composer-placeholder='true'] {
  color: var(--dsh-fairy-text-dim);
}

/* ---------------------------------------------------------------- *
 * Sidebar: a matte polymer board with a 10px moulded ridge on its
 * right edge. The board is painted by the theme; the official surface
 * goes flat underneath it.
 * ---------------------------------------------------------------- */
${SCOPE} [data-dsh-fairy-sidebar-layer] {
  /* The board is our paint, so the official label ramp must be raised inside
     it: the stock sidebar text ramp is tuned for a much darker surface. */
  --dsw-alias-label-primary: var(--dsh-fairy-text);
  --dsw-alias-label-secondary: #b8ccd8;
  --dsw-alias-label-tertiary: #93a9b7;
  --dsw-alias-bg-layer-1: var(--dsh-fairy-plate);
  --dsw-alias-interactive-bg-hover: var(--dsh-fairy-plate-raised);
  --dsw-alias-interactive-bg-active: var(--dsh-fairy-plate-active);
  position: relative;
  color: var(--dsh-fairy-text);
  background: var(--dsh-fairy-plate) !important;
  border-right: 0 !important;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
}

/* Static ridge: pure paint, no layout, no animation. */
${SCOPE} [data-dsh-fairy-sidebar-layer]::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 10px;
  height: 100%;
  pointer-events: none;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.05), rgba(0, 0, 0, 0.28));
  box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.08), inset -1px 0 0 rgba(0, 0, 0, 0.45);
}

${SCOPE} [data-dsh-fairy-sidebar-layer] [role='tree'][aria-label='会话'] {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
}

/* ---------------------------------------------------------------- *
 * Low-power: keep the composition, drop every decorative motion.
 * ---------------------------------------------------------------- */
${SCOPE}[data-dsh-fairy-power='low-power'] .dsh-fairy-halo,
${SCOPE}[data-dsh-fairy-power='low-power'] .dsh-fairy-eye-ring,
${SCOPE}[data-dsh-fairy-power='low-power'] .dsh-fairy-eye-ring-rev,
${SCOPE}[data-dsh-fairy-power='low-power'] .dsh-fairy-pupil,
${SCOPE}[data-dsh-fairy-power='low-power'] .dsh-fairy-glitch {
  animation: none !important;
}

/* ---------------------------------------------------------------- *
 * Scrollbars inside HDD scroll containers.
 * ---------------------------------------------------------------- */
${SCOPE} [data-conversation-scroll],
${SCOPE} [data-input-scroll] {
  scrollbar-width: thin;
  scrollbar-color: rgba(97, 215, 255, 0.32) transparent;
}

${SCOPE} [data-conversation-scroll]::-webkit-scrollbar,
${SCOPE} [data-input-scroll]::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

${SCOPE} [data-conversation-scroll]::-webkit-scrollbar-thumb,
${SCOPE} [data-input-scroll]::-webkit-scrollbar-thumb {
  background: rgba(97, 215, 255, 0.28);
  border-radius: 3px;
}

${SCOPE} [data-conversation-scroll]::-webkit-scrollbar-thumb:hover,
${SCOPE} [data-input-scroll]::-webkit-scrollbar-thumb:hover {
  background: rgba(97, 215, 255, 0.5);
}

${SCOPE} [data-conversation-scroll]::-webkit-scrollbar-track,
${SCOPE} [data-input-scroll]::-webkit-scrollbar-track {
  background: transparent;
}

/* ---------------------------------------------------------------- *
 * Mode transition: three lazy full-frame glitch slices. The frame is
 * transient, clipped, pointer-transparent and removed by its own timer,
 * so it is deliberately not gated on the HDD attributes.
 * ---------------------------------------------------------------- */
.dsh-hdd-mode-transition {
  position: fixed;
  inset: 0;
  z-index: 40;
  overflow: hidden;
  pointer-events: none;
  contain: strict;
}

.dsh-hdd-mode-transition__slice {
  position: absolute;
  left: -4%;
  display: block;
  width: 108%;
  height: 34%;
  background:
    repeating-linear-gradient(0deg, rgba(97, 215, 255, 0.16) 0 2px, transparent 2px 5px),
    linear-gradient(90deg, rgba(97, 215, 255, 0.22), rgba(255, 92, 199, 0.14));
  mix-blend-mode: screen;
  animation: dsh-fairy-slice 420ms steps(3, end) 1 both;
}

@keyframes dsh-fairy-slice {
  0% {
    opacity: 0;
    transform: translateX(0);
  }
  15% {
    opacity: 1;
  }
  45% {
    transform: translateX(-3%);
  }
  70% {
    transform: translateX(2%);
  }
  100% {
    opacity: 0;
    transform: translateX(0);
  }
}

/* ---------------------------------------------------------------- *
 * Reduced motion: kill every decorative animation.
 * ---------------------------------------------------------------- */
@media (prefers-reduced-motion: reduce) {
  .dsh-fairy-halo,
  .dsh-fairy-eye-ring,
  .dsh-fairy-eye-ring-rev,
  .dsh-fairy-stage[data-activity='thinking'] .dsh-fairy-pupil,
  .dsh-hdd-mode-transition__slice {
    animation: none;
  }
}
`;

/** Inject the theme stylesheet once. Returns a disposer. */
function injectStyles(doc = document) {
  const existing = doc.querySelector(`style[data-plugin-css][data-plugin="${PLUGIN_ID}"]`);
  if (existing) return () => {}
  const tag = doc.createElement('style');
  tag.setAttribute('data-plugin', PLUGIN_ID);
  tag.setAttribute('data-plugin-css', '');
  tag.setAttribute('data-dsh-fairy-style', STYLE_ID);
  tag.textContent = css;
  doc.head.append(tag);
  return () => {
    tag.remove();
  }
}

/**
 * The Fairy eye. Pure SVG + CSS animation, no bitmap assets, no canvas.
 *
 * Activity drives the presentation: `idle` breathes, `thinking` spins the outer
 * ring faster and pulses the pupil, `comforting` warms the halo. All animation
 * is CSS-only so `prefers-reduced-motion` can switch it off wholesale.
 */


const svg = (h, props, children) => h('svg', props, children);

const ring = (h, key, radius, className, strokeWidth, opacity) =>
  h('circle', {
    key,
    className,
    cx: 60,
    cy: 60,
    r: radius,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeOpacity: opacity,
    strokeDasharray: `${radius * 0.9} ${radius * 0.55}`,
    strokeLinecap: 'round',
  });

function createEye(h) {
  return svg(
    h,
    {
      className: 'dsh-fairy-eye',
      viewBox: '0 0 120 120',
      width: 132,
      height: 132,
      role: 'img',
      'aria-label': 'Fairy',
      style: { color: 'var(--dsh-fairy-accent)' },
    },
    [
      h('defs', { key: 'defs' }, [
        h(
          'radialGradient',
          { key: 'core', id: 'dsh-fairy-core', cx: '50%', cy: '50%', r: '50%' },
          [
            h('stop', { key: 'a', offset: '0%', stopColor: '#eafcff', stopOpacity: 0.98 }),
            h('stop', { key: 'b', offset: '55%', stopColor: '#61d7ff', stopOpacity: 0.85 }),
            h('stop', { key: 'c', offset: '100%', stopColor: '#0d5f7a', stopOpacity: 0.15 }),
          ],
        ),
      ]),
      h('g', { key: 'rings', className: 'dsh-fairy-eye-ring' }, [
        ring(h, 'r1', 55, undefined, 1.1, 0.5),
        ring(h, 'r2', 47, undefined, 0.8, 0.32),
        ring(h, 'r3', 39, undefined, 0.6, 0.22),
      ]),
      h('g', { key: 'rings2', className: 'dsh-fairy-eye-ring-rev' }, [
        ring(h, 'r4', 51, undefined, 0.7, 0.26),
        h('circle', {
          key: 'tick',
          cx: 60,
          cy: 60,
          r: 43,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeOpacity: 0.5,
          strokeDasharray: '2 26',
          strokeLinecap: 'round',
        }),
      ]),
      h('g', { key: 'pupil', className: 'dsh-fairy-pupil' }, [
        h('circle', { key: 'iris', cx: 60, cy: 60, r: 27, fill: 'url(#dsh-fairy-core)' }),
        h('circle', { key: 'hole', cx: 60, cy: 60, r: 12.5, fill: '#04121a', fillOpacity: 0.92 }),
        h('circle', { key: 'glint', cx: 53, cy: 52, r: 4.2, fill: '#ffffff', fillOpacity: 0.85 }),
        h('circle', { key: 'glint2', cx: 68, cy: 70, r: 2.1, fill: '#ffffff', fillOpacity: 0.4 }),
      ]),
    ],
  )
}

/**
 * @param {{ activity: 'normal'|'thinking'|'comforting', visible: boolean }} props
 */
function createStage(h) {
  return function FairyStage({ activity = 'normal', visible = true }) {
    return h(
      'div',
      {
        className: 'dsh-fairy-stage',
        'data-dsh-fairy-stage': '',
        'data-activity': activity,
        'data-hidden': visible ? 'false' : 'true',
        'aria-hidden': 'true',
      },
      [
        h('div', { key: 'halo', className: 'dsh-fairy-halo' }),
        createEye(h),
        h('div', { key: 'glitch', className: 'dsh-fairy-glitch' }),
      ],
    )
  }
}

/**
 * Paint-only background host. It is deliberately a plain DOM node, not a React
 * root: one node, inserted before `#root`, `pointer-events: none`, z-index 0.
 * `#root` keeps z-index 1 so nothing of the app is ever covered by paint.
 */
const HOST_CLASS = 'dsh-hdd-background-host';

function mountBackgroundHost(doc = document) {
  if (doc.querySelector(`body > .${HOST_CLASS}`)) {
    return () => unmountBackgroundHost(doc)
  }
  const host = doc.createElement('div');
  host.className = HOST_CLASS;
  host.setAttribute('data-dsh-fairy-background-surface', '');
  host.setAttribute('aria-hidden', 'true');
  const root = doc.getElementById('root');
  if (root?.parentNode) root.parentNode.insertBefore(host, root);
  else doc.body.append(host);
  return () => unmountBackgroundHost(doc)
}

function unmountBackgroundHost(doc = document) {
  for (const node of doc.querySelectorAll(`body > .${HOST_CLASS}`)) node.remove();
}

/**
 * Settings transport. The host half owns the file; the client only projects it.
 * Everything is same-origin and cookie-authenticated, so no token handling here.
 */

const SETTINGS_URL = '/dsh-fairy/settings';

function normalize(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  if (source.version !== SCHEMA_VERSION) return { ...DEFAULT_SETTINGS }
  return {
    ...DEFAULT_SETTINGS,
    ...source,
    version: SCHEMA_VERSION,
    composerDockHeight: clampDockHeight(source.composerDockHeight, typeof innerWidth === 'number' ? innerWidth : 1280),
  }
}

/** Host routes answer with `{ ok, settings }`; accept a bare object too. */
const unwrap = (payload) =>
  payload && typeof payload === 'object' && payload.settings && typeof payload.settings === 'object'
    ? payload.settings
    : payload;

async function loadSettings() {
  try {
    const response = await fetch(SETTINGS_URL, { headers: { accept: 'application/json' } });
    if (!response.ok) return { ...DEFAULT_SETTINGS }
    return normalize(unwrap(await response.json()))
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

async function saveSettings(settings) {
  try {
    const response = await fetch(SETTINGS_URL, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!response.ok) return { ok: false, status: response.status }
    return { ok: true, settings: normalize(unwrap(await response.json())) }
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) }
  }
}

/**
 * Tiny external store so every slot component reads the same projection and
 * every write is optimistic with a host round-trip behind it.
 */
function createSettingsStore(React) {
  let state = { ...DEFAULT_SETTINGS };
  const listeners = new Set();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const set = (patch, { persist = true } = {}) => {
    const next = normalize({ ...state, ...patch });
    state = next;
    emit();
    if (persist) void saveSettings(next);
    return next
  };

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener)
  };

  const getSnapshot = () => state;

  const useSettings = () => React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    get: getSnapshot,
    set,
    subscribe,
    useSettings,
    replace(next) {
      state = normalize(next);
      emit();
    },
    dispose() {
      listeners.clear();
    },
  }
}

/**
 * Semantic marker projection.
 *
 * The official DOM is built from hashed CSS Modules class names, so the theme
 * never targets a class. Instead this controller projects a few short-lived
 * `data-dsh-fairy-*` attributes onto *real* semantic nodes it resolves from
 * public slot outlets and stable `data-*` anchors. Everything it writes is
 * tracked here and removed on dispose (and never written when the theme is off).
 */
const MARKER_ATTRS = Object.freeze({
  sidebarLayer: 'data-dsh-fairy-sidebar-layer',
  sidebarSurface: 'data-dsh-fairy-sidebar-surface',
  brandAnchor: 'data-dsh-fairy-brand-anchor',
  composerSeat: 'data-dsh-fairy-composer-seat',
  composerHost: 'data-dsh-fairy-composer-host',
});

const SIDEBAR_SLOT = '[data-slot="sidebar"]';
const BRAND_SLOT = '[data-slot="sidebar.brand.mark"]';
const SEAT = '[data-composer-seat]';
const CARD = '[data-composer-card="true"]';
const COMPOSER_MAX_DEPTH = 6;

/** First real box under a `display: contents` slot outlet. */
const outletChild = (doc, selector) => {
  const outlet = doc.querySelector(selector);
  if (!outlet) return null
  return outlet.firstElementChild ?? null
};

/**
 * A candidate is only accepted when its box really looks like the sidebar
 * column. The slot outlet is a layout-neutral wrapper, so its first child can
 * be the whole shell frame on some layouts; painting that would flood the app.
 */
const looksLikeSidebar = (element, doc) => {
  if (!element || typeof element.getBoundingClientRect !== 'function') return false
  const rect = element.getBoundingClientRect();
  const viewport = doc.defaultView?.innerWidth ?? 0;
  if (!rect.width || !rect.height) return false
  if (viewport && rect.width > viewport * 0.45) return false
  return true
};

function createMarkers(doc = document) {
  /** element -> Set of attribute names this controller wrote */
  const written = new Map();
  let frame = 0;

  const write = (element, attr) => {
    if (!element) return
    let attrs = written.get(element);
    if (!attrs) {
      attrs = new Set();
      written.set(element, attrs);
    }
    if (attrs.has(attr)) return
    element.setAttribute(attr, '');
    attrs.add(attr);
  };

  const prune = (keep) => {
    for (const [element, attrs] of [...written]) {
      if (!keep.has(element)) {
        for (const attr of attrs) element.removeAttribute(attr);
        written.delete(element);
        continue
      }
      for (const attr of [...attrs]) {
        if (keep.get(element)?.has(attr)) continue
        element.removeAttribute(attr);
        attrs.delete(attr);
      }
      if (attrs.size === 0) written.delete(element);
    }
  };

  const project = () => {
    frame = 0;
    if (!doc.documentElement.hasAttribute('data-dsh-fairy-visual')) {
      prune(new Map());
      return
    }
    /** element -> Set of attributes that must stay */
    const keep = new Map();
    const want = (element, attr) => {
      if (!element) return
      let attrs = keep.get(element);
      if (!attrs) {
        attrs = new Set();
        keep.set(element, attrs);
      }
      attrs.add(attr);
      write(element, attr);
    };

    const sidebar = outletChild(doc, SIDEBAR_SLOT);
    if (looksLikeSidebar(sidebar, doc)) {
      want(sidebar, MARKER_ATTRS.sidebarLayer);
      want(sidebar, MARKER_ATTRS.sidebarSurface);
    }

    want(outletChild(doc, BRAND_SLOT), MARKER_ATTRS.brandAnchor);

    for (const seat of doc.querySelectorAll(SEAT)) want(seat, MARKER_ATTRS.composerSeat);

    /* The official composer is capped at a centred reading width. HDD owns the
       full conversation rect, so every real box between the card and the seat
       is projected too; `display: contents` outlets generate no box and are
       skipped so the marker always lands on something that can be styled. */
    const card = doc.querySelector(CARD);
    if (card) {
      let node = card.parentElement;
      for (let depth = 0; node && depth < COMPOSER_MAX_DEPTH; depth += 1) {
        if (node === doc.body || node.hasAttribute('data-composer-seat')) break
        let display = '';
        try {
          display = doc.defaultView?.getComputedStyle(node)?.display ?? '';
        } catch {
          display = '';
        }
        if (display && display !== 'contents') want(node, MARKER_ATTRS.composerHost);
        node = node.parentElement;
      }
    }

    prune(keep);
  };

  const schedule = () => {
    if (frame) return
    frame = requestAnimationFrame(project);
  };

  const observer = new MutationObserver(schedule);
  const target = doc.body ?? doc.documentElement;
  observer.observe(target, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-slot', 'data-phase', 'data-dsh-fairy-visual'],
  });

  schedule();

  return {
    project: schedule,
    dispose() {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      prune(new Map());
    },
  }
}

/**
 * React surfaces the theme contributes: the HDD toggle and the settings page.
 * Both read/write the same store, so the toggle, the settings page and the
 * document attributes never disagree.
 */

const h$2 = React__namespace.createElement;

const buttonStyle = (active) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 26,
  padding: '0 10px',
  borderRadius: 13,
  font: '11px/1 -apple-system, "Segoe UI", system-ui, sans-serif',
  letterSpacing: '0.08em',
  cursor: 'pointer',
  color: active ? '#04121a' : 'var(--dsw-alias-label-secondary, #a9c2d2)',
  background: active ? 'var(--dsh-fairy-accent, #61d7ff)' : 'transparent',
  border: `1px solid ${active ? 'var(--dsh-fairy-accent, #61d7ff)' : 'rgba(97,215,255,0.35)'}`,
  transition: 'background 160ms ease, color 160ms ease',
});

const rowStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' };
const labelStyle = { minWidth: 120, fontSize: 13, opacity: 0.85 };
const hintStyle = { fontSize: 11, opacity: 0.55, marginTop: 4, lineHeight: 1.5 };

function HddToggle({ store, variant = 'header' }) {
  const settings = store.useSettings();
  const on = settings.enabled;
  return h$2(
    'button',
    {
      type: 'button',
      'data-dsh-fairy-hdd-toggle': variant,
      'aria-pressed': on,
      title: on ? '切换回标准界面' : '切换到 HDD 界面',
      onClick: () => store.set({ enabled: !on }),
      style: variant === 'overlay' ? { ...buttonStyle(on), position: 'fixed', right: 20, top: 16, zIndex: 20 } : buttonStyle(on),
    },
    h$2('span', { 'aria-hidden': 'true', style: { fontSize: 12, lineHeight: 1 } }, on ? '◉' : '◎'),
    h$2('span', null, 'HDD'),
  )
}

function SettingsSection({ store }) {
  const settings = store.useSettings();
  return h$2(
    'div',
    { 'data-dsh-fairy-settings': '', style: { padding: '4px 2px 24px', font: '13px/1.5 -apple-system, "Segoe UI", system-ui, sans-serif' } },
    h$2('h2', { style: { fontSize: 15, fontWeight: 600, margin: '0 0 4px' } }, 'Fairy 界面'),
    h$2(
      'p',
      { style: { ...hintStyle, margin: '0 0 12px' } },
      '绝区零风格的 HDD 主题。关闭后所有样式、背景层与舞台都会完整撤回，不残留任何节点或属性。',
    ),

    h$2(
      'div',
      { style: { ...rowStyle, borderTop: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.2))' } },
      h$2('div', { style: labelStyle }, 'HDD 界面'),
      h$2('input', {
        type: 'checkbox',
        checked: settings.enabled,
        onChange: (event) => store.set({ enabled: event.target.checked }),
      }),
      h$2('div', { style: { ...hintStyle, margin: 0 } }, settings.enabled ? '已启用' : '已关闭'),
    ),

    h$2(
      'div',
      { style: rowStyle },
      h$2('div', { style: labelStyle }, 'Fairy 舞台'),
      h$2('input', {
        type: 'checkbox',
        checked: settings.mascotVisible,
        onChange: (event) => store.set({ mascotVisible: event.target.checked }),
      }),
      h$2('div', { style: { ...hintStyle, margin: 0 } }, '右下角的悬浮眼睛；关闭后仍保留 HDD 背景。'),
    ),

    h$2(
      'div',
      { style: rowStyle },
      h$2('div', { style: labelStyle }, '功耗模式'),
      h$2(
        'select',
        {
          value: settings.powerMode,
          onChange: (event) => store.set({ powerMode: event.target.value }),
          style: { fontSize: 12, padding: '4px 6px' },
        },
        h$2('option', { value: 'normal' }, 'normal'),
        h$2('option', { value: 'low-power' }, 'low-power（关闭装饰动画）'),
      ),
      h$2('div', { style: { ...hintStyle, margin: 0 } }, 'low-power 会停掉自转环与呼吸光晕。'),
    ),

    h$2(
      'div',
      { style: rowStyle },
      h$2('div', { style: labelStyle }, '共存策略'),
      h$2(
        'select',
        {
          value: settings.coexistence,
          onChange: (event) => store.set({ coexistence: event.target.value }),
          style: { fontSize: 12, padding: '4px 6px' },
        },
        h$2('option', { value: 'auto' }, 'auto'),
        h$2('option', { value: 'coexist' }, 'coexist（与其它皮肤叠加）'),
        h$2('option', { value: 'yield' }, 'yield（检测到其它皮肤时让位）'),
      ),
    ),

    h$2(
      'div',
      { style: rowStyle },
      h$2('div', { style: labelStyle }, '诊断'),
      h$2('input', {
        type: 'checkbox',
        checked: settings.diagnostics,
        onChange: (event) => store.set({ diagnostics: event.target.checked }),
      }),
      h$2('div', { style: { ...hintStyle, margin: 0 } }, '显示探针面板与运行时诊断信息。'),
    ),

    h$2(
      'div',
      { style: { ...rowStyle, opacity: 0.5 } },
      h$2('div', { style: labelStyle }, '版本'),
      h$2('div', { style: { fontSize: 12 } }, `schema ${settings.version} · ${settings.theme || 'dark'}`),
    ),
  )
}

/**
 * Development probe. Not a product surface: it answers "is this runtime really
 * what we think it is" from inside the real browser and posts the answer back to
 * the host half (`POST /dsh-fairy/report`), which is the only way to observe a
 * client plugin from the terminal in this environment.
 */

const h$1 = React__namespace.createElement;

const CANDIDATE_SLOTS = [
  'shell.overlay',
  'conversation.session.header.utilities',
  'conversation.session.header.actions',
  'settings.section',
  'sidebar.footer.action',
  'conversation.input.left',
  'conversation.composer.dock',
  'conversation.input.dock',
  'conversation.hero.workspace',
  'conversation.input.attachments',
  'shell.bottom',
];

const CANDIDATE_SERVICES = [
  'slots',
  'sessions',
  'uiSession',
  'settingsScope',
  'settings',
  'locale',
  'connection',
  'remote',
  'layout',
  'theme',
  'commands',
  'uiWorkspace',
  'workspaces',
  'resources',
];

const describe = (value) => {
  if (value === undefined) return 'missing'
  if (value === null) return 'null'
  if (typeof value === 'function') return 'function'
  if (typeof value !== 'object') return typeof value
  try {
    return `object{${Object.keys(value).slice(0, 20).join(',')}}`
  } catch {
    return 'object'
  }
};

const safeGet$1 = (ctx, key) => {
  try {
    return ctx?.get?.(key)
  } catch {
    return undefined
  }
};

function probeServices(ctx) {
  const out = {};
  for (const key of CANDIDATE_SERVICES) out[key] = describe(safeGet$1(ctx, key));
  return out
}

function probeSlots(ctx) {
  const out = {};
  for (const slot of CANDIDATE_SLOTS) {
    try {
      const entries = ctx?.slots?.entries?.(slot);
      out[slot] = Array.isArray(entries) ? `entries=${entries.length}` : describe(entries);
    } catch (error) {
      out[slot] = `error: ${error?.message ?? error}`;
    }
  }
  return out
}

const DOM_SELECTORS = [
  '[data-conversation-scroll]',
  '[data-input-scroll="true"]',
  '[data-composer-card="true"]',
  '[data-composer-input="true"]',
  '[data-composer-seat]',
  '[data-composer-dock]',
  '[data-shell-overlay]',
  '[data-slot="shell.overlay"]',
  '[data-slot="conversation.session.header.utilities"]',
  '[data-slot="settings.section"]',
  '[data-dsh-fairy-hdd-toggle]',
  '[data-dsh-fairy-stage]',
  '[role="tree"][aria-label="会话"]',
  '[data-chat-flow]',
  '.toBottomSlot',
  'textarea',
  '.dsh-hdd-background-host',
  '#dsh-fairy-root',
];

function probeShapes(ctx) {
  const describeSurface = (value) => {
    if (!value || typeof value !== 'object') return describe(value)
    const keys = [];
    let cursor = value;
    for (let depth = 0; cursor && depth < 3; depth += 1) {
      for (const key of Object.keys(cursor)) {
        const member = cursor[key];
        if (typeof member === 'function') keys.push(`${key}()`);
        else if (typeof member === 'undefined') keys.push(`${key}?`);
      }
      cursor = Object.getPrototypeOf(cursor);
    }
    return [...new Set(keys)].slice(0, 60)
  };

  const out = {};
  for (const service of ['workspaces', 'uiWorkspace', 'uiSession', 'sessions']) {
    try {
      out[service] = describeSurface(ctx?.get ? ctx.get(service) : undefined);
    } catch (error) {
      out[service] = `error: ${error?.message ?? error}`;
    }
  }
  return out
}

function probeDom() {
  const out = { selectors: {} };
  if (typeof document === 'undefined') return out
  out.readyState = document.readyState;
  for (const selector of DOM_SELECTORS) {
    try {
      out.selectors[selector] = document.querySelectorAll(selector).length;
    } catch (error) {
      out.selectors[selector] = `error: ${error?.message ?? error}`;
    }
  }
  out.attrs = {
    visual: document.documentElement.getAttribute(VISUAL_ATTR),
    mode: document.documentElement.getAttribute(MODE_ATTR),
  };
  out.bodyChildren = Array.prototype.map
    .call(document.body.children, (node) => node.id || `${node.className || node.tagName}`.slice(0, 40))
    .slice(0, 12);
  return out
}

const describeNode = (node, depth) => {
  if (!node) return null
  const attrs = [];
  for (const attribute of node.attributes ?? []) {
    attrs.push(attribute.value ? `${attribute.name}=${attribute.value.slice(0, 36)}` : attribute.name);
  }
  return {
    tag: node.tagName?.toLowerCase?.() ?? 'node',
    attrs,
    bg: typeof getComputedStyle === 'function' ? getComputedStyle(node).backgroundColor : null,
    children: depth > 0 ? [...(node.children ?? [])].slice(0, 5).map((child) => describeNode(child, depth - 1)) : undefined,
  }
};

function probeTree() {
  if (typeof document === 'undefined') return null
  return describeNode(document.getElementById('root'), 2)
}

function probeMarkers() {
  if (typeof document === 'undefined') return null
  const out = [];
  const selector =
    '[data-dsh-fairy-sidebar-layer], [data-dsh-fairy-sidebar-surface], [data-dsh-fairy-brand-anchor], [data-dsh-fairy-composer-seat]';
  for (const node of document.querySelectorAll(selector)) {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    out.push({
      marks: [...node.attributes].map((a) => a.name).filter((n) => n.startsWith('data-dsh-fairy')),
      tag: node.tagName.toLowerCase(),
      cls: String(node.className || '').slice(0, 40),
      rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)],
      bg: style.backgroundColor,
    });
  }
  return out
}

function probePaint() {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return null
  const pick = (selector) => {
    const node = selector ? document.querySelector(selector) : null;
    if (!node) return null
    const style = getComputedStyle(node);
    return { bg: style.backgroundColor, image: style.backgroundImage.slice(0, 40), color: style.color, z: style.zIndex }
  };
  return {
    body: pick('body'),
    root: pick('#root'),
    rootChild: pick('#root > div'),
    rootGrandchild: pick('#root > div > div'),
    phase: pick('[data-phase]'),
    scroll: pick('[data-conversation-scroll]'),
    composer: pick('[data-composer-card="true"]'),
    backgroundHost: pick('.dsh-hdd-background-host'),
    tokens: {
      base: getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-bg-base').trim(),
      layer1: getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-bg-layer-1').trim(),
      label: getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-label-primary').trim(),
    },
  }
}

function createProbe(ctx) {
  const report = {
    plugin: 'fairy-visual',
    at: new Date().toISOString(),
    boot: (() => {
      const boot = globalThis.__DSH_BOOT__;
      return boot ? { version: boot.release?.version ?? boot.version ?? null, rev: boot.rev ?? null } : null
    })(),
    services: probeServices(ctx),
    slots: probeSlots(ctx),
    dom: probeDom(),
    paint: probePaint(),
    tree: probeTree(),
    viewport: { w: typeof innerWidth === 'number' ? innerWidth : null, h: typeof innerHeight === 'number' ? innerHeight : null },
  };

  const send = (payload, phase) => {
    try {
      if (typeof fetch !== 'function') return
      void fetch('/dsh-fairy/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, phase }),
      }).catch(() => {});
    } catch {
      /* best effort */
    }
  };

  send(report, 'apply');
  const timer = setTimeout(
    () =>
      send(
        {
          ...report,
          dom: probeDom(),
          paint: probePaint(),
          tree: probeTree(),
          markers: probeMarkers(),
          shapes: probeShapes(ctx),
          services: probeServices(ctx),
          slots: probeSlots(ctx),
        },
        'settled',
      ),
    3500,
  );

  globalThis.__DSH_FAIRY_PROBE__ = report;
  try {
    console.info('[fairy-probe]', report);
  } catch {
    /* console unavailable */
  }

  function ProbePanel() {
    return h$1(
      'div',
      {
        'data-dsh-fairy-probe': '',
        style: {
          position: 'fixed',
          left: 12,
          bottom: 12,
          width: 420,
          maxHeight: '60vh',
          overflow: 'auto',
          zIndex: 20,
          font: '11px/1.45 ui-monospace, Menlo, monospace',
          color: '#d8f6ff',
          background: 'rgba(4,12,20,0.94)',
          border: '1px solid #1d4a63',
          borderRadius: 8,
          padding: 10,
          pointerEvents: 'auto',
        },
      },
      h$1('pre', { style: { margin: 0, whiteSpace: 'pre-wrap' } }, JSON.stringify(report, null, 1).slice(0, 6000)),
    )
  }

  return {
    ProbePanel,
    dispose() {
      clearTimeout(timer);
    },
  }
}

/**
 * Mode transition: three lazy full-frame glitch slices.
 *
 * The frame only exists for the duration of the flash. It is clipped, fully
 * pointer-transparent, paints nothing after the animation ends and is removed
 * by its own timer, so the "transition frame count" invariant (0 after settle)
 * stays true.
 */
const TRANSITION_CLASS = 'dsh-hdd-mode-transition';
const TRANSITION_ATTR$1 = 'data-dsh-transition-background';

const SLICES = 3;

function runTransition(doc, duration = 460) {
  if (!doc || !doc.body) return () => {}

  for (const stale of [...doc.querySelectorAll(`.${TRANSITION_CLASS}`)]) stale.remove();

  const frame = doc.createElement('div');
  frame.className = TRANSITION_CLASS;
  frame.setAttribute(TRANSITION_ATTR$1, '');
  frame.setAttribute('aria-hidden', 'true');

  for (let index = 0; index < SLICES; index += 1) {
    const slice = doc.createElement('span');
    slice.className = `${TRANSITION_CLASS}__slice`;
    slice.style.top = `${Math.round((100 / SLICES) * index)}%`;
    slice.style.animationDelay = `${index * 40}ms`;
    frame.appendChild(slice);
  }

  doc.body.appendChild(frame);

  let timer = setTimeout(() => {
    timer = 0;
    frame.remove();
  }, duration);

  return () => {
    if (timer) clearTimeout(timer);
    timer = 0;
    frame.remove();
  }
}

/**
 * dsh-fairy-visual — the HDD presentation of Fairy.
 *
 * Client entry. It owns the visual layer only: the HDD document mode, the paint
 * background host, the Fairy stage, the HDD toggle and its own settings page.
 * Every side effect goes through a Cordis effect disposer, so disabling the
 * plugin restores the stock interface with no leftover nodes or attributes.
 */

const name = 'fairy-visual';
const inject = ['slots'];

const h = React__namespace.createElement;
const POWER_ATTR = 'data-dsh-fairy-power';
const TRANSITION_ATTR = 'data-dsh-fairy-transition';
const HEADER_SLOT = 'conversation.session.header.utilities';
const HEADER_SLOT_NODE = `[data-slot="${HEADER_SLOT}"]`;
const TICK_MS = 700;

/** Foreign skin markers this theme must not fight with. */
const FOREIGN_SKIN_ATTRS = ['data-dsh-maid-atelier', 'data-dsh-skin', 'data-dsh-theme-skin'];

const safeGet = (ctx, key) => {
  try {
    return ctx?.get?.(key)
  } catch {
    return undefined
  }
};

function detectForeignSkin() {
  if (typeof document === 'undefined') return null
  for (const attr of FOREIGN_SKIN_ATTRS) {
    if (document.documentElement.hasAttribute(attr) || document.body?.hasAttribute(attr)) return attr
  }
  return null
}

/** Derives the projected activity from the official session service. */
function detectActivity(ctx) {
  const ui = safeGet(ctx, 'uiSession');
  if (!ui) return { activity: 'normal', lifecycle: 'idle' }
  let running = false;
  try {
    const value = ui.running;
    running = typeof value === 'function' ? Boolean(value()) : Boolean(value);
    if (!running && ui.sessionStatus && typeof ui.sessionStatus === 'object') {
      const status = ui.sessionStatus;
      running = status.running === true || status.state === 'running' || status.state === 'streaming';
    }
  } catch {
    running = false;
  }
  return running ? { activity: 'thinking', lifecycle: 'running' } : { activity: 'normal', lifecycle: 'idle' }
}

function apply(ctx) {
  const store = createSettingsStore(React__namespace);
  const FairyStage = createStage(h);
  const probe = createProbe(ctx);

  /* --- activity projection (tiny external store, not persisted) --- */
  let activity = 'normal';
  let lifecycle = 'idle';
  const activityListeners = new Set();
  const publishActivity = (next, nextLifecycle) => {
    if (next === activity && nextLifecycle === lifecycle) return
    activity = next;
    lifecycle = nextLifecycle;
    for (const listener of activityListeners) listener();
  };
  const useActivity = () =>
    React__namespace.useSyncExternalStore(
      (listener) => {
        activityListeners.add(listener);
        return () => activityListeners.delete(listener)
      },
      () => activity,
      () => activity,
    );

  /* --- document projection --- */
  let backgroundDispose = null;

  let transitionTimer = 0;
  let stopTransition = null;
  let wasOn = null;

  const applyDocument = (settings) => {
    if (typeof document === 'undefined') return
    const root = document.documentElement;
    const foreign = settings.coexistence === 'yield' ? detectForeignSkin() : null;
    const on = Boolean(settings.enabled) && !foreign;

    if (on) {
      root.setAttribute(VISUAL_ATTR, '');
      root.setAttribute(MODE_ATTR, 'hdd');
      if (!backgroundDispose) backgroundDispose = mountBackgroundHost(document);
    } else {
      root.removeAttribute(MODE_ATTR);
      root.removeAttribute(VISUAL_ATTR);
      if (backgroundDispose) {
        backgroundDispose();
        backgroundDispose = null;
      }
    }

    if (settings.powerMode === 'low-power') root.setAttribute(POWER_ATTR, 'low-power');
    else root.removeAttribute(POWER_ATTR);

    /* Mode change flashes three lazy full-frame slices, then cleans up. */
    if (wasOn !== null && wasOn !== on) {
      root.setAttribute(TRANSITION_ATTR, '');
      if (transitionTimer) clearTimeout(transitionTimer);
      stopTransition?.();
      stopTransition = runTransition(document);
      transitionTimer = setTimeout(() => {
        root.removeAttribute(TRANSITION_ATTR);
        transitionTimer = 0;
      }, 460);
    }
    wasOn = on;

    markers.project();
  };

  ctx.effect(() => injectStyles(document), 'fairy-visual: styles');

  const markers = createMarkers(document);
  ctx.effect(
    () => () => {
      markers.dispose();
      if (transitionTimer) clearTimeout(transitionTimer);
      transitionTimer = 0;
      if (stopTransition) stopTransition();
      stopTransition = null;
      if (backgroundDispose) backgroundDispose();
      backgroundDispose = null;
      if (typeof document !== 'undefined') {
        document.documentElement.removeAttribute(VISUAL_ATTR);
        document.documentElement.removeAttribute(MODE_ATTR);
        document.documentElement.removeAttribute(POWER_ATTR);
        document.documentElement.removeAttribute(TRANSITION_ATTR);
      }
      store.dispose();
      probe.dispose();
    },
    'fairy-visual: teardown',
  );

  applyDocument({ ...DEFAULT_SETTINGS });
  store.subscribe(() => applyDocument(store.get()));

  void loadSettings().then((settings) => {
    store.replace(settings);
    applyDocument(settings);
  });

  /* --- session header availability (the blank Hero face has no Session header) --- */
  let hasHeaderSlot = false;
  const headerListeners = new Set();
  const publishHeader = (next) => {
    if (next === hasHeaderSlot) return
    hasHeaderSlot = next;
    for (const listener of headerListeners) listener();
  };
  const useHeaderSlot = () =>
    React__namespace.useSyncExternalStore(
      (listener) => {
        headerListeners.add(listener);
        return () => headerListeners.delete(listener)
      },
      () => hasHeaderSlot,
      () => hasHeaderSlot,
    );

  /* --- one tick drives activity + header availability --- */
  const headerVisible = () => {
    if (typeof document === 'undefined') return false
    const outlet = document.querySelector(HEADER_SLOT_NODE);
    return Boolean(outlet && outlet.childElementCount > 0)
  };
  const tick = () => {
    const next = detectActivity(ctx);
    publishActivity(next.activity, next.lifecycle);
    publishHeader(headerVisible());
  };
  const timer = setInterval(tick, TICK_MS);
  ctx.effect(() => () => clearInterval(timer), 'fairy-visual: activity tick');
  setTimeout(tick, 1200);

  /* --- slot surfaces --- */
  function StageHost() {
    const settings = store.useSettings();
    const currentActivity = useActivity();
    const headerSlot = useHeaderSlot();
    return h(
      React__namespace.Fragment,
      null,
      h(FairyStage, {
        activity: currentActivity,
        visible: Boolean(settings.enabled) && Boolean(settings.mascotVisible),
      }),
      headerSlot ? null : h(HddToggle, { store, variant: 'overlay' }),
      settings.diagnostics ? h(probe.ProbePanel) : null,
    )
  }

  function HeaderToggle() {
    return h(HddToggle, { store, variant: 'header' })
  }

  function FairySettingsSection() {
    return h(SettingsSection, { store })
  }

  ctx.effect(
    () =>
      ctx.slots.inject('shell.overlay', function* () {
        yield ctx.slots.register(
          { name: 'shell.overlay', id: 'fairy-stage', order: 800 },
          StageHost,
        );
      }),
    'fairy-visual: shell overlay',
  );

  ctx.effect(
    () =>
      ctx.slots.inject(HEADER_SLOT, function* () {
        yield ctx.slots.register(
          { name: HEADER_SLOT, id: 'fairy-hdd-toggle', order: 60 },
          HeaderToggle,
        );
      }),
    'fairy-visual: header toggle',
  );

  ctx.effect(
    () =>
      ctx.slots.inject('settings.section', function* () {
        yield ctx.slots.register(
          { name: 'settings.section', id: 'fairy-visual', order: 40, label: () => 'Fairy 界面' },
          FairySettingsSection,
        );
      }),
    'fairy-visual: settings section',
  );
}

exports.apply = apply;
exports.inject = inject;
exports.name = name;

		return module.exports;
	}
});
