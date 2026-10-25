import { CHIBI_THUMB_ATTR, MODE_ATTR, POWER_MODE_ATTR, THEME_ATTR } from './constants.js';

import { deriveSessionComfort } from './comfort-detector.js';

const INJECTED_ATTR = 'data-dsh-fairy-chibi-injected';
let chibiWanted = false;
let thumbObserver = null;
let thumbFrame = 0;

/** The third-party slider keys its sprite thumb off a `.is-chibi` class it only
 *  picks up at module init. Adding the class ourselves lets the opt-in apply
 *  without a reload; we only ever remove a class we added. */
function applyChibiThumb() {
  if (typeof document === 'undefined') return;
  for (const effort of document.querySelectorAll('.re-effort')) {
    const injected = effort.getAttribute(INJECTED_ATTR) === 'true';
    if (chibiWanted && !effort.classList.contains('is-chibi')) {
      effort.classList.add('is-chibi');
      effort.setAttribute(INJECTED_ATTR, 'true');
    } else if (!chibiWanted && injected) {
      effort.classList.remove('is-chibi');
      effort.removeAttribute(INJECTED_ATTR);
    }
  }
}

function scheduleChibiThumb() {
  if (thumbFrame) return;
  thumbFrame = requestAnimationFrame(() => {
    thumbFrame = 0;
    applyChibiThumb();
  });
}

function watchChibiThumb() {
  if (thumbObserver || typeof MutationObserver === 'undefined') return;
  thumbObserver = new MutationObserver(scheduleChibiThumb);
  thumbObserver.observe(document.body, { childList: true, subtree: true });
}

export function syncReasoningThumb(wanted) {
  chibiWanted = wanted === true;
  if (!chibiWanted && !thumbObserver) return;
  watchChibiThumb();
  applyChibiThumb();
}

export function deriveSessionActivity(snapshot) {
  if (deriveSessionComfort(snapshot)) return 'comforting';
  return snapshot?.running === true ? 'thinking' : 'normal';
}

export function syncDocumentMode(snapshot) {
  // Settings snapshots carry the persisted value under `value`; keeping the
  // projection here makes the document state authoritative for every visual
  // surface and prevents controls from drifting from their CSS scope.
  const value = snapshot?.value || snapshot || {};
  if (snapshot?.status === 'loading') return;
  const enabled = Boolean(value.enabled);
  const theme = value.theme === 'light' ? 'light' : 'dark';
  const powerMode = value.powerMode === 'low-power' ? 'low-power' : 'normal';
  const root = document.documentElement;

  if (enabled) {
    root.setAttribute('data-dsh-fairy-visual', '');
    root.setAttribute(THEME_ATTR, theme);
    root.setAttribute(MODE_ATTR, 'hdd');
    root.setAttribute(POWER_MODE_ATTR, powerMode);
    // Opt-in sprite thumb for the reasoning slider; the plain knob is the
    // reference default, so the attribute is only written when asked for.
    if (value.chibiThumb === true) root.setAttribute(CHIBI_THUMB_ATTR, 'true');
    else root.removeAttribute(CHIBI_THUMB_ATTR);
    syncReasoningThumb(value.chibiThumb === true);
  } else {
    root.removeAttribute('data-dsh-fairy-visual');
    root.removeAttribute(THEME_ATTR);
    root.removeAttribute(MODE_ATTR);
    root.removeAttribute(POWER_MODE_ATTR);
    root.removeAttribute(CHIBI_THUMB_ATTR);
    syncReasoningThumb(false);
  }
}
