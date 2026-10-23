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
import { VISUAL_ATTR } from 'dsh-fairy-contracts'
import { HDD_STATICS } from './tokens.generated.js'

export const STYLE_ID = 'dsh-fairy/theme.css'
export const PLUGIN_ID = 'dsh-fairy-visual'

const SCOPE = `html[${VISUAL_ATTR}]`

/* Emitted into the stylesheet once, from the generated inverted ramp. */
const staticRamp = Object.entries(HDD_STATICS)
  .map(([name, value]) => `  ${name}: ${value};`)
  .join('\n')

export const css = `
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
`

/** Inject the theme stylesheet once. Returns a disposer. */
export function injectStyles(doc = document) {
  const existing = doc.querySelector(`style[data-plugin-css][data-plugin="${PLUGIN_ID}"]`)
  if (existing) return () => {}
  const tag = doc.createElement('style')
  tag.setAttribute('data-plugin', PLUGIN_ID)
  tag.setAttribute('data-plugin-css', '')
  tag.setAttribute('data-dsh-fairy-style', STYLE_ID)
  tag.textContent = css
  doc.head.append(tag)
  return () => {
    tag.remove()
  }
}
