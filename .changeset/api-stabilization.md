---
"@proseline-editor/core": minor
"@proseline-editor/sync": minor
"@proseline-editor/react": patch
"@proseline-editor/vue": patch
"@proseline-editor/sync-indexeddb": patch
"@proseline-editor/sync-hocuspocus": patch
"@proseline-editor/lexicons": patch
"@proseline-editor/export": patch
---

API clean-up before 1.0. Feature factories now declare their return type (`Feature<'comments', CommentsController>` and so on) instead of exposing their implementation. Internal helpers are no longer exported:
- from `@proseline-editor/core`: `createDocCounter`, `isTypingTransaction`
- from `/features`: `myers`, `tokenize`, `EditOp`, `sentenceRange`, `blockText`, `buildPattern`, `expandReplacement`
- from `@proseline-editor/sync`: `guardStructuralMerges`, `STRUCTURAL_MERGE_ORIGIN`, `LOCK_FIELD`, `isRemoteYjsTransaction`

Every package now ships a README and LICENSE, npm metadata, and declares Node ≥ 20.
