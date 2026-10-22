# @proseline-editor/lexicons

## 0.1.0

### Minor Changes

- 45e4264: Style analysis: filler words, adverbs, repetitions, long sentences, passive voice and a readability score, analyzed per paragraph on the main thread and highlighted around the viewport; `<StylePanel />` and a toolbar toggle. New package `@proseline-editor/lexicons` with English, Ukrainian and French word lists.

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
