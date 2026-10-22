# Export and import

```bash
pnpm add @proseline-editor/export
```

## Export

```ts
import { exportManuscript } from '@proseline-editor/export';

const { blob, extension, warnings } = await exportManuscript({
  format: 'docx', // or 'markdown', 'html'
  documents: [
    { title: 'Chapter One', level: 1 },
    { content: editor.getJSON(), comments: await commentStore.list(docId) },
  ],
  preset: 'manuscript', // standard submission format; or 'book', or your own ExportPreset
  resolveMention: (id, caseKey) => currentName(id, caseKey),
  metadata: { title: 'Salt and Tide', author: 'Ann Lee' },
});
```

- `documents` are headings and prose in reading order; consecutive prose documents are separated by scene breaks.
  Content is ProseMirror JSON, HTML (needs `@tiptap/html`; in Node also `happy-dom`) or, for a Yjs document,
  `deriveJSON(state)` from `@proseline-editor/sync/server`.
- **DOCX** uses named Word styles (Body Text, First Paragraph, Epigraph, Letter, Scene Break, Heading 1–3), real Word
  lists and Word comments with replies. The `manuscript` preset is Times New Roman 12, double-spaced, with a
  "Surname / Title / page" header; `book` is a typeset look.
- **Markdown** and **HTML** (`renderMarkdown`, `renderHtml`, also usable on a server) keep headings, emphasis, quotes,
  lists and scene breaks.
- Mentions are written as the entity's current name in its case.

The `docx` library loads only for DOCX exports.

## Import

```ts
import { importManuscript, joinDocuments } from '@proseline-editor/export';

const { documents, warnings } = await importManuscript(file, { split: 'headings' }); // DOCX, Markdown or HTML
editor.tiptap.commands.setContent(joinDocuments(documents)); // or keep each chapter as its own document
```

Everything is parsed into the prose schema, so unknown formatting and scripts are dropped. Word styles written by the
export, and common built-in ones, map back; lines like `* * *` become scene breaks; `split` cuts the manuscript at
headings or scene breaks. `warnings` lists what could not be imported (unknown styles, images, tables).
