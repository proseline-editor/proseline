---
"@proseline-editor/core": minor
"@proseline-editor/export": patch
---

Pasting from Word and Google Docs: Word's list paragraphs become real (nested) lists, Office markup disappears, blank lines become empty paragraphs instead of hard breaks, and typed break marks (`* * *`, `⁂`…) become scene breaks. New exports `cleanPastedHTML` and `isBreakMark`; the importer uses the same break-mark rule. The browser test suite now runs in Chromium, Firefox and WebKit.
