# @proseline-editor/vue

## 0.1.1

### Patch Changes

- Updated dependencies [0137738]
  - @proseline-editor/core@0.1.1

## 0.1.0

### Minor Changes

- 45e4264: New package `@proseline-editor/vue`: the full component set for Vue 3 (editor, surface, toolbar, find & replace, stats, focus, sync status, comments, versions, mentions, style analysis) plus `useController` and `useEditorState`, written as render functions so no SFC compiler is needed. `relativeTime` moved to core (still exported by the React package).

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
  - @proseline-editor/core@0.1.0
