const React = require('react');
const { jsx, jsxs } = require('react/jsx-runtime');
const { createFairyDiagnostics } = require('../../../dsh-fairy-contracts/client-diagnostics.cjs');
const { SETTINGS_NAMESPACE, STYLE_ID, MODE_ATTR, POWER_MODE_ATTR, THEME_ATTR, POWER_TOGGLE_WIDTH, POWER_TOGGLE_HEIGHT, DEFAULT } = require('./constants.js');
const IDENTITY_SETTINGS_NAMESPACE = 'fairy-identity';
const PERSONA_SETTINGS_NAMESPACE = 'fairy-persona';
const { deriveSessionActivity, syncDocumentMode } = require('./utils.js');
const { createSettingsHandle } = require('./scope-shim.js');
const { createSessionSource } = require('./session-source.js');
const { injectStyles } = require('./style.js');
const { mountComposerDock } = require('./composer-dock.js');
const { createLifecycleScope, claimSingleton } = require('./lifecycle.js');
const { createManagedMutationObserver, getDomObserverManager } = require('./dom-observer-manager.js');
const { createMascotRuntime } = require('./mascot-runtime.js');
const semanticMarkersManager = require('./semantic-markers-manager.js');
const sidebarGeometryManager = require('./sidebar-geometry-manager.js');
const scrollbarsManager = require('./scrollbars-manager.js');
const heroProjectionManager = require('./hero-projection-manager.js');
const { ownControllerLifecycle, disposeControllerLifecycle } = require('./controller-lifecycle.js');
const { claimStageGeometryLifecycle } = require('./stage-lifecycle.js');
const { claimContentFadeLifecycle } = require('./content-fade.js');
const { claimMascotLifecycle } = require('./mascot-lifecycle.js');
const { claimBrandSidebarGeometry } = require('./brand-sidebar-geometry.js');
const { claimPowerModeGeometry } = require('./power-mode.js');
const { createSelectionGuard } = require('./selection-guard.js');
const { scheduleMascotScale, MASCOT_GEOMETRY_EVENT } = require('./mascot-scale-control.js');
const { saveControllerSetting } = require('./settings-write.js');
const { mutationTouchesSurface } = require('./surface-utils.js');
const { migrateVisualSettings, normalizeSetting } = require('./settings-normalizer.cjs');
const { createVisualTransitions } = require('./visual-transitions.js');
const {
  OFFICIAL_SELECTORS,
  OFFICIAL_ATTRIBUTES,
  rootSlot,
  sidebar,
  conversation,
  conversationScroll,
  anyPhase,
  composerSeat,
  composerCard,
  conversationComposerDock,
  chatFlows,
  balanceAction,
  sidebarResizeHandle,
  reportMissingCapabilities,
} = require('./dom-adapter.js');

const visualTransitions = createVisualTransitions({ rootSlot, modeAttr: MODE_ATTR, conversation, anyPhase, composerSeat, composerCard });
const mascotRuntime = createMascotRuntime();
const diagnostics = createFairyDiagnostics('dsh-fairy-visual');

    /* The mascot runtime is isolated from React and owns only its visual lifecycle. */
    class Controller {
      constructor(settings, sessionSource) {
        this.settings = settings;
        this.sessionSource = sessionSource;
        this.modeTransition = visualTransitions.createModeTransition();
        this.sessionTransition = visualTransitions.createSessionTransition();
        this.themeTransition = visualTransitions.createThemeTransition(this.modeTransition);
        this.listeners = new Set();
        this.session = null;
        this.boundSessionId = undefined;
        this.hasBoundSession = false;
        this.state = {
          settings: migrateVisualSettings({ ...DEFAULT, ...(settings.getSnapshot().value || {}) }),
          activity: 'normal',
          lifecycle: 'idle',
          sessionId: undefined,
        };
        this.lastGoodSettings = this.state.settings;
        this.listOff = sessionSource.subscribe(() => this.bind());
        this.settingsOff = settings.subscribe(() => {
          const next = settings.getSnapshot();
          const normalized = migrateVisualSettings({ ...DEFAULT, ...(next.value || {}) });
          syncDocumentMode({ ...next, value: normalized });
          this.state = { ...this.state, settings: normalized };
          this.lastGoodSettings = normalized;
          this.emit();
        });
        this.lifecycle = ownControllerLifecycle(this);
        this.bind();
      }

      subscribe = (listener) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
      };

      getSnapshot = () => this.state;

      emit() {
        this.listeners.forEach((listener) => listener());
      }

      bind() {
        const id = this.sessionSource.currentId();
        const next = id == null ? null : this.sessionSource.binding(id)?.session || null;
        if (this.hasBoundSession && id !== this.boundSessionId && this.state.settings.enabled) this.sessionTransition.trigger();
        this.boundSessionId = id;
        this.hasBoundSession = true;
        if (next === this.session) return this.update();
        this.sessionOff?.();
        this.session = next;
        this.sessionOff = next?.subscribe(() => this.update()) || null;
        this.update();
      }

      update() {
        const snap = this.session?.getSnapshot?.();
        let activity = 'normal';
        let lifecycle = 'idle';
        const sessionId = this.session?.sessionId;
        if (snap) {
          lifecycle = snap.running ? 'running' : snap.blank ? 'idle' : 'completed';
          activity = deriveSessionActivity(snap);
        }
        if (this.state.activity === activity && this.state.lifecycle === lifecycle && this.state.sessionId === sessionId) return;
        this.state = { ...this.state, activity, lifecycle, sessionId };
        this.emit();
      }

      set(field, value) {
        const normalized = normalizeSetting(field, value, this.state.settings);
        if (field === 'enabled' && normalized !== this.state.settings.enabled) this.modeTransition.trigger();
        const write = () => this.settings.set(field, normalized);
        return Promise.resolve().then(() => field === 'theme' && normalized !== this.state.settings.theme ? this.themeTransition.run(write) : write()).catch((error) => {
          this.state = { ...this.state, settings: this.lastGoodSettings || migrateVisualSettings(DEFAULT) };
          this.emit();
          throw error;
        });
      }

      dispose() {
        disposeControllerLifecycle(this.lifecycle);
        mascotRuntime?.dispose?.();
        document.documentElement.removeAttribute('data-dsh-fairy-visual');
        document.documentElement.removeAttribute(MODE_ATTR);
        document.documentElement.removeAttribute(POWER_MODE_ATTR);
        document.documentElement.removeAttribute(THEME_ATTR);
        document.getElementById(STYLE_ID)?.remove();
        visualTransitions.removeFairyContainer();
      }
    }

    const { SidebarBoardCutout } = sidebarGeometryManager.install();
    const { HddOverlayScrollbars } = scrollbarsManager.install();

    function HddBackgroundFxHost({ enabled }) {
      React.useLayoutEffect(() => {
        if (!enabled || !document.body) return undefined;
        const host = document.createElement('div');
        host.className = 'dsh-hdd-background-host';
        host.setAttribute('data-dsh-fairy-background-host', 'true');
        host.setAttribute('aria-hidden', 'true');
        const fx = document.createElement('div');
        fx.className = 'dsh-hdd-fx';
        for (const variant of ['a', 'b', 'c']) {
          const glow = document.createElement('div');
          glow.className = `dsh-hdd-glow dsh-hdd-glow-${variant}`;
          fx.appendChild(glow);
        }
        host.appendChild(fx);
        document.body.insertBefore(host, document.body.firstElementChild);
        return () => host.remove();
      }, [enabled]);
      return null;
    }

    const useController = (controller) => React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
    const save = saveControllerSetting;

    function Toggle({ controller }) {
      const state = useController(controller);
      const on = state.settings.enabled;
      const theme = state.settings.theme === 'light' ? 'light' : 'dark';
      return jsxs('div', {
        className: 'dsh-fairy-toggle-group',
        role: 'group',
        'aria-label': 'H.D.D 视觉控制',
        children: [
          jsxs('button', {
            type: 'button',
            className: 'dsh-fairy-toggle',
            'data-on': String(on),
            'aria-pressed': String(on),
            'aria-label': on ? '关闭 H.D.D 视觉' : '启用 H.D.D 视觉',
            onClick: () => save(controller, 'enabled', !on),
            children: [jsx('span', { className: 'dsh-fairy-dot' }), 'H.D.D'],
          }),
          jsx('button', {
            type: 'button',
            className: 'dsh-fairy-theme-toggle',
            'data-theme': theme,
            disabled: !on,
            'aria-label': theme === 'dark' ? '切换到日间模式' : '切换到夜间模式',
            title: theme === 'dark' ? '切换到日间模式' : '切换到夜间模式',
            onClick: () => save(controller, 'theme', theme === 'dark' ? 'light' : 'dark'),
            children: jsx('span', { className: 'dsh-fairy-theme-icon', 'aria-hidden': 'true' }),
          }),
        ],
      });
    }

    const { HeroToggleHost, HeroHost, ActiveComposerPlaceholder } = heroProjectionManager.install(null, { Toggle, useController });

    function FairyMarkEye() {
      return jsxs('span', {
        className: 'dsh-fairy-mark-eye',
        'aria-hidden': 'true',
        children: ['top', 'right', 'bottom', 'left'].map((side) => jsx('span', { className: 'dsh-fairy-mark-brow', 'data-side': side }, side)),
      });
    }

    function FairyMarkCopy() {
      return jsxs('span', {
        className: 'dsh-fairy-mark-copy',
        children: [
          jsx('span', { className: 'dsh-fairy-mark-title', children: 'Fairy' }),
          jsx('span', { className: 'dsh-fairy-mark-sub', children: 'Ⅲ型总序式集成泛用人工智能' }),
        ],
      });
    }

    function FairyMark({ controller }) {
      const state = useController(controller);
      const on = state.settings.enabled;
      const markRef = React.useRef(null);
      const glitchTimers = React.useRef(new Set());
      const glitchToken = React.useRef(0);

      React.useEffect(() => () => {
        glitchToken.current += 1;
        glitchTimers.current.forEach((timer) => clearTimeout(timer));
        glitchTimers.current.clear();
        const mark = markRef.current;
        if (mark) {
          mark.removeAttribute('data-glitch');
          ['--dsh-fairy-mark-g-x', '--dsh-fairy-mark-thread-x', '--dsh-fairy-mark-thread-2-x', '--dsh-fairy-mark-thread-3-x', '--dsh-fairy-mark-s1-x', '--dsh-fairy-mark-s2-x', '--dsh-fairy-mark-s3-x'].forEach((name) => mark.style.removeProperty(name));
        }
      }, []);

      const clearGlitch = () => {
        glitchTimers.current.forEach((timer) => clearTimeout(timer));
        glitchTimers.current.clear();
        const mark = markRef.current;
        if (!mark) return;
        mark.removeAttribute('data-glitch');
        ['--dsh-fairy-mark-g-x', '--dsh-fairy-mark-thread-x', '--dsh-fairy-mark-thread-2-x', '--dsh-fairy-mark-thread-3-x', '--dsh-fairy-mark-s1-x', '--dsh-fairy-mark-s2-x', '--dsh-fairy-mark-s3-x'].forEach((name) => mark.style.removeProperty(name));
      };
      const pulseGlitch = (mode) => {
        const mark = markRef.current;
        if (!mark) return;
        const random = (min, max) => min + Math.random() * (max - min);
        const next = { '--dsh-fairy-mark-g-x': `${random(-1.2, 1.2).toFixed(2)}px` };
        if (mode === 'blocks') {
          const polarity = Math.random() < .5 ? -1 : 1;
          for (let index = 1; index <= 3; index += 1) {
            const direction = index % 2 === 0 ? polarity : -polarity;
            next[`--dsh-fairy-mark-s${index}-x`] = `${(direction * random(4.2, 6.2)).toFixed(2)}px`;
          }
        } else {
          const offset = random(-9, 9);
          next['--dsh-fairy-mark-thread-x'] = `${offset.toFixed(2)}px`;
          next['--dsh-fairy-mark-thread-2-x'] = `${(-offset * .8).toFixed(2)}px`;
          next['--dsh-fairy-mark-thread-3-x'] = `${(offset * .45).toFixed(2)}px`;
        }
        Object.entries(next).forEach(([name, value]) => mark.style.setProperty(name, value));
        mark.setAttribute('data-glitch', mode);
      };
      const triggerGlitch = () => {
        clearGlitch();
        const token = ++glitchToken.current;
        const schedule = (delay, callback) => {
          const timer = setTimeout(() => {
            glitchTimers.current.delete(timer);
            if (token === glitchToken.current) callback();
          }, delay);
          glitchTimers.current.add(timer);
        };
        // Original sequence: two thread pulses, a 28ms handoff, then two block
        // pulses followed by four thread pulses, all with 40ms spacing.
        [['threads', 0], ['threads', 40], ['blocks', 68], ['blocks', 108], ['threads', 148], ['threads', 188], ['threads', 228], ['threads', 268]].forEach(([mode, delay]) => {
          schedule(delay, () => pulseGlitch(mode));
        });
        schedule(296, clearGlitch);
      };

      return jsxs('button', {
        ref: markRef,
        type: 'button',
        className: 'dsh-fairy-mark',
        'data-enabled': String(on),
        'data-on': String(state.settings.mascotVisible),
        'aria-pressed': String(state.settings.mascotVisible),
        'aria-label': state.settings.mascotVisible ? '隐藏 Fairy 主视觉' : '显示 Fairy 主视觉',
        onPointerDown: (event) => event.stopPropagation(),
        onMouseDown: (event) => event.stopPropagation(),
        onTouchStart: (event) => event.stopPropagation(),
        onClick: (event) => {
          event.preventDefault();
          event.stopPropagation();
          const nextVisible = !state.settings.mascotVisible;
          triggerGlitch();
          save(controller, 'mascotVisible', nextVisible);
        },
        children: [
          jsx(FairyMarkEye, {}),
          jsx(FairyMarkCopy, {}),
          ...[1, 2, 3].map((index) => jsxs('span', { className: 'dsh-fairy-mark-glitch-slice', 'data-slice': String(index), 'aria-hidden': 'true', children: [jsx(FairyMarkEye, {}), jsx(FairyMarkCopy, {})] }, index)),
        ],
      });
    }
    const CHAT_SURFACE_SELECTOR = `${OFFICIAL_SELECTORS.chatFlow}, ${OFFICIAL_SELECTORS.conversationScroll}`;
    const STAGE_SURFACE_SELECTOR = OFFICIAL_SELECTORS.conversation;
    const resolveStageSurface = () => anyPhase(conversation(document));
    const hasChatSurfaceMutation = (records) => records.some((record) => (record.type === 'attributes' && record.target.matches?.(CHAT_SURFACE_SELECTOR)) || [...record.addedNodes, ...record.removedNodes].some((node) => node.nodeType === 1 && (node.matches?.(CHAT_SURFACE_SELECTOR) || node.querySelector?.(CHAT_SURFACE_SELECTOR))));
    const hasStageSurfaceMutation = (records) => records.some((record) => [...record.addedNodes, ...record.removedNodes].some((node) => node.nodeType === 1 && (node.matches?.(STAGE_SURFACE_SELECTOR) || node.querySelector?.(STAGE_SURFACE_SELECTOR))));

    // Lifecycle: Fairy mascot runtime
    // Owner: stage node
    // Contract: lifecycle-ownership.json#owners[subsystem=Fairy mascot runtime]
    function Stage({ state }) {
      const stageRef = React.useRef(null);
      const mascotOwnerRef = React.useRef(null);
      const enabled = state.settings.enabled;
      const visible = enabled && state.settings.mascotVisible;
      const visibleRef = React.useRef(visible);
      const fadeLifecycleRef = React.useRef(null);
      visibleRef.current = visible;

      React.useLayoutEffect(() => {
        const stageNode = stageRef.current;
        if (!stageNode) return;
        const owner = { stage: stageNode, active: true };
        mascotOwnerRef.current = owner;
        const lifecycle = claimMascotLifecycle(stageNode);
        lifecycle.add(() => {
          owner.active = false;
          if (mascotOwnerRef.current === owner) mascotOwnerRef.current = null;
          mascotRuntime?.dispose?.(owner);
        }, 'mascot-runtime:owner-dispose');
        return () => lifecycle.dispose();
      }, []);

      React.useEffect(() => {
        const stageNode = stageRef.current;
        if (!stageNode) return;
        const owner = mascotOwnerRef.current;
        if (!owner?.active) return;
        stageNode.setAttribute('data-fairy-visual-active', visible ? 'true' : 'false');
        stageNode.setAttribute('data-fairy-state', state.activity);
        if (state.settings.powerMode === 'low-power') stageNode.setAttribute('data-fairy-low-power', 'true');
        else stageNode.removeAttribute('data-fairy-low-power');
        const mascot = mascotRuntime;
        mascot?.mount?.(stageNode, owner, state.settings.mascotAnimationSpeed);
        mascot?.setVisualActive?.(visible, owner);
      }, [visible, state.activity, state.settings.powerMode, state.settings.mascotAnimationSpeed]);

      // Route gate: the plugin and automation pages are not conversation
      // surfaces — the reference keeps the mascot eye on session and hero pages
      // only. The sidebar marks those pages with aria-current="page"; when the
      // marker appears, pause the mascot runtime and fade the stage out, and
      // restore both when the marker leaves.
      React.useEffect(() => {
        if (!enabled) return undefined;
        const stageNode = stageRef.current;
        if (!stageNode || typeof MutationObserver !== 'function') return undefined;
        let routeHidden = false;
        let visibleOwner = null;
        const takeOwner = () => {
          if (visibleOwner && visibleOwner.active) return visibleOwner;
          visibleOwner = { stage: stageNode, active: true };
          return visibleOwner;
        };
        const apply = () => {
          const offRoute = Boolean(document.querySelector('[aria-current="page"]'));
          if (offRoute === routeHidden) return;
          routeHidden = offRoute;
          if (offRoute) {
            stageNode.setAttribute('data-fairy-route-hidden', 'true');
            mascotRuntime?.setVisualActive?.(false, takeOwner());
          } else {
            stageNode.removeAttribute('data-fairy-route-hidden');
            if (visibleRef.current) mascotRuntime?.setVisualActive?.(true, takeOwner());
          }
        };
        apply();
        const observer = new MutationObserver(apply);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-current', 'class'] });
        return () => {
          observer.disconnect();
          if (visibleOwner) visibleOwner.active = false;
          stageNode.removeAttribute('data-fairy-route-hidden');
        };
      }, [enabled]);

      React.useLayoutEffect(() => {
        if (!enabled) return undefined;
        return scheduleMascotScale(state.settings.mascotScale);
      }, [enabled, state.settings.mascotScale]);

      // Lifecycle: stage geometry and content fade
      // Owner: stage node
      // Contract: lifecycle-ownership.json#owners[subsystem=stage geometry and content fade]
      React.useEffect(() => {
        if (!enabled) return;
        const stageNode = stageRef.current;
        if (!stageNode) return;
        const lifecycle = claimStageGeometryLifecycle(stageNode);
        let surface = null;
        let resizeObserver = null;
        let structureObserver = null;

        const syncStageGeometry = () => {
          const rect = surface?.getBoundingClientRect();
          if (!rect || rect.width < 240 || rect.height < 1) return;
          stageNode.style.left = Math.round(rect.left) + 'px';
          stageNode.style.width = Math.round(rect.width) + 'px';
        };
        const scheduleStageGeometry = () => {
          if (!lifecycle.disposed) lifecycle.scheduleFrame('stage-geometry-sync', syncStageGeometry, 'stage-geometry:sync-frame');
        };
          const bindSurface = () => {
            const nextSurface = resolveStageSurface();
            if (nextSurface === surface) return;
            lifecycle.replaceBinding('stage-surface', () => resizeObserver?.disconnect(), 'stage-geometry:surface-resize-observer');
            resizeObserver?.disconnect();
            surface = nextSurface;
          if (typeof ResizeObserver === 'function' && surface) {
            resizeObserver = new ResizeObserver(scheduleStageGeometry);
            resizeObserver.observe(surface);
          }
          scheduleStageGeometry();
        };
        const scheduleSurfaceBind = () => {
          if (!lifecycle.disposed) lifecycle.scheduleFrame('stage-surface-bind', bindSurface, 'stage-geometry:bind-surface-frame');
        };

        bindSurface();
        if (typeof MutationObserver === 'function' && document.body) {
          structureObserver = createManagedMutationObserver((records) => {
            if (hasStageSurfaceMutation(records)) scheduleSurfaceBind();
          });
          structureObserver.observe(document.body, { childList: true, subtree: true });
        }
        window.addEventListener('resize', scheduleStageGeometry, { passive: true });
        const cleanup = () => {
          resizeObserver?.disconnect();
          structureObserver?.disconnect();
          window.removeEventListener('resize', scheduleStageGeometry);
          stageNode.style.removeProperty('left');
          stageNode.style.removeProperty('width');
        };
        lifecycle.add(cleanup, 'stage-geometry:restore-surface');
        return () => lifecycle.dispose();
      }, [enabled, state.sessionId]);

      React.useEffect(() => {
        if (!enabled) return;
        const stageNode = stageRef.current;
        if (!stageNode) return;
        const lifecycle = claimContentFadeLifecycle(stageNode);
        let revealFrame = 0;
        let resizeObserver = null;
        let structureObserver = null;
        let cleanupTimer = 0;
        let observedEye = null;
        let observedSurface = null;
        let surface = null;

        const cancelFrames = () => {
          if (revealFrame) cancelAnimationFrame(revealFrame);
          revealFrame = 0;
        };
        const cancelCleanup = () => {
          if (!cleanupTimer) return;
          clearTimeout(cleanupTimer);
          cleanupTimer = 0;
        };
        const restoreSurface = () => {
          if (!surface) return;
          surface.classList.remove('dsh-fairy-content-mask', 'dsh-fairy-content-fade');
          ['--dsh-fade-x', '--dsh-fade-y', '--dsh-fade-rx', '--dsh-fade-ry', '--dsh-fade-core', '--dsh-fade-soft-1', '--dsh-fade-soft-2', '--dsh-fade-soft-3'].forEach((name) => surface.style.removeProperty(name));
          surface = null;
        };
        const clearContentFade = (delayed = false) => {
          cancelFrames();
          surface?.classList.remove('dsh-fairy-content-fade');
          if (!delayed) {
            cancelCleanup();
            restoreSurface();
            return;
          }
          if (cleanupTimer) return;
          cleanupTimer = window.setTimeout(() => {
            cleanupTimer = 0;
            if (!visibleRef.current) restoreSurface();
          }, 360);
        };
        const scheduleContentFade = () => {
          if (!lifecycle.disposed) lifecycle.scheduleFrame('content-fade-sync', applyContentFade, 'content-fade:sync-frame');
        };
        const asFadePercent = (ratio) => Math.round(ratio * 1000) / 10 + '%';
        const applyContentFade = () => {
          const eye = stageNode.querySelector('#dsh-fairy-root');
          const nextSurface = conversationScroll(conversation(document));
          if (!visibleRef.current) return clearContentFade(true);
          if (!eye || !nextSurface) return clearContentFade();
          const hasActiveChatFlow = chatFlows(document).some((flow) => {
            const rect = flow.getBoundingClientRect();
            return flow.isConnected && rect.width > 0 && rect.height > 0;
          });
          if (!hasActiveChatFlow) return clearContentFade();
          cancelCleanup();
          if (surface !== nextSurface) {
            restoreSurface();
            surface = nextSurface;
            surface.classList.add('dsh-fairy-content-mask');
          }
          // The root contains SVG padding, halo and the oversized pulse layer.
          // The outer disc is the actual visible eye perimeter and is the only
          // geometry that should define the text occlusion core.
          const eyeBoundary = eye.querySelector('.dsh-fairy-outer-disc') || eye;
          const eyeRect = eyeBoundary.getBoundingClientRect();
          const eyeX = eyeRect.left + eyeRect.width * .5;
          const eyeY = eyeRect.top + eyeRect.height * .5;
          const surfaceRect = surface.getBoundingClientRect();
          const fadeFeatherX = Math.max(56, Math.min(76, eyeRect.width * .24));
          const fadeFeatherY = Math.max(46, Math.min(64, eyeRect.height * .20));
          const fadeRadiusX = Math.round(eyeRect.width * .5 + fadeFeatherX);
          const fadeRadiusY = Math.round(eyeRect.height * .5 + fadeFeatherY);
          // The fully occluded core is derived from the mascot's real rendered
          // perimeter, not from an arbitrary percentage of the outer fade. A
          // small margin keeps glyph antialiasing out from beneath the eye.
          const eyeBoundaryRatio = Math.min(.88, Math.max(
            eyeRect.width * .5 / fadeRadiusX,
            eyeRect.height * .5 / fadeRadiusY,
          ));
          const featherRatio = 1 - eyeBoundaryRatio;
          surface.style.setProperty('--dsh-fade-x', Math.round(eyeX - surfaceRect.left) + 'px');
          surface.style.setProperty('--dsh-fade-y', Math.round(eyeY - surfaceRect.top) + 'px');
          surface.style.setProperty('--dsh-fade-rx', fadeRadiusX + 'px');
          surface.style.setProperty('--dsh-fade-ry', fadeRadiusY + 'px');
          surface.style.setProperty('--dsh-fade-core', asFadePercent(eyeBoundaryRatio));
          surface.style.setProperty('--dsh-fade-soft-1', asFadePercent(eyeBoundaryRatio + featherRatio * .28));
          surface.style.setProperty('--dsh-fade-soft-2', asFadePercent(eyeBoundaryRatio + featherRatio * .58));
          surface.style.setProperty('--dsh-fade-soft-3', asFadePercent(eyeBoundaryRatio + featherRatio * .84));
          if (revealFrame) cancelAnimationFrame(revealFrame);
          revealFrame = requestAnimationFrame(() => {
            revealFrame = 0;
            if (visibleRef.current && surface?.isConnected) surface.classList.add('dsh-fairy-content-fade');
          });
          if (resizeObserver && (observedEye !== eyeBoundary || observedSurface !== surface)) {
            resizeObserver.disconnect();
            observedEye = eyeBoundary;
            observedSurface = surface;
            resizeObserver.observe(eyeBoundary);
            resizeObserver.observe(surface);
          }
        };

        if (typeof ResizeObserver === 'function') resizeObserver = new ResizeObserver(scheduleContentFade);

        if (typeof MutationObserver === 'function' && document.body) {
          structureObserver = createManagedMutationObserver((records) => {
            if (hasChatSurfaceMutation(records)) scheduleContentFade();
          });
          structureObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: [OFFICIAL_ATTRIBUTES.chatFlow, OFFICIAL_ATTRIBUTES.conversationScroll] });
        }
        window.addEventListener('resize', scheduleContentFade, { passive: true });
        window.addEventListener(MASCOT_GEOMETRY_EVENT, scheduleContentFade, { passive: true });
        fadeLifecycleRef.current = (nextVisible) => {
          if (nextVisible) {
            cancelCleanup();
            scheduleContentFade();
          } else {
            clearContentFade(true);
          }
        };
        scheduleContentFade();
        const cleanup = () => {
          fadeLifecycleRef.current = null;
          cancelFrames();
          resizeObserver?.disconnect();
          structureObserver?.disconnect();
          if (cleanupTimer) clearTimeout(cleanupTimer);
          restoreSurface();
          window.removeEventListener('resize', scheduleContentFade);
          window.removeEventListener(MASCOT_GEOMETRY_EVENT, scheduleContentFade);
        };
        lifecycle.add(cleanup, 'content-fade:restore-surface');
        return () => lifecycle.dispose();
      }, [enabled, state.sessionId]);

      React.useEffect(() => {
        fadeLifecycleRef.current?.(visible);
      }, [visible]);

        return jsx('div', { ref: stageRef, className: 'dsh-fairy-root dsh-fairy-stage', hidden: !enabled, 'data-visible': String(visible), 'data-fairy-visual-active': visible ? 'true' : 'false', 'data-fairy-state': state.activity, 'data-fairy-low-power': state.settings.powerMode === 'low-power' ? 'true' : undefined, 'aria-hidden': 'true' });
    }
    // The shell overlay survives sidebar column changes. Keeping the visual host here
    // preserves the original mascot DOM and its animation phase while the sidebar folds.
    function StageHost({ controller }) {
      const state = useController(controller);
      React.useLayoutEffect(() => {
        const lifecycle = claimSingleton(document, 'stage-host', createLifecycleScope('stage-host'));
        injectStyles();
        lifecycle.add(semanticMarkersManager.install(), 'stage-host:semantic-markers');
        lifecycle.add(mountComposerDock(controller), 'stage-host:composer-dock');
        return () => lifecycle.dispose();
      }, [controller]);
      return jsxs(React.Fragment, { children: [jsx(HddBackgroundFxHost, { enabled: state.settings.enabled }), jsx(SidebarBoardCutout, { enabled: state.settings.enabled }), jsx(HddOverlayScrollbars, { enabled: state.settings.enabled }), jsx(Stage, { state }), jsx(HeroHost, { controller }), jsx(ActiveComposerPlaceholder, { controller }), jsx(HeroToggleHost, { controller }), jsx(BrandHost, { controller }), jsx(PowerHost, { controller })] });
    }

    // Lifecycle: brand and power geometry
    // Owner: React host node
    // Contract: lifecycle-ownership.json#owners[subsystem=brand and power geometry]
    function BrandHost({ controller }) {
      const state = useController(controller);
      const hostRef = React.useRef(null);
      const enabled = state.settings.enabled;
      const [positioned, setPositioned] = React.useState(false);

      React.useEffect(() => {
        const host = hostRef.current;
        if (!host || !enabled) {
          setPositioned(false);
          return;
        }
        const lifecycle = claimBrandSidebarGeometry(host);
        let brand = null;
        let resizeObserver = null;
        let structureObserver = null;

        const syncBrandGeometry = () => {
          const next = sidebar(document)?.querySelector('[data-dsh-fairy-brand-anchor="true"]') || null;
          if (next !== brand) {
            lifecycle.replaceBinding('brand-node', () => resizeObserver?.disconnect(), 'brand-geometry:node-resize-observer');
            resizeObserver?.disconnect();
            brand = next;
            if (typeof ResizeObserver === 'function' && brand) {
              resizeObserver = new ResizeObserver(scheduleBrandGeometry);
              resizeObserver.observe(brand);
              if (brand.parentElement) resizeObserver.observe(brand.parentElement);
            }
          }
          if (!brand) {
            setPositioned(false);
            return;
          }
          const rect = brand.getBoundingClientRect();
          if (rect.width < 1 || rect.height < 1) {
            setPositioned(false);
            return;
          }
          host.style.left = Math.round(rect.left) + 'px';
          host.style.top = Math.round(rect.top + rect.height * .5 - 21) + 'px';
          setPositioned(true);
        };
        const scheduleBrandGeometry = () => {
          if (!lifecycle.disposed) lifecycle.scheduleFrame('brand-geometry-sync', syncBrandGeometry, 'brand-geometry:sync-frame');
        };

        syncBrandGeometry();
        if (typeof MutationObserver === 'function' && document.body) {
          structureObserver = createManagedMutationObserver((records) => {
            if (mutationTouchesSurface(records, `${OFFICIAL_SELECTORS.sidebar}, ${OFFICIAL_SELECTORS.sidebarBrandMark}, ${OFFICIAL_SELECTORS.newSession}`, ['aria-label', 'data-dsh-fairy-brand-anchor'])) scheduleBrandGeometry();
          });
          structureObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label', 'data-dsh-fairy-brand-anchor'] });
        }
        window.addEventListener('resize', scheduleBrandGeometry, { passive: true });
        const cleanup = () => {
          resizeObserver?.disconnect();
          structureObserver?.disconnect();
          window.removeEventListener('resize', scheduleBrandGeometry);
          host.style.removeProperty('left');
          host.style.removeProperty('top');
        };
        lifecycle.add(cleanup, 'brand-geometry:restore-host');
        return () => lifecycle.dispose();
      }, [enabled]);

      return jsx('div', { ref: hostRef, className: 'dsh-fairy-brand-host', 'data-positioned': String(positioned), hidden: !enabled || !positioned, children: jsx(FairyMark, { controller }) });
    }

    function PowerToggle({ controller }) {
      const state = useController(controller);
      const on = state.settings.powerMode === 'low-power';
      return jsxs('button', {
        type: 'button',
        className: 'dsh-fairy-power-toggle',
        'data-on': String(on),
        'aria-pressed': String(on),
        'aria-label': on ? '关闭省电模式' : '开启省电模式',
        onClick: () => save(controller, 'powerMode', on ? 'normal' : 'low-power'),
        children: [jsx('span', { className: 'dsh-fairy-power-dot' }), on ? '省电模式' : '普通模式'],
      });
    }

    function PowerHost({ controller }) {
      const state = useController(controller);
      const hostRef = React.useRef(null);
      const [positioned, setPositioned] = React.useState(false);
      const enabled = state.settings.enabled;

      React.useLayoutEffect(() => {
        const host = hostRef.current;
        if (!host || !enabled) {
          setPositioned(false);
          return;
        }
        const lifecycle = claimPowerModeGeometry(host);
        let balance = null;
        let conversation = null;
        let resizeObserver = null;
        let structureObserver = null;

        const syncPowerGeometry = () => {
          const nextBalance = balanceAction(document);
          const nextConversation = resolveStageSurface();
          if (nextBalance !== balance || nextConversation !== conversation) {
            resizeObserver?.disconnect();
            balance = nextBalance;
            conversation = nextConversation;
            if (typeof ResizeObserver === 'function') {
              resizeObserver = new ResizeObserver(schedulePowerGeometry);
              if (balance) resizeObserver.observe(balance);
              if (conversation) resizeObserver.observe(conversation);
            }
          }
          if (!balance || !conversation) return setPositioned(false);
          const balanceRect = balance.getBoundingClientRect();
          const conversationRect = conversation.getBoundingClientRect();
          const dailyRow = balance.children[1];
          const amountRow = balance.children[2];
          if (!dailyRow || !amountRow) return setPositioned(false);
          const rectUnion = (nodes) => {
            const rects = nodes.map((node) => node?.getBoundingClientRect()).filter((rect) => rect && rect.width > 0 && rect.height > 0);
            if (!rects.length) return null;
            const left = Math.min(...rects.map((rect) => rect.left));
            const top = Math.min(...rects.map((rect) => rect.top));
            const right = Math.max(...rects.map((rect) => rect.right));
            const bottom = Math.max(...rects.map((rect) => rect.bottom));
            return { left, top, right, bottom, width: right - left, height: bottom - top };
          };
          const dailyRect = rectUnion([...dailyRow.children]) || rectUnion([dailyRow]);
          const amountRect = amountRow.getBoundingClientRect();
          if (!dailyRect || amountRect.width <= 0 || amountRect.height <= 0) return setPositioned(false);
          const left = Math.round(dailyRect.left + (dailyRect.width - POWER_TOGGLE_WIDTH) / 2);
          const top = Math.round(amountRect.top + (amountRect.height - POWER_TOGGLE_HEIGHT) / 2);
          const fitsExpandedSidebar = balanceRect.width >= 180 && left >= balanceRect.left + 8 && left + POWER_TOGGLE_WIDTH <= balanceRect.right - 4 && left + POWER_TOGGLE_WIDTH <= conversationRect.left - 4 && top >= balanceRect.top + 4 && top + POWER_TOGGLE_HEIGHT <= balanceRect.bottom - 4;
          if (!fitsExpandedSidebar || balanceRect.height < 26) return setPositioned(false);
          host.style.left = left + 'px';
          host.style.top = top + 'px';
          setPositioned(true);
        };
        const schedulePowerGeometry = () => {
          if (!lifecycle.disposed) lifecycle.scheduleFrame('power-geometry-sync', syncPowerGeometry, 'power-geometry:sync-frame');
        };

        syncPowerGeometry();
        if (typeof MutationObserver === 'function' && document.body) {
          structureObserver = createManagedMutationObserver((records) => {
            if (mutationTouchesSurface(records, `${OFFICIAL_SELECTORS.sidebar}, ${OFFICIAL_SELECTORS.conversation}, ${OFFICIAL_SELECTORS.balance}`)) schedulePowerGeometry();
          });
          structureObserver.observe(document.body, { childList: true, subtree: true });
        }
        window.addEventListener('resize', schedulePowerGeometry, { passive: true });
        const cleanup = () => {
          resizeObserver?.disconnect();
          structureObserver?.disconnect();
          window.removeEventListener('resize', schedulePowerGeometry);
          host.style.removeProperty('left');
          host.style.removeProperty('top');
        };
        lifecycle.add(cleanup, 'power-geometry:restore-host');
        return () => lifecycle.dispose();
      }, [enabled]);

      return jsx('div', { ref: hostRef, className: 'dsh-fairy-power-host', hidden: !enabled || !positioned, children: jsx(PowerToggle, { controller }) });
    }

    function useHddVisualMode() {
      const readMode = () => document.documentElement?.hasAttribute('data-dsh-fairy-visual') === true;
      const observerManager = getDomObserverManager(document);
      React.useEffect(() => {
        if (readMode()) observerManager.resume();
        else observerManager.suspend();
      });
      return React.useSyncExternalStore((notify) => {
        if (typeof MutationObserver !== 'function' || !document.documentElement) return () => {};
        const observer = createManagedMutationObserver(notify);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-dsh-fairy-visual'] });
        return () => observer.disconnect();
      }, readMode, readMode);
    }

    function SessionMetricsControl({ controller }) {
      const [open, setOpen] = React.useState(false);
      const [, setRevision] = React.useState(0);
      const buttonRef = React.useRef(null);
      const panelRef = React.useRef(null);
      const hdd = useHddVisualMode();
      const sessionState = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot);
      const readStats = () => conversationComposerDock()?.textContent?.trim().replace(/\s+/g, ' ') || '';
      const stats = readStats();
      const statItems = stats.split(/\s*\|\s*/).map((item) => item.trim()).filter(Boolean);
      React.useEffect(() => {
        if (!hdd) return undefined;
        const source = conversationComposerDock();
        if (!source || typeof MutationObserver !== 'function') return undefined;
        const observer = createManagedMutationObserver(() => setRevision((value) => value + 1));
        observer.observe(source, { childList: true, subtree: true, characterData: true });
        return () => observer.disconnect();
      }, [hdd]);
      React.useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
          if (buttonRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) return;
          setOpen(false);
        };
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            buttonRef.current?.focus();
          }
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown);
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true);
          document.removeEventListener('keydown', onKeyDown);
        };
      }, [open]);
      if (!hdd) return null;
      // A new (blank) session has nothing to report, and its dock carries no stats
      // text yet: stay out of the header until the session actually holds a turn.
      // The collapsed placeholder keeps the header run right-aligned (it owns the
      // auto margin) so the toggle group does not jump when stats appear.
      if (!sessionState || sessionState.lifecycle === 'idle') {
        return jsx('span', { className: 'dsh-fairy-session-metrics dsh-fairy-session-metrics-idle', 'data-dsh-fairy-session-metrics': 'idle' });
      }
      const panelId = 'dsh-fairy-session-metrics-panel';
      return jsxs('span', { className: 'dsh-fairy-session-metrics', children: [
        jsx('button', {
          ref: buttonRef,
          type: 'button',
          className: 'dsh-fairy-session-metrics-button',
          'aria-expanded': open,
          'aria-controls': panelId,
          onClick: () => setOpen((value) => !value),
          children: '统计',
        }),
        open ? jsx('div', { ref: panelRef, id: panelId, className: 'dsh-fairy-session-metrics-panel', role: 'dialog', 'aria-label': '会话统计', children: statItems.length ? statItems.map((item, index) => jsx('div', { className: 'dsh-fairy-session-metrics-item', children: item }, `${index}:${item}`)) : '暂无会话统计' }) : null,
      ] });
    }

    function Settings({ controller, identitySettings, personaSettings }) {
      const state = useController(controller);
      // Keep a cached value for the host settings bridge. Some host versions
      // return a fresh snapshot wrapper on every read; passing that directly to
      // useSyncExternalStore makes React treat every render as a change and can
      // abort the settings section render entirely. The visual Controller above
      // already follows the same stable-subscription pattern.
      const readIdentity = () => identitySettings.getSnapshot()?.value || {};
      const [identityValue, setIdentityValue] = React.useState(readIdentity);
      React.useEffect(() => {
        const refresh = () => setIdentityValue(readIdentity());
        refresh();
        return identitySettings.subscribe(refresh);
      }, [identitySettings]);
      const mode = identityValue.mode || 'ling';
      return jsxs('div', {
        style: { display: 'grid', gap: 12, padding: 16 },
        children: [
          jsx('label', { children: [jsx('input', { type: 'checkbox', checked: state.settings.enabled, onChange: (event) => save(controller, 'enabled', event.target.checked) }), ' 启用 HDD 视觉'] }),
          jsx('label', { children: [jsx('input', { type: 'checkbox', checked: state.settings.theme === 'light', onChange: (event) => save(controller, 'theme', event.target.checked ? 'light' : 'dark') }), ' HDD 日间模式'] }),
          jsx('label', { children: [jsx('input', { type: 'checkbox', checked: state.settings.mascotVisible, onChange: (event) => save(controller, 'mascotVisible', event.target.checked) }), ' 显示 Fairy 主视觉'] }),
          jsx('label', { children: [jsx('input', { type: 'checkbox', checked: state.settings.powerMode === 'low-power', onChange: (event) => save(controller, 'powerMode', event.target.checked ? 'low-power' : 'normal') }), ' 低功耗模式'] }),
          jsx('hr', {}),
          jsx('label', { children: ['Fairy 当前将我识别为：', jsx('select', { value: mode, onChange: (event) => save(identitySettings, 'mode', event.target.value), children: [jsx('option', { value: 'ling', children: '铃' }), jsx('option', { value: 'zhe', children: '哲' }), jsx('option', { value: 'custom', children: '自定义' })] })] }),
          mode === 'custom' ? jsx('label', { children: ['自定义称呼：', jsx('input', { value: identityValue.customName || '', maxLength: 40, onChange: (event) => save(identitySettings, 'customName', event.target.value) })] }) : null,
          mode === 'custom' ? jsx('label', { children: ['第二助手（可选）：', jsx('input', { value: identityValue.secondAssistant || '', maxLength: 40, onChange: (event) => save(identitySettings, 'secondAssistant', event.target.value) })] }) : null,
          mode === 'custom' ? jsx('label', { children: ['家庭成员（可选，逗号分隔）：', jsx('input', { value: Array.isArray(identityValue.household) ? identityValue.household.join('、') : '', maxLength: 240, onChange: (event) => save(identitySettings, 'household', event.target.value.split(/[、,，]/).map((value) => value.trim()).filter(Boolean).slice(0, 12)) })] }) : null,
          jsx('hr', {}),
          jsx(TtsSettings, {}),
          jsx('hr', {}),
          jsx(PersonaSettings, { personaSettings }),
          jsx('hr', {}),
          // The voice package mounts its briefing panel here (shared "Fairy
          // 控制台" section instead of a nav cell of its own).
          jsx('div', { 'data-dsh-fairy-hub-voice': 'true' }),
        ],
      });
    }

    const rawFetch = async (path, options) => {
      const origin = typeof location !== 'undefined' ? location.origin : '';
      const targets = [path, origin && origin !== 'null' ? `${origin}${path}` : null].filter(Boolean);
      let lastError = null;
      for (const target of targets) {
        try {
          return await fetch(target, { cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
        } catch (error) {
          lastError = error;
        }
      }
      // A page served by an instance that has since restarted keeps its sockets
      // and its per-boot cookie, so every write dies at the transport layer with
      // a bare "Failed to fetch" — name the origin and say what to do about it.
      throw new Error(`无法连接插件宿主（页面可能来自重启前的实例）：请刷新页面后重试。origin=${origin} ${lastError?.message ? `[${lastError.message}]` : ''}`);
    };

    const jsonFetch = async (path, options) => {
      const response = await rawFetch(path, options);
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 404) throw new Error('宿主未注册该路由（插件可能没装全，或实例需要重启）');
        throw new Error(body?.error?.message || body?.error || `HTTP ${response.status}`);
      }
      return body;
    };

    /** 32 kHz 16-bit mono PCM straight from the local engine. */
    const playPcm = async (buffer) => {
      const samples = new Int16Array(buffer);
      const context = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 32000 });
      const audio = context.createBuffer(1, samples.length, 32000);
      const channel = audio.getChannelData(0);
      for (let i = 0; i < samples.length; i += 1) channel[i] = samples[i] / 32768;
      const source = context.createBufferSource();
      source.buffer = audio;
      source.connect(context.destination);
      source.onended = () => { context.close().catch(() => {}); };
      source.start();
    };

    function TtsSettings() {
      const [config, setConfig] = React.useState(null);
      const [state, setState] = React.useState('loading');
      const [note, setNote] = React.useState('');
      const [draft, setDraft] = React.useState({ ttsUrl: '', docsUrl: '', promptText: '', apiKey: '' });
      const applyConfig = (value) => {
        if (!value) return;
        setConfig(value);
        setDraft({ ttsUrl: value.ttsUrl || '', docsUrl: value.docsUrl || '', promptText: value.promptText || '', apiKey: '' });
      };
      React.useEffect(() => {
        let cancelled = false;
        jsonFetch('/fairy-voice/config')
          .then((body) => { if (!cancelled) { applyConfig(body?.value); setState('ready'); } })
          .catch((error) => {
            if (cancelled) return;
            const message = String(error?.message || error);
            setState('ready');
            setNote(`读取当前配置失败：${message}`);
          });
        return () => { cancelled = true; };
      }, []);
      const save = async () => {
        setState('saving');
        try {
          /* An empty key field means "leave the stored key alone"; the host
           * treats a missing apiKey the same way, so only send a real value. */
          const payload = { ttsUrl: draft.ttsUrl, docsUrl: draft.docsUrl, promptText: draft.promptText };
          if (draft.apiKey.trim()) payload.apiKey = draft.apiKey.trim();
          const body = await jsonFetch('/fairy-voice/config/update', { method: 'POST', body: JSON.stringify(payload) });
          applyConfig(body?.value);
          setState('ready');
          setNote('已保存');
        } catch (error) {
          setState('error');
          setNote(`保存失败：${error.message || error}`);
        }
      };
      const clearKey = async () => {
        setState('saving');
        try {
          const body = await jsonFetch('/fairy-voice/config/update', { method: 'POST', body: JSON.stringify({ clearApiKey: true }) });
          applyConfig(body?.value);
          setState('ready');
          setNote('已清除 API Key');
        } catch (error) {
          setState('error');
          setNote(`清除失败：${error.message || error}`);
        }
      };
      const probe = async () => {
        setState('probing');
        try {
          const body = await jsonFetch('/fairy-voice/status');
          const available = body?.available === true;
          setState('ready');
          setNote(available ? '连接正常' : `未连接：${body?.reason || '本地服务未响应'}`);
        } catch (error) {
          setState('error');
          setNote(`探活失败：${error.message || error}`);
        }
      };
      const preview = async () => {
        setState('previewing');
        try {
          const response = await rawFetch('/fairy-voice/tts', {
            method: 'POST',
            body: JSON.stringify({ text: '检测完成。主人，Fairy 在线。' }),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          await playPcm(await response.arrayBuffer());
          setState('ready');
          setNote('已播放试听');
        } catch (error) {
          setState('error');
          setNote(`试听失败：${error.message || error}`);
        }
      };
      const upload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setState('uploading');
        try {
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('read failed'));
            reader.readAsDataURL(file);
          });
          const body = await jsonFetch('/fairy-voice/reference', { method: 'POST', body: JSON.stringify({ audioBase64: base64, filename: file.name, promptText: draft.promptText }) });
          applyConfig(body?.value);
          setState('ready');
          setNote(`已上传 ${file.name}`);
        } catch (error) {
          setState('error');
          setNote(`上传失败：${error.message || error}`);
        }
      };
      if (state === 'missing') {
        return jsxs('div', { className: 'dsh-fairy-settings-block', children: [jsx('h4', { children: '语音服务（TTS）' }), jsx('p', { children: '未安装 dsh-fairy-voice，语音服务不可配置。' })] });
      }
      return jsxs('div', { className: 'dsh-fairy-settings-block', children: [
        jsx('h4', { children: '语音服务（TTS）' }),
        jsx('p', { className: 'dsh-fairy-hint', children: 'GPT-SoVITS 兼容端点；默认读取 DSH_FAIRY_TTS_URL / DSH_FAIRY_DOCS_URL / DSH_FAIRY_TTS_APIKEY，这里保存的值优先。' }),
        jsx('label', { children: ['合成端点：', jsx('input', { type: 'url', value: draft.ttsUrl, placeholder: 'http://127.0.0.1:9880/tts', onChange: (event) => setDraft({ ...draft, ttsUrl: event.target.value }), style: { width: '100%' } })] }),
        jsx('label', { children: ['探活端点：', jsx('input', { type: 'url', value: draft.docsUrl, placeholder: 'http://127.0.0.1:9880/docs', onChange: (event) => setDraft({ ...draft, docsUrl: event.target.value }), style: { width: '100%' } })] }),
        jsx('label', { children: ['API Key（可选）：', jsx('input', { type: 'password', value: draft.apiKey, autoComplete: 'off', placeholder: config?.apiKeySet ? `已设置 ${config.apiKeyMask || ''}（留空保持不变）` : '云端语音服务需要时填写，本地 GPT-SoVITS 留空', onChange: (event) => setDraft({ ...draft, apiKey: event.target.value }), style: { width: '100%' } })] }),
        config?.apiKeySet
          ? jsxs('div', { className: 'dsh-fairy-hint', children: [
              `API Key 已设置${config.apiKeySource === 'env' ? '（来自 DSH_FAIRY_TTS_APIKEY）' : ''}，请求会带 Authorization: Bearer …；`,
              jsx('button', { type: 'button', onClick: clearKey, disabled: state === 'saving', children: '清除 API Key' }),
            ] })
          : jsx('div', { className: 'dsh-fairy-hint', children: '未设置 API Key；请求不带 Authorization 头，适配默认的本地 GPT-SoVITS。' }),
        jsx('label', { children: ['参考音频提示文本：', jsx('textarea', { value: draft.promptText, rows: 2, placeholder: '参考音频里说的那句话', onChange: (event) => setDraft({ ...draft, promptText: event.target.value }), style: { width: '100%' } })] }),
        jsx('div', { className: 'dsh-fairy-hint', children: config ? `当前参考音频：${config.referenceAudio || 'fairy_ref.wav'}${config.referencePresent ? `（${Math.round((config.referenceBytes || 0) / 1024)} KB）` : '（未上传）'}` : '读取中…' }),
        jsxs('div', { className: 'dsh-fairy-actions', children: [
          jsx('button', { type: 'button', onClick: save, disabled: state === 'saving', children: state === 'saving' ? '保存中…' : '保存' }),
          jsx('button', { type: 'button', onClick: probe, disabled: state === 'probing', children: state === 'probing' ? '检测中…' : '测试连接' }),
          jsx('button', { type: 'button', onClick: preview, disabled: state === 'previewing', children: state === 'previewing' ? '合成中…' : '试听' }),
          jsx('label', { className: 'dsh-fairy-upload', children: ['上传参考音频', jsx('input', { type: 'file', accept: 'audio/*', onChange: upload })] }),
        ] }),
        note ? jsx('p', { className: 'dsh-fairy-hint', children: note }) : null,
      ] });
    }

    function PersonaSettings({ personaSettings }) {
      const snapshot = React.useSyncExternalStore(personaSettings.subscribe, personaSettings.getSnapshot, personaSettings.getSnapshot);
      const stored = React.useMemo(() => snapshot?.value || {}, [snapshot]);
      const [text, setText] = React.useState(stored.text || '');
      const [enabled, setEnabled] = React.useState(stored.enabled !== false);
      const [corpus, setCorpus] = React.useState([]);
      const [picked, setPicked] = React.useState('');
      const [note, setNote] = React.useState('');
      const [info, setInfo] = React.useState(null);
      React.useEffect(() => {
        setText(stored.text || '');
        setEnabled(stored.enabled !== false);
      }, [stored.text, stored.enabled]);
      React.useEffect(() => {
        let cancelled = false;
        jsonFetch('/dsh-fairy/persona')
          .then((body) => { if (!cancelled) setInfo(body?.value || null); })
          .catch(() => {});
        jsonFetch('/dsh-fairy/persona/corpus')
          .then((body) => { if (!cancelled) setCorpus(Array.isArray(body?.value) ? body.value : []); })
          .catch(() => {});
        return () => { cancelled = true; };
      }, []);
      const persist = async () => {
        try {
          await personaSettings.set('text', text);
          await personaSettings.set('enabled', enabled);
          setNote('已保存，下一条消息生效');
          const body = await jsonFetch('/dsh-fairy/persona').catch(() => null);
          if (body?.value) setInfo(body.value);
        } catch (error) {
          setNote(`保存失败：${error.message || error}`);
        }
      };
      const insert = async (id, all = false) => {
        const targets = all ? corpus : corpus.filter((entry) => entry.id === id);
        if (!targets.length) return;
        let appended = '';
        for (const entry of targets) {
          try {
            const body = await jsonFetch(`/dsh-fairy/persona/corpus/file?id=${encodeURIComponent(entry.id)}`);
            appended += `\n\n【参考语料 ${entry.id}】\n${body?.value?.text || ''}`;
          } catch {
            /* skip unavailable file */
          }
        }
        setText((current) => `${current}${appended}`);
        setNote(`已插入 ${targets.length} 份语料（记得保存）`);
      };
      return jsxs('div', { className: 'dsh-fairy-settings-block', children: [
        jsx('h4', { children: 'Fairy 人设' }),
        jsx('label', { children: [jsx('input', { type: 'checkbox', checked: enabled, onChange: (event) => { setEnabled(event.target.checked); } }), ' 启用人设注入（写入系统提示词）'] }),
        jsx('textarea', {
          value: text,
          rows: 16,
          spellCheck: false,
          placeholder: '留空则使用内置的参考人设（绝区零 Fairy）。字数不限，可直接粘贴整份语料。',
          onChange: (event) => setText(event.target.value),
          style: { width: '100%', fontFamily: 'inherit', lineHeight: 1.5 },
        }),
        jsx('div', { className: 'dsh-fairy-hint', children: `当前 ${text.length} 字${info?.composed ? `；注入后约 ${info.composed.chars} 字（来源：${info.composed.source === 'custom' ? '自定义' : '内置'}，语料 ${info.composed.corpus?.length || 0} 份）` : ''}` }),
        jsxs('div', { className: 'dsh-fairy-actions', children: [
          jsx('button', { type: 'button', onClick: () => persist(), children: '保存人设' }),
          jsx('button', { type: 'button', onClick: () => { setText(info?.defaultText || ''); setNote('已载入内置参考人设（记得保存）'); }, children: '载入内置人设' }),
          jsx('button', { type: 'button', onClick: () => { setText(''); setNote('已清空（保存后回落内置人设）'); }, children: '清空' }),
        ] }),
        jsxs('div', { className: 'dsh-fairy-actions', children: [
          jsxs('select', { value: picked, onChange: (event) => setPicked(event.target.value), children: [jsx('option', { value: '', children: '选择参考语料…' }), ...corpus.map((entry) => jsx('option', { value: entry.id, children: `${entry.id}（${Math.round(entry.bytes / 1024)} KB）` }, entry.id))] }),
          jsx('button', { type: 'button', disabled: !picked, onClick: () => insert(picked), children: '插入选中语料' }),
          jsx('button', { type: 'button', disabled: !corpus.length, onClick: () => insert('', true), children: `全部插入（${corpus.length} 份）` }),
        ] }),
        jsx('p', { className: 'dsh-fairy-hint', children: '全部插入会把参考项目的完整语料写进系统提示词（约 400 KB），token 成本很高；建议按需插入。' }),
        note ? jsx('p', { className: 'dsh-fairy-hint', children: note }) : null,
      ] });
    }

function apply(ctx) {
      return diagnostics.guard('apply', () => {
      const settings = createSettingsHandle(SETTINGS_NAMESPACE);
      const identitySettings = createSettingsHandle(IDENTITY_SETTINGS_NAMESPACE);
      const personaSettings = createSettingsHandle(PERSONA_SETTINGS_NAMESPACE);
      syncDocumentMode(settings.getSnapshot());
      injectStyles();
      const selectionGuard = createSelectionGuard({
        selector: [
          OFFICIAL_SELECTORS.sidebarResizeHandle,
          '.dsh-fairy-composer-resizer',
          '.dsh-history-overlay-scrollbar-thumb',
        ].join(','),
      });
      ctx.effect(() => () => selectionGuard.dispose(), 'dsh-fairy-visual selection guard');
      const controller = new Controller(settings, createSessionSource(ctx));
      try {
        // Same opt-in flag as entry.js: lets the CDP probes read the projected
        // activity/lifecycle for the bound Session instead of guessing from pixels.
        if (globalThis.localStorage?.getItem('dsh-fairy:debug') === '1') globalThis.__dshFairyController = controller;
      } catch {
        /* storage unavailable */
      }
      if (typeof window !== 'undefined' && typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
        window.__fairyVisualLifecycle = {
          inspectController: () => controller.lifecycle?.inspect?.() || [],
        };
      }
      ctx.effect(() => () => controller.dispose(), 'dsh-fairy-visual controller');
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'dsh-fairy-visual-stage', order: 10 }, () => jsx(StageHost, { controller })));
      ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({ name: 'conversation.session.header.utilities', id: 'dsh-fairy-session-metrics', order: 80 }, () => jsx(SessionMetricsControl, { controller })));
      ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({ name: 'conversation.session.header.utilities', id: 'dsh-fairy-visual-toggle', order: 90 }, () => jsx(Toggle, { controller })));
      ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'dsh-fairy-visual', order: 45, label: () => 'Fairy 控制台' }, () => jsx(Settings, { controller, identitySettings, personaSettings })));
      }, { surface: 'client' });
    }

    module.exports = { apply, inject: ['slots', 'sessions', 'uiSession'], name: 'dsh-fairy-visual' };
