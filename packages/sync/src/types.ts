import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import type { ReadableStore } from '@proseline-editor/core';

/**
 * - `connecting` — before the first catch-up
 * - `synced` — everything local is confirmed by the server
 * - `syncing` — local changes are on their way
 * - `offline` — the server is unreachable; changes are kept and retried
 * - `error` — the server refused writes (access revoked); the editor is read-only
 * - `local` — no transport: the document lives only in local persistence
 */
export type SyncStatus = 'connecting' | 'synced' | 'syncing' | 'offline' | 'error' | 'local';

export interface SyncState {
  status: SyncStatus;
  /** True once there is content to show: the first catch-up landed, or a local copy was loaded. */
  ready: boolean;
  readOnly: boolean;
  /** Local changes not yet confirmed by the server. */
  unsent: number;
}

/** What the collaboration feature and UI adapters consume. Implemented by the engine and the Hocuspocus adapter. */
export interface SyncProvider extends ReadableStore<SyncState> {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  /** Resolves when `ready` first becomes true. Create the editor after it, so no empty placeholder content is synced. */
  readonly whenReady: Promise<void>;
  destroy(): void;
}

export interface SyncTransportHandlers {
  /** An update from the server (a co-author's change, possibly our own echo — applying it twice is harmless). */
  onUpdate(update: Uint8Array): void;
  onAwareness(update: Uint8Array): void;
  /** The live channel connected or dropped. Saves never depend on it. */
  onStatus(connected: boolean): void;
}

/**
 * What a request/response backend implements (e.g. REST + a pub/sub channel). Updates are opaque
 * Yjs binary; re-sending one is always safe.
 */
export interface SyncTransport {
  /** The update the server has that a peer with `stateVector` lacks. */
  fetchDiff(stateVector: Uint8Array): Promise<Uint8Array>;
  /** Persist one (merged) update. Reject with `ForbiddenError` when the user may not write. */
  postUpdate(update: Uint8Array): Promise<void>;
  subscribe(handlers: SyncTransportHandlers): () => void;
  sendAwareness(update: Uint8Array): void;
}

/** Thrown by a transport when the server refuses a write (role revoked). Switches the provider to read-only. */
export class ForbiddenError extends Error {
  constructor(message = 'No write access to this document') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Local durable storage. `snapshot` is the whole document (offline open); `pending` holds updates not
 * yet confirmed by the server, one entry per session so concurrent tabs never overwrite each other.
 */
export interface SyncPersistence {
  loadSnapshot(docId: string): Promise<Uint8Array | null>;
  saveSnapshot(docId: string, state: Uint8Array): Promise<void>;
  /** Every session's unconfirmed updates for the document (session id → update). */
  loadPending(docId: string): Promise<Map<string, Uint8Array>>;
  /** Stores (or with `null`, removes) one session's unconfirmed updates. */
  savePending(docId: string, sessionId: string, update: Uint8Array | null): Promise<void>;
}

/** Identity helper that types a backend's transport object. */
export const customTransport = (transport: SyncTransport): SyncTransport => transport;
