# @proseline-editor/sync-hocuspocus

## 0.1.0

### Minor Changes

- 45e4264: Real-time collaboration: a reliable sync provider for any backend, the `collaboration` feature, IndexedDB persistence, a Hocuspocus provider, server helpers and a `<SyncStatus>` component. Core features can now provide their own history and mark remote transactions.

### Patch Changes

- 45e4264: API clean-up before 1.0. Feature factories now declare their return type (`Feature<'comments', CommentsController>` and so on) instead of exposing their implementation. Internal helpers are no longer exported:
  - from `@proseline-editor/core`: `createDocCounter`, `isTypingTransaction`
  - from `/features`: `myers`, `tokenize`, `EditOp`, `sentenceRange`, `blockText`, `buildPattern`, `expandReplacement`
  - from `@proseline-editor/sync`: `guardStructuralMerges`, `STRUCTURAL_MERGE_ORIGIN`, `LOCK_FIELD`, `isRemoteYjsTransaction`
  
  Every package now ships a README and LICENSE, npm metadata, and declares Node ≥ 20.
- Updated dependencies [45e4264]
- Updated dependencies [45e4264]
- Updated dependencies [45e4264]
- Updated dependencies [45e4264]
- Updated dependencies [45e4264]
- Updated dependencies [45e4264]
- Updated dependencies [45e4264]
- Updated dependencies [45e4264]
- Updated dependencies [45e4264]
- Updated dependencies [45e4264]
  - @proseline-editor/core@0.1.0
  - @proseline-editor/sync@0.1.0
