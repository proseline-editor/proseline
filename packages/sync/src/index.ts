export { createSyncProvider, type SyncProviderOptions } from './provider.js';
export {
  collaboration,
  DEFAULT_FIELD,
  type CollaborationOptions,
  type CollaborationController,
  type CollaborationState,
  type CollaborationUser,
  type Peer,
} from './collaboration.js';
export { type BlockLock, type BlockLocksOptions, type LockRefusal } from './block-locks.js';
export { yjsAnchoring, type YjsAnchor } from './comment-anchoring.js';
export { memoryPersistence } from './persistence.js';
export {
  ForbiddenError,
  customTransport,
  type SyncPersistence,
  type SyncProvider,
  type SyncState,
  type SyncStatus,
  type SyncTransport,
  type SyncTransportHandlers,
} from './types.js';
