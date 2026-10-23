/**
 * Cross-plugin contract constants. Immutable values only: no DOM, no network,
 * no timers, no persistence. Every other Fairy package imports from here so the
 * document attributes and settings shape cannot drift apart.
 */

/** Host settings namespace owned by dsh-fairy-visual. */
export const SETTINGS_NAMESPACE = 'fairy-visual'

/** Persisted settings schema version. A mismatch is rejected, never migrated silently. */
export const SCHEMA_VERSION = 2

/** Root CSS gate: every Fairy style is scoped under this attribute. */
export const VISUAL_ATTR = 'data-dsh-fairy-visual'

/** ``hdd`` while the Fairy HDD presentation is active, removed in normal mode. */
export const MODE_ATTR = 'data-dsh-fairy-mode'

/** Documents the voice control group; written by dsh-fairy-voice only. */
export const VOICE_CONTROL_ATTR = 'data-dsh-fairy-voice-control'

/** Short-lived semantic markers projected by the visual marker controller. */
export const MARKERS = Object.freeze({
  brandAnchor: 'data-dsh-fairy-brand-anchor',
  nativeNewSession: 'data-dsh-fairy-native-new-session',
  backgroundSurface: 'data-dsh-fairy-background-surface',
  sidebarSurface: 'data-dsh-fairy-sidebar-surface',
  sidebarLayer: 'data-dsh-fairy-sidebar-layer',
  composerSeat: 'data-dsh-fairy-composer-seat',
  transitionBackground: 'data-dsh-transition-background',
})

export const THEMES = Object.freeze(['dark', 'light'])
export const POWER_MODES = Object.freeze(['normal', 'low-power'])
export const ACTIVITY = Object.freeze(['normal', 'thinking', 'comforting'])
export const LIFECYCLE = Object.freeze(['idle', 'running', 'completed'])
export const COEXISTENCE = Object.freeze(['auto', 'yield', 'coexist'])

/** Composer dock geometry, in CSS pixels. */
export const COMPOSER_DOCK = Object.freeze({ min: 132, max: 420, narrowMin: 260, narrowWidth: 600 })

/** z-index ladder. Background host paints under #root; the rest live in the shell overlay. */
export const Z = Object.freeze({
  backgroundHost: 0,
  appRoot: 1,
  heroClone: 9,
  stage: 10,
  fixedControls: 20,
  sidebarBoard: 0,
  sidebarContent: 1,
  sidebarHistoryShadow: 3,
  sidebarScrollbar: 4,
  sidebarRidge: 5,
})

/** Public semantic anchors of the official UI (verified against 0.2.1-rc.2). */
export const ANCHORS = Object.freeze({
  sessionTree: '[role="tree"][aria-label="会话"]',
  conversationScroll: '[data-conversation-scroll]',
  inputScroll: '[data-input-scroll]',
  chatFlow: '[data-chat-flow]',
  composerCard: '[data-composer-card="true"]',
})

export const DEFAULT_SETTINGS = Object.freeze({
  version: SCHEMA_VERSION,
  enabled: false,
  theme: 'dark',
  mascotVisible: true,
  powerMode: 'normal',
  composerDockHeight: COMPOSER_DOCK.min,
  accent: 'fairy-blue',
  diagnostics: false,
  coexistence: 'auto',
})

/** Clamps a persisted dock height to the geometry the viewport allows. */
export function clampDockHeight(value, viewportWidth) {
  const min = viewportWidth < COMPOSER_DOCK.narrowWidth ? COMPOSER_DOCK.narrowMin : COMPOSER_DOCK.min
  if (!Number.isFinite(value)) return min
  return Math.min(COMPOSER_DOCK.max, Math.max(min, Math.round(value)))
}
