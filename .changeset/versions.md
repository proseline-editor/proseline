---
"@proseline-editor/core": minor
"@proseline-editor/react": minor
"@proseline-editor/sync": patch
---

Versions: named and automatic snapshots (host `VersionStore`), preview, word-level comparison (`diffDocs`), restore as one undoable, synced change with a "Before restore" safety snapshot, and `<VersionsPanel />`. Sync: restores are their own Yjs undo step; the structural-merge guard no longer throws when a local change only deletes blocks (e.g. undoing an inserted paragraph) and no longer brings back text a co-author deliberately replaced.
