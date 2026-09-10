/**
 * A tiny generic store: holds a value, notifies subscribers on change.
 * Intentionally framework-free so it can be swapped for real API-backed
 * state in Phase 3 without screens needing to change how they read state.
 */
export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  function getState() {
    return state;
  }

  function setState(patch) {
    state = typeof patch === "function" ? patch(state) : { ...state, ...patch };
    listeners.forEach((listener) => listener(state));
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { getState, setState, subscribe };
}
