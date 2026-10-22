import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { HocuspocusProvider, WebSocketStatus, type HocuspocusProviderConfiguration, type HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { createStore } from '@proseline-editor/core';
import type { SyncPersistence, SyncProvider, SyncState } from '@proseline-editor/sync';

export interface HocuspocusSyncOptions {
  /** Document name on the server; also the persistence key. */
  name: string;
  /** Server URL (ws:// or wss://). Pass this or a shared `websocketProvider`. */
  url?: string;
  websocketProvider?: HocuspocusProviderWebsocket;
  token?: string | (() => string) | (() => Promise<string>) | null;
  /** Local copy for offline open and crash-safe edits. */
  persistence?: SyncPersistence | null;
  doc?: Y.Doc;
  /** Debounce for saving the local snapshot. Default 1 s. */
  snapshotMs?: number;
  /** Any other HocuspocusProvider option. */
  configuration?: Partial<HocuspocusProviderConfiguration>;
  onError?: (error: unknown) => void;
}

/** Origin of updates restored from the local copy. */
const LOCAL = Symbol('proseline:local');

const randomId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * A SyncProvider over a Hocuspocus server. Hocuspocus does the network sync (the Yjs sync protocol
 * reconciles both ways on every reconnect); this adapter adds the Proseline state model and an
 * optional local copy: local edits are stored immediately and folded into a snapshot, so a document
 * opens offline and nothing typed is lost to a crash.
 */
export const hocuspocusProvider = (opts: HocuspocusSyncOptions): SyncProvider => {
  const doc = opts.doc ?? new Y.Doc();
  const ownDoc = !opts.doc;
  const awareness = new Awareness(doc);
  const persistence = opts.persistence ?? null;
  const sessionId = randomId();
  const report =
    opts.onError ??
    ((error: unknown) => {
      setTimeout(() => {
        throw error;
      });
    });

  const store = createStore<SyncState>({ status: 'connecting', ready: false, readOnly: false, unsent: 0 });
  let resolveReady: () => void = () => undefined;
  const whenReady = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  let connection: WebSocketStatus = WebSocketStatus.Connecting;
  let everSynced = false;
  let denied = false;
  let provider: HocuspocusProvider | null = null;
  let destroyed = false;

  const refresh = (): void => {
    const unsent = provider?.unsyncedChanges ?? 0;
    const readOnly = denied || provider?.authorizedScope === 'readonly';
    let status: SyncState['status'];
    if (denied) status = 'error';
    else if (connection === WebSocketStatus.Disconnected) status = everSynced || store.getState().ready ? 'offline' : 'connecting';
    else if (!everSynced) status = 'connecting';
    else status = unsent > 0 ? 'syncing' : 'synced';
    store.setState({ status, readOnly, unsent, ready: store.getState().ready || everSynced });
    if (store.getState().ready) resolveReady();
  };

  // ── local copy ────────────────────────────────────────────────────────────
  let writes: Promise<void> = Promise.resolve();
  const queueWrite = (write: () => Promise<void>): void => {
    writes = writes.then(write).catch(report);
  };
  let pending: Uint8Array | null = null;
  let snapshotTimer: ReturnType<typeof setTimeout> | null = null;
  const saveSnapshot = (): void => {
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = null;
    if (!persistence) return;
    const state = Y.encodeStateAsUpdate(doc);
    const folded = pending !== null;
    pending = null;
    queueWrite(async () => {
      await persistence.saveSnapshot(opts.name, state);
      if (folded) await persistence.savePending(opts.name, sessionId, null);
    });
  };
  const onDocUpdate = (update: Uint8Array, origin: unknown): void => {
    if (!persistence || destroyed) return;
    if (origin !== LOCAL && origin !== provider) {
      // The writer's own change: store it now, fold it into the snapshot shortly.
      pending = pending ? Y.mergeUpdates([pending, update]) : update;
      const all = pending;
      queueWrite(() => persistence.savePending(opts.name, sessionId, all));
    }
    if (!snapshotTimer) snapshotTimer = setTimeout(saveSnapshot, opts.snapshotMs ?? 1000);
  };
  doc.on('update', onDocUpdate);

  const start = async (): Promise<void> => {
    if (persistence) {
      try {
        const snapshot = await persistence.loadSnapshot(opts.name);
        const sessions = await persistence.loadPending(opts.name);
        if (destroyed) return;
        if (snapshot) Y.applyUpdate(doc, snapshot, LOCAL);
        for (const update of sessions.values()) Y.applyUpdate(doc, update, LOCAL);
        if (sessions.size) {
          saveSnapshot();
          for (const key of sessions.keys()) queueWrite(() => persistence.savePending(opts.name, key, null));
        }
        if (snapshot || sessions.size) store.setState({ ready: true });
      } catch (error) {
        report(error);
      }
    }
    if (destroyed) return;
    provider = new HocuspocusProvider({
      ...opts.configuration,
      name: opts.name,
      document: doc,
      awareness,
      token: opts.token ?? null,
      ...(opts.websocketProvider ? { websocketProvider: opts.websocketProvider } : { url: opts.url as string }),
      onStatus: ({ status }) => {
        connection = status;
        refresh();
      },
      onSynced: ({ state }) => {
        if (state) everSynced = true;
        refresh();
      },
      onUnsyncedChanges: () => refresh(),
      onAuthenticated: () => refresh(),
      onAuthenticationFailed: () => {
        denied = true;
        refresh();
      },
    });
    refresh();
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
      saveSnapshot();
      destroyed = true;
      doc.off('update', onDocUpdate);
      provider?.destroy();
      awareness.destroy();
      if (ownDoc) doc.destroy();
    },
  };
};
