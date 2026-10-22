import type { SyncPersistence } from './types.js';

/** In-memory persistence: survives provider restarts within one page — for tests, SSR and demos. */
export const memoryPersistence = (): SyncPersistence => {
  const snapshots = new Map<string, Uint8Array>();
  const pending = new Map<string, Map<string, Uint8Array>>();
  return {
    loadSnapshot: async (docId) => snapshots.get(docId) ?? null,
    saveSnapshot: async (docId, state) => {
      snapshots.set(docId, state);
    },
    loadPending: async (docId) => new Map(pending.get(docId) ?? []),
    savePending: async (docId, sessionId, update) => {
      const sessions = pending.get(docId) ?? new Map<string, Uint8Array>();
      if (update) sessions.set(sessionId, update);
      else sessions.delete(sessionId);
      if (sessions.size) pending.set(docId, sessions);
      else pending.delete(docId);
    },
  };
};
