import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import { createStore } from '@proseline-editor/core';
import { createTabChannel } from './tab-channel.js';
import { ForbiddenError, type SyncPersistence, type SyncProvider, type SyncState, type SyncTransport } from './types.js';

export interface SyncProviderOptions {
  /** Stable document id; scopes persistence and the tab channel. Include the user id if devices are shared. */
  docId: string;
  /** Omit for a local-only document (persistence is then the only storage). */
  transport?: SyncTransport | null;
  persistence?: SyncPersistence | null;
  /** False for viewers: remote changes apply, nothing is sent. Default true. */
  canWrite?: boolean;
  /** Bring your own Y.Doc (it is not destroyed with the provider). */
  doc?: Y.Doc;
  /** Local updates are merged and sent at most this often. Default 250 ms. */
  batchMs?: number;
  /** Periodic catch-up, a fallback for missed broadcasts. Default 30 s. */
  resyncMs?: number;
  /** Debounce for saving the full local snapshot. Default 1 s. */
  snapshotMs?: number;
  /** Relay updates between tabs with BroadcastChannel. Default true. */
  tabSync?: boolean;
  /** Persistence and listener errors. Default: rethrown asynchronously. */
  onError?: (error: unknown) => void;
}

/** Origin of updates from the server or the local cache: never sent back. */
const REMOTE = Symbol('proseline:remote');
/** Origin of updates relayed from another tab: that tab sends them. */
const TAB = Symbol('proseline:tab');
const FIRST_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

const randomId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const rethrowAsync = (error: unknown): void => {
  setTimeout(() => {
    throw error;
  });
};

const merge = (a: Uint8Array | null, b: Uint8Array): Uint8Array => (a ? Y.mergeUpdates([a, b]) : b);

/**
 * Keeps a Y.Doc in sync with a request/response backend: batches local updates into posts (one in
 * flight, retried with backoff), stores every unconfirmed update before sending it, applies
 * co-authors' updates from the live channel, catches up via state-vector diffs (immediately when a
 * broadcast was missed), relays awareness (cursors) and mirrors changes between tabs.
 */
export const createSyncProvider = (opts: SyncProviderOptions): SyncProvider => {
  const { docId } = opts;
  const transport = opts.transport ?? null;
  const persistence = opts.persistence ?? null;
  const ownDoc = !opts.doc;
  const doc = opts.doc ?? new Y.Doc();
  const awareness = new Awareness(doc);
  const sessionId = randomId();
  const batchMs = opts.batchMs ?? 250;
  const report = opts.onError ?? rethrowAsync;

  const store = createStore<SyncState>({
    status: transport ? 'connecting' : 'local',
    ready: false,
    readOnly: opts.canWrite === false,
    unsent: 0,
  });
  let resolveReady: () => void = () => undefined;
  const whenReady = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  const patch = (next: Partial<SyncState>): void => {
    store.setState(next);
    if (store.getState().ready) resolveReady();
  };

  let pending: Uint8Array | null = null;
  let inFlight: Uint8Array | null = null;
  let inFlightCount = 0;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let snapshotTimer: ReturnType<typeof setTimeout> | null = null;
  let resyncTimer: ReturnType<typeof setInterval> | null = null;
  let resyncRetryTimer: ReturnType<typeof setTimeout> | null = null;
  let backoff = FIRST_BACKOFF_MS;
  let resyncBackoff = FIRST_BACKOFF_MS;
  let unsubscribe: (() => void) | null = null;
  let destroyed = false;

  // ── local persistence ─────────────────────────────────────────────────────
  // Writes are chained so they land in order; a post waits for the write before it.
  let writes: Promise<void> = Promise.resolve();
  const queueWrite = (write: () => Promise<void>): Promise<void> => {
    writes = writes.then(write).catch(report);
    return writes;
  };
  const unconfirmed = (): Uint8Array | null => (inFlight && pending ? Y.mergeUpdates([inFlight, pending]) : (inFlight ?? pending));
  const persistPending = (): void => {
    if (!persistence) return;
    const all = unconfirmed();
    void queueWrite(() => persistence.savePending(docId, sessionId, all));
  };
  const saveSnapshot = (): Promise<void> => {
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = null;
    if (!persistence) return Promise.resolve();
    const state = Y.encodeStateAsUpdate(doc);
    return queueWrite(async () => {
      await persistence.saveSnapshot(docId, state);
      // Without a server the snapshot is the durable copy: what it contains is no longer pending.
      if (!transport && pending) {
        pending = null;
        await persistence.savePending(docId, sessionId, null);
      }
    });
  };
  const scheduleSnapshot = (): void => {
    if (!persistence || snapshotTimer || destroyed) return;
    snapshotTimer = setTimeout(() => void saveSnapshot(), opts.snapshotMs ?? 1000);
  };

  // ── local → server ────────────────────────────────────────────────────────
  const scheduleFlush = (ms: number): void => {
    if (flushTimer || destroyed || !transport) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, ms);
  };

  const flush = async (): Promise<void> => {
    const state = store.getState();
    if (!transport || !pending || inFlight || state.readOnly || destroyed) return;
    const batch = pending;
    inFlight = batch;
    inFlightCount = state.unsent;
    pending = null;
    try {
      await writes; // stored before sent
      await transport.postUpdate(batch);
      inFlight = null;
      backoff = FIRST_BACKOFF_MS;
      persistPending();
      if (destroyed) return;
      patch({ unsent: Math.max(0, store.getState().unsent - inFlightCount), status: pending ? 'syncing' : 'synced' });
      if (pending) scheduleFlush(batchMs);
    } catch (error) {
      pending = pending ? Y.mergeUpdates([batch, pending]) : batch;
      inFlight = null;
      persistPending();
      if (destroyed) return;
      if (error instanceof ForbiddenError) {
        patch({ readOnly: true, status: 'error' });
        return;
      }
      patch({ status: 'offline' });
      const wait = backoff;
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      scheduleFlush(wait);
    }
  };

  const tab = opts.tabSync === false ? null : createTabChannel(`proseline:${docId}`, (update) => Y.applyUpdate(doc, update, TAB));

  const onDocUpdate = (update: Uint8Array, origin: unknown): void => {
    if (destroyed) return;
    scheduleSnapshot();
    if (origin === REMOTE || origin === TAB || store.getState().readOnly) return;
    tab?.post(update);
    pending = merge(pending, update);
    persistPending();
    if (!transport) return;
    patch({ status: 'syncing', unsent: store.getState().unsent + 1 });
    scheduleFlush(batchMs);
  };

  // ── server → local ────────────────────────────────────────────────────────
  const scheduleResyncRetry = (): void => {
    if (resyncRetryTimer || destroyed) return;
    const wait = resyncBackoff;
    resyncBackoff = Math.min(resyncBackoff * 2, MAX_BACKOFF_MS);
    resyncRetryTimer = setTimeout(() => {
      resyncRetryTimer = null;
      void resync();
    }, wait);
  };

  /** Pull whatever the server has that we lack. Safe to call any time. */
  const resync = async (): Promise<void> => {
    if (destroyed || !transport) return;
    try {
      const diff = await transport.fetchDiff(Y.encodeStateVector(doc));
      if (destroyed) return;
      Y.applyUpdate(doc, diff, REMOTE);
      resyncBackoff = FIRST_BACKOFF_MS;
      if (resyncRetryTimer) clearTimeout(resyncRetryTimer);
      resyncRetryTimer = null;
      const s = store.getState();
      const idle = !pending && !inFlight;
      patch({ ready: true, status: s.status === 'error' ? 'error' : idle ? 'synced' : 'syncing' });
    } catch (error) {
      if (destroyed) return;
      if (error instanceof ForbiddenError) {
        patch({ readOnly: true, status: 'error' });
        return;
      }
      patch({ status: 'offline' });
      scheduleResyncRetry();
    }
  };

  const onRemoteUpdate = (update: Uint8Array): void => {
    if (destroyed) return;
    Y.applyUpdate(doc, update, REMOTE);
    // A missed broadcast leaves structs waiting on dependencies: fetch what we lack now.
    if (doc.store.pendingStructs || doc.store.pendingDs) void resync();
  };

  // ── awareness (cursors) ───────────────────────────────────────────────────
  const onAwarenessUpdate = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown): void => {
    if (origin === REMOTE || !transport) return;
    transport.sendAwareness(encodeAwarenessUpdate(awareness, added.concat(updated, removed)));
  };
  const broadcastOwnAwareness = (): void => {
    if (!destroyed && transport) transport.sendAwareness(encodeAwarenessUpdate(awareness, [doc.clientID]));
  };
  const onRemoteAwareness = (update: Uint8Array): void => {
    if (destroyed) return;
    const known = new Set(awareness.getStates().keys());
    applyAwarenessUpdate(awareness, update, REMOTE);
    // A newcomer doesn't know us yet: introduce ourselves instead of waiting for the 30 s renewal.
    for (const id of awareness.getStates().keys()) {
      if (!known.has(id)) {
        broadcastOwnAwareness();
        break;
      }
    }
  };

  doc.on('update', onDocUpdate);
  awareness.on('update', onAwarenessUpdate);

  // ── start ─────────────────────────────────────────────────────────────────
  const loadLocal = async (): Promise<void> => {
    if (!persistence) return;
    try {
      const snapshot = await persistence.loadSnapshot(docId);
      const sessions = await persistence.loadPending(docId);
      if (destroyed) return;
      if (snapshot) Y.applyUpdate(doc, snapshot, REMOTE);
      const stored = [...sessions.values()];
      if (stored.length && !store.getState().readOnly) {
        const update = Y.mergeUpdates(stored);
        // Queue the stored bytes explicitly: they may depend on content we don't have yet, in which
        // case Yjs parks them and they integrate later inside a REMOTE catch-up.
        Y.applyUpdate(doc, update, REMOTE);
        pending = merge(pending, update);
        persistPending();
        for (const key of sessions.keys()) if (key !== sessionId) void queueWrite(() => persistence.savePending(docId, key, null));
        if (transport) patch({ status: 'syncing', unsent: store.getState().unsent + 1 });
        else void saveSnapshot();
      }
      if (snapshot || stored.length) patch({ ready: true });
    } catch (error) {
      report(error);
    }
  };

  const start = async (): Promise<void> => {
    await loadLocal();
    if (destroyed) return;
    if (!transport) {
      patch({ ready: true, status: 'local' });
      return;
    }
    unsubscribe = transport.subscribe({
      onUpdate: onRemoteUpdate,
      onAwareness: onRemoteAwareness,
      onStatus: (connected) => {
        if (!connected) return; // only REST failures mean "offline"
        broadcastOwnAwareness();
        void resync();
      },
    });
    await resync();
    if (destroyed) return;
    resyncTimer = setInterval(() => void resync(), opts.resyncMs ?? 30_000);
    if (pending) scheduleFlush(batchMs);
  };
  void start();

  return {
    doc,
    awareness,
    whenReady,
    getState: store.getState,
    subscribe: store.subscribe,
    destroy: () => {
      if (destroyed) return;
      if (persistence) void saveSnapshot();
      removeAwarenessStates(awareness, [doc.clientID], 'destroy');
      destroyed = true;
      if (flushTimer) clearTimeout(flushTimer);
      if (resyncTimer) clearInterval(resyncTimer);
      if (resyncRetryTimer) clearTimeout(resyncRetryTimer);
      unsubscribe?.();
      tab?.close();
      doc.off('update', onDocUpdate);
      awareness.off('update', onAwarenessUpdate);
      awareness.destroy();
      if (ownDoc) doc.destroy();
    },
  };
};
