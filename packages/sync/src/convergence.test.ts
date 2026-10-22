import { describe, it, expect, vi, afterEach } from 'vitest';
import * as Y from 'yjs';
import { createSyncProvider } from './provider.js';
import { createMemoryServer, type MemoryTransport } from './testing/memory-server.js';
import { createRandom } from './testing/random.js';
import { memoryPersistence } from './persistence.js';
import type { SyncPersistence, SyncProvider } from './types.js';

afterEach(() => vi.useRealTimers());

interface Client {
  id: number;
  transport: MemoryTransport;
  persistence: SyncPersistence;
  provider: SyncProvider;
}

const randomEdit = (doc: Y.Doc, random: () => number, label: string): void => {
  const t = doc.getText('t');
  if (t.length > 0 && random() < 0.35) {
    const at = Math.floor(random() * t.length);
    t.delete(at, Math.min(t.length - at, 1 + Math.floor(random() * 3)));
  } else {
    t.insert(Math.floor(random() * (t.length + 1)), label);
  }
};

/**
 * Several clients edit concurrently over a hostile network (random latency → reordering, dropped
 * broadcasts, failed posts, lost acknowledgements, outages, crashes). After the network heals, every
 * client and the server must hold the identical document and nothing may remain unsent.
 */
const runScenario = async (seed: number): Promise<void> => {
  const random = createRandom(seed);
  const server = createMemoryServer();
  const clients: Client[] = [];
  const open = (id: number, persistence = memoryPersistence()): Client => {
    const transport = server.connect({ seed: seed * 31 + id, latencyMs: 40, dropRate: 0.2, failRate: 0.15, lostAckRate: 0.1 });
    const provider = createSyncProvider({ docId: 'fuzz', transport, persistence, tabSync: false, batchMs: 20, resyncMs: 500 });
    return { id, transport, persistence, provider };
  };
  const count = 2 + Math.floor(random() * 4);
  for (let i = 0; i < count; i++) clients.push(open(i));
  await vi.advanceTimersByTimeAsync(200);

  for (let step = 0; step < 120; step++) {
    const c = clients[Math.floor(random() * clients.length)] as Client;
    const roll = random();
    if (roll < 0.75) randomEdit(c.provider.doc, random, `${c.id}${step} `);
    else if (roll < 0.88) c.transport.setOnline(!c.transport.online);
    else if (roll < 0.93) {
      // Crash: abandon the provider (no destroy, no flush) and restart from its persistence.
      const index = clients.indexOf(c);
      c.transport.setOnline(false);
      clients[index] = open(c.id, c.persistence);
    }
    await vi.advanceTimersByTimeAsync(Math.floor(random() * 60));
  }

  // Heal: everyone online, then wait out backoffs (max 30 s) and periodic resyncs.
  clients.forEach((c) => c.transport.setOnline(true));
  await vi.advanceTimersByTimeAsync(70_000);

  const expected = server.doc.getText('t').toString();
  for (const c of clients) {
    expect(c.provider.doc.getText('t').toString(), `seed ${seed}, client ${c.id}`).toBe(expected);
    expect(c.provider.getState(), `seed ${seed}, client ${c.id}`).toMatchObject({ unsent: 0, status: 'synced' });
  }
  clients.forEach((c) => c.provider.destroy());
};

describe('convergence under faults', () => {
  it.each(Array.from({ length: 25 }, (_, i) => i + 1))('converges (seed %i)', async (seed) => {
    vi.useFakeTimers();
    await runScenario(seed);
  });

  it('loses no edit made before a crash', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const persistence = memoryPersistence();
    const transport = server.connect({ seed: 7, failRate: 1 }); // every post fails
    createSyncProvider({ docId: 'crash', transport, persistence, tabSync: false, batchMs: 10 });
    await vi.advanceTimersByTimeAsync(50);
    // Edits made while posts fail, then the tab dies.
    const dying = createSyncProvider({ docId: 'crash', transport, persistence, tabSync: false, batchMs: 10 });
    await vi.advanceTimersByTimeAsync(50);
    dying.doc.getText('t').insert(0, 'written before the crash');
    await vi.advanceTimersByTimeAsync(50);
    const reborn = createSyncProvider({ docId: 'crash', transport: server.connect(), persistence, tabSync: false, batchMs: 10 });
    await vi.advanceTimersByTimeAsync(100);
    expect(server.doc.getText('t').toString()).toBe('written before the crash');
    expect(reborn.doc.getText('t').toString()).toBe('written before the crash');
    reborn.destroy();
  });
});
