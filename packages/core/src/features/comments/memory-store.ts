import type { Comment, CommentStore, CommentThread } from './types.js';

/** Threads and listeners shared by several memory stores (one per author). */
export interface MemoryComments {
  readonly threads: Map<string, CommentThread>;
  readonly listeners: Map<string, Set<() => void>>;
}

export interface MemoryCommentStoreOptions {
  /** Who writes through this store. */
  author?: { id: string; name?: string };
  /** Share threads with another memory store: `memoryCommentStore({ author: bo, shared: annStore.shared })`. */
  shared?: MemoryComments;
  /** Clock for timestamps (tests). */
  now?: () => Date;
}

let counter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++counter).toString(36)}`;

/**
 * An in-memory CommentStore for tests, demos and prototypes. Stores built on the same `shared`
 * container see — and are notified of — each other's changes.
 */
export const memoryCommentStore = (options: MemoryCommentStoreOptions = {}): CommentStore & { readonly shared: MemoryComments } => {
  const shared: MemoryComments = options.shared ?? { threads: new Map(), listeners: new Map() };
  const { threads, listeners } = shared;
  const author = options.author ?? { id: 'local' };
  const now = () => (options.now?.() ?? new Date()).toISOString();
  const comment = (body: string): Comment => ({
    id: newId('c'),
    authorId: author.id,
    ...(author.name ? { authorName: author.name } : {}),
    body,
    createdAt: now(),
  });
  const changed = (docId: string) => listeners.get(docId)?.forEach((l) => l());
  const get = (threadId: string): CommentThread => {
    const thread = threads.get(threadId);
    if (!thread) throw new Error(`No thread ${threadId}`);
    return thread;
  };
  const copy = (t: CommentThread): CommentThread => structuredClone(t);

  return {
    shared,
    list: async (docId) => [...threads.values()].filter((t) => t.docId === docId).map(copy),
    create: async ({ docId, anchor, body }) => {
      const thread: CommentThread = { id: newId('t'), docId, anchor, resolved: false, createdAt: now(), comments: [comment(body)] };
      threads.set(thread.id, thread);
      changed(docId);
      return copy(thread);
    },
    reply: async (threadId, body) => {
      const thread = get(threadId);
      thread.comments.push(comment(body));
      changed(thread.docId);
      return copy(thread);
    },
    setResolved: async (threadId, resolved) => {
      const thread = get(threadId);
      thread.resolved = resolved;
      changed(thread.docId);
    },
    remove: async (threadId) => {
      const { docId } = get(threadId);
      threads.delete(threadId);
      changed(docId);
    },
    updateAnchor: async (threadId, anchor) => {
      get(threadId).anchor = anchor;
    },
    subscribe: (docId, onChange) => {
      const set = listeners.get(docId) ?? new Set();
      set.add(onChange);
      listeners.set(docId, set);
      return () => {
        set.delete(onChange);
      };
    },
  };
};
