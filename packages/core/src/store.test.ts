import { describe, it, expect, vi } from 'vitest';
import { createStore } from './store.js';

describe('createStore', () => {
  it('returns the initial state', () => {
    const store = createStore({ count: 0, label: 'a' });
    expect(store.getState()).toEqual({ count: 0, label: 'a' });
  });

  it('merges a patch and notifies subscribers', () => {
    const store = createStore({ count: 0, label: 'a' });
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState({ count: 1 });
    expect(store.getState()).toEqual({ count: 1, label: 'a' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('accepts an updater function', () => {
    const store = createStore({ count: 1 });
    store.setState((s) => ({ count: s.count + 1 }));
    expect(store.getState().count).toBe(2);
  });

  it('keeps the same state object and skips listeners when nothing changed', () => {
    const store = createStore({ count: 1 });
    const before = store.getState();
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState({ count: 1 });
    expect(store.getState()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('stops notifying after unsubscribe', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.setState({ count: 5 });
    expect(listener).not.toHaveBeenCalled();
  });
});
