import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createSyncProvider } from '@proseline-editor/sync';
import { createMemoryServer } from '@proseline-editor/sync/testing';
import { indexeddbPersistence } from './index.js';

afterEach(() => vi.useRealTimers());

let dbCount = 0;
const fresh = () => indexeddbPersistence({ name: `test-${++dbCount}` });

describe('indexeddbPersistence', () => {
  it('stores and loads a snapshot', async () => {
    const p = fresh();
    expect(await p.loadSnapshot('a')).toBeNull();
    await p.saveSnapshot('a', new Uint8Array([1, 2, 3]));
    expect(await p.loadSnapshot('a')).toEqual(new Uint8Array([1, 2, 3]));
    expect(await p.loadSnapshot('b')).toBeNull();
  });

  it('keeps pending updates per session and per document', async () => {
    const p = fresh();
    await p.savePending('doc', 's1', new Uint8Array([1]));
    await p.savePending('doc', 's2', new Uint8Array([2]));
    await p.savePending('doc-2', 's1', new Uint8Array([9]));
    expect(await p.loadPending('doc')).toEqual(new Map([['s1', new Uint8Array([1])], ['s2', new Uint8Array([2])]]));
    await p.savePending('doc', 's1', null);
    expect([...(await p.loadPending('doc')).keys()]).toEqual(['s2']);
    expect([...(await p.loadPending('doc-2')).keys()]).toEqual(['s1']);
  });

  it('survives reopening the database', async () => {
    await indexeddbPersistence({ name: 'reopen' }).saveSnapshot('a', new Uint8Array([7]));
    expect(await indexeddbPersistence({ name: 'reopen' }).loadSnapshot('a')).toEqual(new Uint8Array([7]));
  });

  it('lets a provider recover unsent edits after a crash', async () => {
    const server = createMemoryServer();
    const name = `crash-${++dbCount}`;
    const offline = server.connect();
    offline.setOnline(false);
    const dying = createSyncProvider({ docId: 'scene', transport: offline, persistence: indexeddbPersistence({ name }), tabSync: false, batchMs: 10 });
    dying.doc.getText('t').insert(0, 'written offline');
    await vi.waitFor(async () => expect((await indexeddbPersistence({ name }).loadPending('scene')).size).toBe(1));
    // The tab dies; a new one opens with a fresh connection to the same database.
    const reborn = createSyncProvider({ docId: 'scene', transport: server.connect(), persistence: indexeddbPersistence({ name }), tabSync: false, batchMs: 10 });
    await vi.waitFor(() => expect(server.doc.getText('t').toString()).toBe('written offline'));
    expect(reborn.doc.getText('t').toString()).toBe('written offline');
    reborn.destroy();
  });

  it('rejects clearly when IndexedDB is unavailable', async () => {
    const p = indexeddbPersistence({ indexedDB: undefined as unknown as IDBFactory });
    const original = globalThis.indexedDB;
    Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
    await expect(p.loadSnapshot('a')).rejects.toThrow('IndexedDB is not available');
    Object.defineProperty(globalThis, 'indexedDB', { value: original, configurable: true });
  });
});
