/** Read side of an observable store — the shape controllers expose to UI adapters. */
export interface ReadableStore<S> {
  getState(): S;
  /** Returns an unsubscribe function. Compatible with React's useSyncExternalStore. */
  subscribe(listener: () => void): () => void;
}

export interface Store<S> extends ReadableStore<S> {
  setState(patch: Partial<S> | ((state: S) => Partial<S>)): void;
}

const shallowEqualPatch = <S extends object>(state: S, patch: Partial<S>): boolean =>
  (Object.keys(patch) as (keyof S)[]).every((key) => Object.is(state[key], patch[key]));

/** Minimal observable store: shallow-merges patches, notifies only on real changes. */
export const createStore = <S extends object>(initial: S): Store<S> => {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setState: (patch) => {
      const next = typeof patch === 'function' ? patch(state) : patch;
      if (shallowEqualPatch(state, next)) return;
      state = { ...state, ...next };
      listeners.forEach((listener) => listener());
    },
  };
};
