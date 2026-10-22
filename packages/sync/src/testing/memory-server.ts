import * as Y from 'yjs';
import { ForbiddenError, type SyncTransport, type SyncTransportHandlers } from '../types.js';
import { createRandom } from './random.js';

export interface MemoryServer {
  /** The authoritative document. */
  readonly doc: Y.Doc;
  /** Number of updates accepted (duplicates included). */
  readonly posts: number;
  /** Refuse writes from transports created with this user id. */
  revoke(userId: string): void;
  connect(options?: MemoryTransportOptions): MemoryTransport;
}

export interface MemoryTransportOptions {
  userId?: string;
  /** Seed for the fault injection below. Default 1. */
  seed?: number;
  /** Max random delay per request/broadcast in ms (random delays reorder broadcasts). Default 0. */
  latencyMs?: number;
  /** Probability that a broadcast to this client is dropped. Default 0. */
  dropRate?: number;
  /** Probability that a post fails before reaching the server. Default 0. */
  failRate?: number;
  /** Probability that a post is applied but its response is lost (the client sees an error). Default 0. */
  lostAckRate?: number;
}

export interface MemoryTransport extends SyncTransport {
  setOnline(online: boolean): void;
  readonly online: boolean;
}

class OfflineError extends Error {
  constructor() {
    super('offline');
    this.name = 'OfflineError';
  }
}

/**
 * An in-process sync server with a fault-injecting network, for tests and demos: each `connect()`
 * returns a transport whose requests and broadcasts can be delayed, reordered, dropped or cut off.
 */
export const createMemoryServer = (): MemoryServer => {
  const doc = new Y.Doc();
  const revoked = new Set<string>();
  const clients = new Set<{ deliver(kind: 'update' | 'awareness', bytes: Uint8Array): void }>();
  let posts = 0;

  const broadcast = (kind: 'update' | 'awareness', bytes: Uint8Array) => clients.forEach((c) => c.deliver(kind, bytes));

  return {
    doc,
    get posts() {
      return posts;
    },
    revoke: (userId) => revoked.add(userId),
    connect: (options = {}) => {
      const random = createRandom(options.seed ?? 1);
      const delay = () => new Promise<void>((resolve) => setTimeout(resolve, Math.floor(random() * (options.latencyMs ?? 0))));
      let online = true;
      let handlers: SyncTransportHandlers | null = null;
      const client = {
        deliver: (kind: 'update' | 'awareness', bytes: Uint8Array) => {
          if (!online || !handlers || random() < (options.dropRate ?? 0)) return;
          void delay().then(() => {
            if (!online || !handlers) return;
            if (kind === 'update') handlers.onUpdate(bytes);
            else handlers.onAwareness(bytes);
          });
        },
      };
      const request = async () => {
        await delay();
        if (!online) throw new OfflineError();
      };
      return {
        get online() {
          return online;
        },
        setOnline: (next) => {
          if (online === next) return;
          online = next;
          handlers?.onStatus(next);
        },
        fetchDiff: async (stateVector) => {
          await request();
          return Y.encodeStateAsUpdate(doc, stateVector);
        },
        postUpdate: async (update) => {
          await request();
          if (random() < (options.failRate ?? 0)) throw new OfflineError();
          if (options.userId && revoked.has(options.userId)) throw new ForbiddenError();
          Y.applyUpdate(doc, update);
          posts++;
          broadcast('update', update);
          if (random() < (options.lostAckRate ?? 0)) throw new OfflineError();
        },
        subscribe: (h) => {
          handlers = h;
          clients.add(client);
          h.onStatus(online);
          return () => {
            handlers = null;
            clients.delete(client);
          };
        },
        sendAwareness: (update) => {
          if (online) broadcast('awareness', update);
        },
      };
    },
  };
};
