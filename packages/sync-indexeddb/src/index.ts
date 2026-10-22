import type { SyncPersistence } from '@proseline-editor/sync';

export interface IndexeddbPersistenceOptions {
  /** Database name. Default `proseline`. */
  name?: string;
  /** IDBFactory to use. Default `globalThis.indexedDB`. */
  indexedDB?: IDBFactory;
}

const STORE = 'sync';

const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const snapshotKey = (docId: string) => `snapshot:${docId}`;
const pendingPrefix = (docId: string) => `pending:${docId}:`;

/**
 * Stores each document's snapshot and per-session unconfirmed updates in one IndexedDB object store,
 * so a document opens offline and unsent edits survive a crash or a closed tab.
 */
export const indexeddbPersistence = (options: IndexeddbPersistenceOptions = {}): SyncPersistence => {
  let db: Promise<IDBDatabase> | null = null;
  const open = (): Promise<IDBDatabase> => {
    if (!db) {
      const factory = options.indexedDB ?? globalThis.indexedDB;
      if (!factory) return Promise.reject(new Error('IndexedDB is not available'));
      const req = factory.open(options.name ?? 'proseline', 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      db = request(req);
    }
    return db;
  };
  const store = async (mode: IDBTransactionMode): Promise<IDBObjectStore> => (await open()).transaction(STORE, mode).objectStore(STORE);
  const asBytes = (value: unknown): Uint8Array | null => (value instanceof Uint8Array ? value : null);

  return {
    loadSnapshot: async (docId) => asBytes(await request((await store('readonly')).get(snapshotKey(docId)))),
    saveSnapshot: async (docId, state) => {
      await request((await store('readwrite')).put(state, snapshotKey(docId)));
    },
    loadPending: async (docId) => {
      const s = await store('readonly');
      const prefix = pendingPrefix(docId);
      const range = IDBKeyRange.bound(prefix, `${prefix}\uffff`);
      const [keys, values] = await Promise.all([request(s.getAllKeys(range)), request(s.getAll(range))]);
      const sessions = new Map<string, Uint8Array>();
      keys.forEach((key, i) => {
        const bytes = asBytes(values[i]);
        if (bytes) sessions.set(String(key).slice(prefix.length), bytes);
      });
      return sessions;
    },
    savePending: async (docId, sessionId, update) => {
      const s = await store('readwrite');
      const key = `${pendingPrefix(docId)}${sessionId}`;
      if (update) await request(s.put(update, key));
      else await request(s.delete(key));
    },
  };
};
