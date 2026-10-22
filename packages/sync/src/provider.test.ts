import { describe, it, expect, vi, afterEach } from 'vitest';
import * as Y from 'yjs';
import { createSyncProvider, type SyncProviderOptions } from './provider.js';
import { createMemoryServer } from './testing/memory-server.js';
import { memoryPersistence } from './persistence.js';
import { type SyncProvider, type SyncTransport, type SyncTransportHandlers } from './types.js';

const providers: SyncProvider[] = [];
afterEach(() => {
  providers.splice(0).forEach((p) => p.destroy());
  vi.useRealTimers();
});

const open = (opts: Partial<SyncProviderOptions> & Pick<SyncProviderOptions, 'transport'>) => {
  const p = createSyncProvider({ docId: 'doc', tabSync: false, batchMs: 10, ...opts });
  providers.push(p);
  return p;
};
const text = (p: { doc: Y.Doc }) => p.doc.getText('t').toString();
const type = (p: { doc: Y.Doc }, s: string) => p.doc.getText('t').insert(p.doc.getText('t').length, s);
const settle = (ms = 100) => vi.advanceTimersByTimeAsync(ms);

describe('createSyncProvider', () => {
  it('becomes ready after the first catch-up and sends batched local edits', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    server.doc.getText('t').insert(0, 'Hello');
    const p = open({ transport: server.connect() });
    expect(p.getState()).toMatchObject({ status: 'connecting', ready: false });
    await settle();
    await expect(p.whenReady).resolves.toBeUndefined();
    expect(text(p)).toBe('Hello');
    type(p, ' world');
    type(p, '!');
    expect(p.getState()).toMatchObject({ status: 'syncing', unsent: 2 });
    await settle();
    expect(server.doc.getText('t').toString()).toBe('Hello world!');
    expect(server.posts).toBe(1);
    expect(p.getState()).toMatchObject({ status: 'synced', unsent: 0 });
  });

  it('applies updates from co-authors over the live channel', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const a = open({ transport: server.connect() });
    const b = open({ transport: server.connect() });
    await settle();
    type(a, 'from A');
    await settle();
    expect(text(b)).toBe('from A');
  });

  it('retries failed posts with backoff, reporting offline until they land', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const transport = server.connect();
    const p = open({ transport });
    await settle();
    transport.setOnline(false);
    type(p, 'kept');
    await settle(50);
    expect(p.getState()).toMatchObject({ status: 'offline', unsent: 1 });
    await settle(5000);
    expect(server.doc.getText('t').toString()).toBe('');
    transport.setOnline(true);
    await settle(30_000);
    expect(server.doc.getText('t').toString()).toBe('kept');
    expect(p.getState()).toMatchObject({ status: 'synced', unsent: 0 });
  });

  it('re-sends after a lost acknowledgement without duplicating text', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const p = open({ transport: server.connect({ lostAckRate: 1 }) });
    await settle();
    type(p, 'once');
    await settle(3000);
    expect(server.posts).toBeGreaterThan(1);
    expect(server.doc.getText('t').toString()).toBe('once');
  });

  it('switches to read-only when the server refuses writes, keeping the edit pending', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const persistence = memoryPersistence();
    server.revoke('ann');
    const p = open({ transport: server.connect({ userId: 'ann' }), persistence });
    await settle();
    type(p, 'draft');
    await settle();
    expect(p.getState()).toMatchObject({ status: 'error', readOnly: true, unsent: 1 });
    expect([...(await persistence.loadPending('doc')).values()]).toHaveLength(1);
  });

  it('never sends anything for viewers', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const p = open({ transport: server.connect(), canWrite: false });
    await settle();
    type(p, 'local only');
    await settle();
    expect(server.posts).toBe(0);
    expect(p.getState()).toMatchObject({ readOnly: true, unsent: 0 });
  });

  it('catches up at once when a broadcast left a gap', async () => {
    vi.useFakeTimers();
    // A hand-driven transport: we decide which broadcasts arrive.
    const source = new Y.Doc();
    let handlers: SyncTransportHandlers | null = null;
    const fetchDiff = vi.fn(async (sv: Uint8Array) => Y.encodeStateAsUpdate(source, sv));
    const transport: SyncTransport = {
      fetchDiff,
      postUpdate: async () => undefined,
      subscribe: (h) => ((handlers = h), () => (handlers = null)),
      sendAwareness: () => undefined,
    };
    const p = open({ transport, resyncMs: 60_000 });
    await settle();
    const updates: Uint8Array[] = [];
    source.on('update', (u: Uint8Array) => updates.push(u));
    source.getText('t').insert(0, 'one ');
    source.getText('t').insert(4, 'two');
    fetchDiff.mockClear();
    handlers!.onUpdate(updates[1]!); // the first one was "lost"
    await settle();
    expect(fetchDiff).toHaveBeenCalledTimes(1);
    expect(text(p)).toBe('one two');
  });

  it('stores unconfirmed edits and sends them after a crash', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const persistence = memoryPersistence();
    const offline = server.connect();
    const first = createSyncProvider({ docId: 'doc', tabSync: false, batchMs: 10, transport: offline, persistence });
    await settle();
    offline.setOnline(false);
    type(first, 'survives');
    await settle(50);
    // Crash: the provider is abandoned without destroy(); only persistence remains.
    const second = open({ transport: server.connect(), persistence });
    await settle(100);
    expect(server.doc.getText('t').toString()).toBe('survives');
    expect(text(second)).toBe('survives');
    expect(second.getState()).toMatchObject({ status: 'synced', unsent: 0 });
    expect(await persistence.loadPending('doc')).toEqual(new Map());
  });

  it('opens offline from the local snapshot', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const persistence = memoryPersistence();
    const first = open({ transport: server.connect(), persistence, snapshotMs: 10 });
    await settle();
    type(first, 'cached');
    await settle();
    first.destroy();
    const down = server.connect();
    down.setOnline(false);
    const second = open({ transport: down, persistence });
    await settle();
    expect(second.getState()).toMatchObject({ ready: true, status: 'offline' });
    expect(text(second)).toBe('cached');
  });

  it('keeps a local-only document in persistence', async () => {
    vi.useFakeTimers();
    const persistence = memoryPersistence();
    const first = open({ transport: null, persistence, snapshotMs: 10 });
    await settle();
    expect(first.getState()).toMatchObject({ status: 'local', ready: true, unsent: 0 });
    type(first, 'notes');
    await settle();
    expect(await persistence.loadPending('doc')).toEqual(new Map()); // folded into the snapshot
    first.destroy();
    const second = open({ transport: null, persistence });
    await settle();
    expect(text(second)).toBe('notes');
  });

  it('adopts edits left pending by other sessions and clears their entries', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const persistence = memoryPersistence();
    const orphan = new Y.Doc();
    orphan.getText('t').insert(0, 'orphaned');
    await persistence.savePending('doc', 'old-tab', Y.encodeStateAsUpdate(orphan));
    const p = open({ transport: server.connect(), persistence });
    await settle();
    expect(server.doc.getText('t').toString()).toBe('orphaned');
    expect(await persistence.loadPending('doc')).toEqual(new Map());
    expect(text(p)).toBe('orphaned');
  });

  it('relays awareness between clients', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const a = open({ transport: server.connect() });
    const b = open({ transport: server.connect() });
    await settle();
    a.awareness.setLocalStateField('user', { name: 'Ann' });
    await settle();
    const names = [...b.awareness.getStates().values()].map((s) => (s as { user?: { name: string } }).user?.name);
    expect(names).toContain('Ann');
  });

  it('mirrors edits between tabs of the same document', async () => {
    const server = createMemoryServer();
    const a = open({ transport: server.connect(), tabSync: true });
    const b = open({ transport: server.connect({ dropRate: 1 }), tabSync: true }); // b hears nothing from the server
    await Promise.all([a.whenReady, b.whenReady]);
    type(a, 'tab A');
    await vi.waitFor(() => expect(text(b)).toBe('tab A'));
  });
});
