/**
 * dsh-fairy-visual — the HDD presentation of Fairy.
 *
 * Client entry. It owns the visual layer only: the HDD document mode, the paint
 * background host, the Fairy stage, the HDD toggle and its own settings page.
 * Every side effect goes through a Cordis effect disposer, so disabling the
 * plugin restores the stock interface with no leftover nodes or attributes.
 */
import * as React from 'react'
import { MODE_ATTR, VISUAL_ATTR, DEFAULT_SETTINGS } from 'dsh-fairy-contracts'
import { injectStyles } from './style.js'
import { createStage } from './mascot.js'
import { mountBackgroundHost } from './background.js'
import { createSettingsStore, loadSettings } from './settings.js'
import { createMarkers } from './markers.js'
import { HddToggle, SettingsSection } from './panel.js'
import { createProbe } from './probe.js'
import { runTransition } from './transition.js'

export const name = 'fairy-visual'
export const inject = ['slots']

const h = React.createElement
const POWER_ATTR = 'data-dsh-fairy-power'
const TRANSITION_ATTR = 'data-dsh-fairy-transition'
const HEADER_SLOT = 'conversation.session.header.utilities'
const HEADER_SLOT_NODE = `[data-slot="${HEADER_SLOT}"]`
const TICK_MS = 700

/** Foreign skin markers this theme must not fight with. */
const FOREIGN_SKIN_ATTRS = ['data-dsh-maid-atelier', 'data-dsh-skin', 'data-dsh-theme-skin']

const safeGet = (ctx, key) => {
  try {
    return ctx?.get?.(key)
  } catch {
    return undefined
  }
}

function detectForeignSkin() {
  if (typeof document === 'undefined') return null
  for (const attr of FOREIGN_SKIN_ATTRS) {
    if (document.documentElement.hasAttribute(attr) || document.body?.hasAttribute(attr)) return attr
  }
  return null
}

/** Derives the projected activity from the official session service. */
function detectActivity(ctx) {
  const ui = safeGet(ctx, 'uiSession')
  if (!ui) return { activity: 'normal', lifecycle: 'idle' }
  let running = false
  try {
    const value = ui.running
    running = typeof value === 'function' ? Boolean(value()) : Boolean(value)
    if (!running && ui.sessionStatus && typeof ui.sessionStatus === 'object') {
      const status = ui.sessionStatus
      running = status.running === true || status.state === 'running' || status.state === 'streaming'
    }
  } catch {
    running = false
  }
  return running ? { activity: 'thinking', lifecycle: 'running' } : { activity: 'normal', lifecycle: 'idle' }
}

export function apply(ctx) {
  const store = createSettingsStore(React)
  const FairyStage = createStage(h)
  const probe = createProbe(ctx)

  /* --- activity projection (tiny external store, not persisted) --- */
  let activity = 'normal'
  let lifecycle = 'idle'
  const activityListeners = new Set()
  const publishActivity = (next, nextLifecycle) => {
    if (next === activity && nextLifecycle === lifecycle) return
    activity = next
    lifecycle = nextLifecycle
    for (const listener of activityListeners) listener()
  }
  const useActivity = () =>
    React.useSyncExternalStore(
      (listener) => {
        activityListeners.add(listener)
        return () => activityListeners.delete(listener)
      },
      () => activity,
      () => activity,
    )

  /* --- document projection --- */
  let backgroundDispose = null

  let transitionTimer = 0
  let stopTransition = null
  let wasOn = null

  const applyDocument = (settings) => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const foreign = settings.coexistence === 'yield' ? detectForeignSkin() : null
    const on = Boolean(settings.enabled) && !foreign

    if (on) {
      root.setAttribute(VISUAL_ATTR, '')
      root.setAttribute(MODE_ATTR, 'hdd')
      if (!backgroundDispose) backgroundDispose = mountBackgroundHost(document)
    } else {
      root.removeAttribute(MODE_ATTR)
      root.removeAttribute(VISUAL_ATTR)
      if (backgroundDispose) {
        backgroundDispose()
        backgroundDispose = null
      }
    }

    if (settings.powerMode === 'low-power') root.setAttribute(POWER_ATTR, 'low-power')
    else root.removeAttribute(POWER_ATTR)

    /* Mode change flashes three lazy full-frame slices, then cleans up. */
    if (wasOn !== null && wasOn !== on) {
      root.setAttribute(TRANSITION_ATTR, '')
      if (transitionTimer) clearTimeout(transitionTimer)
      stopTransition?.()
      stopTransition = runTransition(document)
      transitionTimer = setTimeout(() => {
        root.removeAttribute(TRANSITION_ATTR)
        transitionTimer = 0
      }, 460)
    }
    wasOn = on

    markers.project()
  }

  ctx.effect(() => injectStyles(document), 'fairy-visual: styles')

  const markers = createMarkers(document)
  ctx.effect(
    () => () => {
      markers.dispose()
      if (transitionTimer) clearTimeout(transitionTimer)
      transitionTimer = 0
      if (stopTransition) stopTransition()
      stopTransition = null
      if (backgroundDispose) backgroundDispose()
      backgroundDispose = null
      if (typeof document !== 'undefined') {
        document.documentElement.removeAttribute(VISUAL_ATTR)
        document.documentElement.removeAttribute(MODE_ATTR)
        document.documentElement.removeAttribute(POWER_ATTR)
        document.documentElement.removeAttribute(TRANSITION_ATTR)
      }
      store.dispose()
      probe.dispose()
    },
    'fairy-visual: teardown',
  )

  applyDocument({ ...DEFAULT_SETTINGS })
  const unsubscribe = store.subscribe(() => applyDocument(store.get()))

  void loadSettings().then((settings) => {
    store.replace(settings)
    applyDocument(settings)
  })

  /* --- session header availability (the blank Hero face has no Session header) --- */
  let hasHeaderSlot = false
  const headerListeners = new Set()
  const publishHeader = (next) => {
    if (next === hasHeaderSlot) return
    hasHeaderSlot = next
    for (const listener of headerListeners) listener()
  }
  const useHeaderSlot = () =>
    React.useSyncExternalStore(
      (listener) => {
        headerListeners.add(listener)
        return () => headerListeners.delete(listener)
      },
      () => hasHeaderSlot,
      () => hasHeaderSlot,
    )

  /* --- one tick drives activity + header availability --- */
  const headerVisible = () => {
    if (typeof document === 'undefined') return false
    const outlet = document.querySelector(HEADER_SLOT_NODE)
    return Boolean(outlet && outlet.childElementCount > 0)
  }
  const tick = () => {
    const next = detectActivity(ctx)
    publishActivity(next.activity, next.lifecycle)
    publishHeader(headerVisible())
  }
  const timer = setInterval(tick, TICK_MS)
  ctx.effect(() => () => clearInterval(timer), 'fairy-visual: activity tick')
  setTimeout(tick, 1200)

  /* --- slot surfaces --- */
  function StageHost() {
    const settings = store.useSettings()
    const currentActivity = useActivity()
    const headerSlot = useHeaderSlot()
    return h(
      React.Fragment,
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
        )
      }),
    'fairy-visual: shell overlay',
  )

  ctx.effect(
    () =>
      ctx.slots.inject(HEADER_SLOT, function* () {
        yield ctx.slots.register(
          { name: HEADER_SLOT, id: 'fairy-hdd-toggle', order: 60 },
          HeaderToggle,
        )
      }),
    'fairy-visual: header toggle',
  )

  ctx.effect(
    () =>
      ctx.slots.inject('settings.section', function* () {
        yield ctx.slots.register(
          { name: 'settings.section', id: 'fairy-visual', order: 40, label: () => 'Fairy 界面' },
          FairySettingsSection,
        )
      }),
    'fairy-visual: settings section',
  )
}
