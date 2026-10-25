/**
 * Session selection source for the ported Controller.
 *
 * The 0.1.1 runtime exposed the selected Session as `sessions.list.#
 * getSnapshot().current`. In 0.2.1 the Session list snapshot is only
 * `{ ids, byId, phase, projectionsBySession }` — there is no selection on it —
 * and the selection moved to the `uiSession` service: `uiSession.current` is a
 * store whose value carries `key`, the selected `SessionId`.
 *
 * This module keeps one tiny surface for the Controller so the ported code keeps
 * working across both shapes: `currentId()`, `subscribe()`, `binding(id)`.
 *
 * Verified against dsh 0.2.1-rc.2: `uiSession.current.getSnapshot().key` is the
 * selected SessionId and changes on switch; `sessions.binding(id)` still
 * resolves the Session binding.
 */
const readSelection = (store) => {
  if (!store) return undefined;
  try {
    const snapshot = typeof store.getSnapshot === 'function' ? store.getSnapshot() : store.value;
    if (snapshot == null) return undefined;
    if (typeof snapshot === 'string') return snapshot;
    const key = snapshot.key ?? snapshot.current ?? snapshot.sessionId;
    return typeof key === 'string' ? key : undefined;
  } catch {
    return undefined;
  }
};

function createSessionSource(ctx) {
  // Resolve lazily: Cordis hands services out through the context proxy, and a
  // service that is not up yet at apply time must not be memoized as absent.
  const lookup = (name) => {
    if (!ctx) return undefined;
    // Cordis throws ("cannot get property … without inject") for services this
    // plugin did not declare, so the direct read must stay defensive.
    try {
      const direct = ctx[name];
      if (direct) return direct;
    } catch {
      /* not injected: fall through to the reflective lookup */
    }
    return typeof ctx.get === 'function' ? ctx.get(name) : undefined;
  };
  const sessionsOf = () => lookup('sessions');
  const selectionOf = () => {
    const uiSession = lookup('uiSession');
    return uiSession && uiSession.current ? uiSession.current : null;
  };

  return {
    currentId() {
      const selected = readSelection(selectionOf());
      if (selected !== undefined) return selected;
      // Fallback for runtimes that still expose the selection on the list store.
      const sessions = sessionsOf();
      return sessions && sessions.list ? readSelection(sessions.list) : undefined;
    },

    subscribe(listener) {
      const offs = [];
      const add = (store) => {
        if (store && typeof store.subscribe === 'function') offs.push(store.subscribe(listener));
      };
      add(selectionOf());
      const sessions = sessionsOf();
      add(sessions && sessions.list);
      return () => {
        for (const off of offs) {
          try {
            if (typeof off === 'function') off();
          } catch {
            /* already disposed */
          }
        }
      };
    },

    binding(id) {
      const sessions = sessionsOf();
      if (id == null || !sessions || typeof sessions.binding !== 'function') return null;
      return sessions.binding(id);
    },
  };
}

module.exports = { createSessionSource };
