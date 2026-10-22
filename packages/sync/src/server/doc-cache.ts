import * as Y from 'yjs';

export interface DocCacheOptions {
  /** Full stored state of a document (snapshot + log merged), or null when it does not exist yet. */
  load(docId: string): Promise<Uint8Array | null>;
  /** Called once a document has been quiet for `idleMs` — derive HTML/word counts, compact the log. */
  onIdle?(docId: string, doc: Y.Doc): void | Promise<void>;
  /** Max documents kept in memory (least recently used are evicted). Default 100. */
  max?: number;
  /** Default 2000 ms. */
  idleMs?: number;
  /** Errors from `onIdle`. Default: rethrown asynchronously. */
  onError?(error: unknown): void;
}

export interface DocCache {
  /** Applies an (already validated) update to the cached document, loading it on a miss. */
  apply(docId: string, update: Uint8Array): Promise<Y.Doc>;
  get(docId: string): Promise<Y.Doc>;
  /** What a peer with `stateVector` lacks, served from memory. */
  diff(docId: string, stateVector?: Uint8Array): Promise<Uint8Array>;
  /** Drops a document (e.g. after another process changed it). A pending idle callback runs first. */
  evict(docId: string): void;
  /** Runs every pending idle callback now — call on shutdown. */
  flush(): Promise<void>;
  readonly size: number;
}

interface Entry {
  doc: Y.Doc;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Keeps live Y.Docs in memory so a server applies each incoming update to a cached document instead
 * of reloading and re-merging the whole log, and runs derived work (HTML, word count, compaction)
 * debounced. The stored log stays the source of truth: a miss rebuilds the document from it.
 * Assumes this process sees every update of a cached document (one instance, or sticky routing);
 * otherwise `evict` documents that other processes changed.
 */
export const createDocCache = (opts: DocCacheOptions): DocCache => {
  const entries = new Map<string, Entry>();
  const loading = new Map<string, Promise<Entry>>();
  const max = opts.max ?? 100;
  const idleMs = opts.idleMs ?? 2000;
  const report =
    opts.onError ??
    ((error: unknown) => {
      setTimeout(() => {
        throw error;
      });
    });

  const runIdle = async (docId: string, entry: Entry): Promise<void> => {
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = null;
    try {
      await opts.onIdle?.(docId, entry.doc);
    } catch (error) {
      report(error);
    }
  };

  const evict = (docId: string): void => {
    const entry = entries.get(docId);
    if (!entry) return;
    entries.delete(docId);
    const done = entry.timer ? runIdle(docId, entry) : Promise.resolve();
    void done.then(() => entry.doc.destroy());
  };

  const touch = (docId: string, entry: Entry): void => {
    entries.delete(docId); // re-insert: Map order is the LRU order
    entries.set(docId, entry);
    while (entries.size > max) {
      const oldest = entries.keys().next().value as string;
      evict(oldest);
    }
  };

  const entryFor = async (docId: string): Promise<Entry> => {
    const cached = entries.get(docId);
    if (cached) {
      touch(docId, cached);
      return cached;
    }
    let pending = loading.get(docId);
    if (!pending) {
      // Concurrent misses share one load.
      pending = (async () => {
        const doc = new Y.Doc({ gc: true });
        const state = await opts.load(docId);
        if (state) Y.applyUpdate(doc, state);
        return { doc, timer: null };
      })();
      loading.set(docId, pending);
      pending.then(
        (entry) => {
          loading.delete(docId);
          touch(docId, entry);
        },
        () => loading.delete(docId),
      );
    }
    return pending;
  };

  return {
    get size() {
      return entries.size;
    },
    get: async (docId) => (await entryFor(docId)).doc,
    apply: async (docId, update) => {
      const entry = await entryFor(docId);
      Y.applyUpdate(entry.doc, update);
      if (opts.onIdle) {
        if (entry.timer) clearTimeout(entry.timer);
        entry.timer = setTimeout(() => void runIdle(docId, entry), idleMs);
      }
      return entry.doc;
    },
    diff: async (docId, stateVector) => Y.encodeStateAsUpdate((await entryFor(docId)).doc, stateVector),
    evict,
    flush: async () => {
      await Promise.all([...entries].filter(([, e]) => e.timer).map(([id, e]) => runIdle(id, e)));
    },
  };
};
