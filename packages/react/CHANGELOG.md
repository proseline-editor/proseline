# @proseline-editor/react

## 0.1.1

### Patch Changes

- Updated dependencies [0137738]
  - @proseline-editor/core@0.1.1

## 0.1.0

### Minor Changes

- 45e4264: Block locks: while a writer edits a block, co-authors cannot change it until the writer has been idle for 10 s (configurable), moves to another block or leaves. Co-authors' carets render without text nodes.
- 45e4264: Real-time collaboration: a reliable sync provider for any backend, the `collaboration` feature, IndexedDB persistence, a Hocuspocus provider, server helpers and a `<SyncStatus>` component. Core features can now provide their own history and mark remote transactions.
- 45e4264: Comments: threads anchored to text without touching the document (host `CommentStore`, position or Yjs anchoring, re-anchoring by quote, orphan detection), `<CommentsRail />` and a toolbar Comment button. Old WorldForge `comment` marks still load and can be migrated with `legacyCommentAnchors`.
- 45e4264: First release: headless prose editor with typography, paragraph styles, find & replace, stats and focus features, plus React components and a default theme.
- 45e4264: Mentions: an `@` menu over the host's entities (`MentionProvider`, `staticMentionProvider`) that also matches case forms, a `mention` node inserted in a chosen grammatical case, mentions rendered with the entity's current name (renames, deleted entities and missing forms show live), a case picker and an `onOpen` hook; `<MentionMenu />` and `<MentionCasePicker />`. Word counts and version diffs now read inline nodes by their text.
- 45e4264: Style analysis: filler words, adverbs, repetitions, long sentences, passive voice and a readability score, analyzed per paragraph on the main thread and highlighted around the viewport; `<StylePanel />` and a toolbar toggle. New package `@proseline-editor/lexicons` with English, Ukrainian and French word lists.
- 45e4264: Versions: named and automatic snapshots (host `VersionStore`), preview, word-level comparison (`diffDocs`), restore as one undoable, synced change with a "Before restore" safety snapshot, and `<VersionsPanel />`. Sync: restores are their own Yjs undo step; the structural-merge guard no longer throws when a local change only deletes blocks (e.g. undoing an inserted paragraph) and no longer brings back text a co-author deliberately replaced.

### Patch Changes

- 45e4264: API clean-up before 1.0. Feature factories now declare their return type (`Feature<'comments', CommentsController>` and so on) instead of exposing their implementation. Internal helpers are no longer exported:
  - from `@proseline-editor/core`: `createDocCounter`, `isTypingTransaction`
  - from `/features`: `myers`, `tokenize`, `EditOp`, `sentenceRange`, `blockText`, `buildPattern`, `expandReplacement`
  - from `@proseline-editor/sync`: `guardStructuralMerges`, `STRUCTURAL_MERGE_ORIGIN`, `LOCK_FIELD`, `isRemoteYjsTransaction`
  
  Every package now ships a README and LICENSE, npm metadata, and declares Node ≥ 20.
- 45e4264: New package `@proseline-editor/vue`: the full component set for Vue 3 (editor, surface, toolbar, find & replace, stats, focus, sync status, comments, versions, mentions, style analysis) plus `useController` and `useEditorState`, written as render functions so no SFC compiler is needed. `relativeTime` moved to core (still exported by the React package).
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
