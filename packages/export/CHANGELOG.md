# @proseline-editor/export

## 0.1.1

### Patch Changes

- Updated dependencies [0137738]
  - @proseline-editor/core@0.1.1

## 0.1.0

### Minor Changes

- 45e4264: New package `@proseline-editor/export`: export manuscripts (headings and prose documents) to DOCX, Markdown and HTML in the browser or Node, with `manuscript` and `book` presets, named Word styles, Word comments with replies, and mentions written as their current names.
- 45e4264: Import: `importManuscript` reads DOCX (via mammoth), Markdown and HTML into the prose schema, turns break marks into scene breaks and can split the manuscript into documents at headings or scene breaks; `joinDocuments` puts them back into one editor document. DOCX export now writes list items in Word's List Paragraph style.

### Patch Changes

- 45e4264: API clean-up before 1.0. Feature factories now declare their return type (`Feature<'comments', CommentsController>` and so on) instead of exposing their implementation. Internal helpers are no longer exported:
  - from `@proseline-editor/core`: `createDocCounter`, `isTypingTransaction`
  - from `/features`: `myers`, `tokenize`, `EditOp`, `sentenceRange`, `blockText`, `buildPattern`, `expandReplacement`
  - from `@proseline-editor/sync`: `guardStructuralMerges`, `STRUCTURAL_MERGE_ORIGIN`, `LOCK_FIELD`, `isRemoteYjsTransaction`
  
  Every package now ships a README and LICENSE, npm metadata, and declares Node ≥ 20.
- 45e4264: Pasting from Word and Google Docs: Word's list paragraphs become real (nested) lists, Office markup disappears, blank lines become empty paragraphs instead of hard breaks, and typed break marks (`* * *`, `⁂`…) become scene breaks. New exports `cleanPastedHTML` and `isBreakMark`; the importer uses the same break-mark rule. The browser test suite now runs in Chromium, Firefox and WebKit.
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
