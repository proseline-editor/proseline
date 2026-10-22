import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { vi } from 'vitest';
import { Server } from '@hocuspocus/server';
import { memoryPersistence } from '@proseline-editor/sync/testing';
import type { SyncProvider } from '@proseline-editor/sync';
import { hocuspocusProvider } from './index.js';

let server: Server;
let url: string;
const opened: SyncProvider[] = [];

beforeAll(async () => {
  server = new Server({
    quiet: true,
    onAuthenticate: async ({ token, connectionConfig }) => {
      if (token === 'bad') throw new Error('forbidden');
      if (token === 'viewer') connectionConfig.readOnly = true;
    },
  });
  await server.listen(0);
  url = server.webSocketURL;
});
afterAll(() => server.destroy());
afterEach(() => opened.splice(0).forEach((p) => p.destroy()));

const open = (name: string, extra: Partial<Parameters<typeof hocuspocusProvider>[0]> = {}) => {
  const p = hocuspocusProvider({ name, url, token: 'ok', ...extra });
  opened.push(p);
  return p;
};

describe('hocuspocusProvider', () => {
  it('syncs two clients and reports synced', async () => {
    const a = open('doc-1');
    const b = open('doc-1');
    await Promise.all([a.whenReady, b.whenReady]);
    a.doc.getText('t').insert(0, 'over websockets');
    await vi.waitFor(() => expect(b.doc.getText('t').toString()).toBe('over websockets'));
    await vi.waitFor(() => expect(a.getState()).toMatchObject({ status: 'synced', ready: true, readOnly: false, unsent: 0 }));
  });

  it('relays awareness', async () => {
    const a = open('doc-2');
    const b = open('doc-2');
    await Promise.all([a.whenReady, b.whenReady]);
    a.awareness.setLocalStateField('user', { name: 'Ann' });
    await vi.waitFor(() => {
      const names = [...b.awareness.getStates().values()].map((s) => (s as { user?: { name: string } }).user?.name);
      expect(names).toContain('Ann');
    });
  });

  it('is read-only for a read-only connection', async () => {
    const v = open('doc-3', { token: 'viewer' });
    await v.whenReady;
    await vi.waitFor(() => expect(v.getState()).toMatchObject({ readOnly: true }));
  });

  it('reports an error and read-only when authentication fails', async () => {
    const x = open('doc-4', { token: 'bad' });
    await vi.waitFor(() => expect(x.getState()).toMatchObject({ status: 'error', readOnly: true }));
  });

  it('opens offline from the local copy and keeps edits made offline', async () => {
    const persistence = memoryPersistence();
    const first = open('doc-5', { persistence, snapshotMs: 10 });
    await first.whenReady;
    first.doc.getText('t').insert(0, 'cached');
    await vi.waitFor(async () => expect(await persistence.loadSnapshot('doc-5')).not.toBeNull());
    first.destroy();
    const offline = open('doc-5', { persistence, url: 'ws://127.0.0.1:9' }); // nothing listens there
    await offline.whenReady;
    expect(offline.doc.getText('t').toString()).toBe('cached');
    offline.doc.getText('t').insert(6, ' + offline');
    await vi.waitFor(async () => expect((await persistence.loadPending('doc-5')).size + (await persistence.loadSnapshot('doc-5') ? 1 : 0)).toBeGreaterThan(0));
    offline.destroy();
    // Back online: the local copy reaches the server through the sync protocol.
    const online = open('doc-5', { persistence });
    const peer = open('doc-5');
    await Promise.all([online.whenReady, peer.whenReady]);
    await vi.waitFor(() => expect(peer.doc.getText('t').toString()).toBe('cached + offline'));
  });
});
