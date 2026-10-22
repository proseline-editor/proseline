# Proseline

An embeddable, open-source editor for **long-form prose** — novels, scripts, journalism, non-fiction.
Documentation, guides and a live playground: [`site/`](site) (`pnpm docs:dev`), published to GitHub Pages once the
repository enables it.
Built on [TipTap 3](https://tiptap.dev) (ProseMirror). Headless core, React components, MIT licensed.

> Status: 0.x — the API may change between minor versions until 1.0.

## Packages

| Package | |
|---|---|
| `@proseline-editor/core` | Headless editor, prose schema, features (`/features`) |
| `@proseline-editor/react` | `<ProselineEditor>`, hooks, toolbar and panels, `theme.css` |
| `@proseline-editor/vue` | The same components for Vue 3, `useController()` composable, `theme.css` |
| `@proseline-editor/sync` | Real-time collaboration: reliable sync provider, `collaboration` feature, `/server` helpers, `/testing` |
| `@proseline-editor/sync-indexeddb` | IndexedDB persistence: offline open, crash-safe unsent edits |
| `@proseline-editor/sync-hocuspocus` | Provider for [Hocuspocus](https://tiptap.dev/hocuspocus) / y-websocket servers |
| `@proseline-editor/lexicons` | Style-analysis word lists: `/en`, `/uk`, `/fr` |
| `@proseline-editor/export` | Export to DOCX (with Word comments), Markdown and HTML, and import them back, in the browser or Node |

## Quick start (React)

```bash
pnpm add @proseline-editor/core @proseline-editor/react @tiptap/core @tiptap/pm @tiptap/react
```

```tsx
import { ProselineEditor, ProselineContent, Toolbar, FindReplace, StatsBar } from '@proseline-editor/react';
import { typography, paragraphStyles, findReplace, stats, focus } from '@proseline-editor/core/features';
import '@proseline-editor/react/theme.css';

export const Manuscript = ({ html, save }: { html: string; save: (html: string) => void }) => (
  <ProselineEditor
    content={html}
    onChange={(editor) => save(editor.getHTML())}
    locale="uk"
    features={[typography(), paragraphStyles(), findReplace(), stats({ goal: 1000 }), focus()]}
  >
    <Toolbar />
    <FindReplace />
    <ProselineContent />
    <StatsBar />
  </ProselineEditor>
);
```

Without children, `<ProselineEditor>` renders just the writing surface. Skip `theme.css` to style everything yourself.

## Quick start (Vue 3)

```bash
pnpm add @proseline-editor/core @proseline-editor/vue @tiptap/core @tiptap/pm
```

```vue
<script setup lang="ts">
import { ProselineEditor, ProselineContent, Toolbar, FindReplace, StatsBar } from '@proseline-editor/vue';
import { typography, paragraphStyles, findReplace, stats, focus } from '@proseline-editor/core/features';
import '@proseline-editor/vue/theme.css';

const props = defineProps<{ html: string }>();
const emit = defineEmits<{ save: [html: string] }>();
const features = [typography(), paragraphStyles(), findReplace(), stats({ goal: 1000 }), focus()];
</script>

<template>
  <ProselineEditor :content="props.html" locale="uk" :features="features" @change="(editor) => emit('save', editor.getHTML())">
    <Toolbar />
    <FindReplace />
    <ProselineContent />
    <StatsBar />
  </ProselineEditor>
</template>
```

The Vue components mirror the React ones (same names, markup, classes and accessible labels; `@ready`/`@change`
instead of `onReady`/`onChange`), and both examples pass the same browser test suite. `useController(name)` returns a
computed ref of `{ state, commands }`.

## Features (v0.1)

- **typography** — locale-aware smart quotes (“” / «» / « »), em dashes, ellipses, French spacing
- **paragraphStyles** — body, epigraph, letter, centered; flush (no first-line indent)
- **findReplace** — case, whole word, regex, in-selection; replace all as one undo step
- **stats** — words, characters, pages, reading time, document and session goals
- **focus** — paragraph/sentence focus, typewriter scrolling, distraction-free mode
- **comments** — threads on selected text stored in your backend (`CommentStore`), replies, resolve, orphan detection; `<CommentsRail />`
  shows them beside the text. With collaboration, pass `anchoring: yjsAnchoring()` from `@proseline-editor/sync`.
- **versions** — named and automatic snapshots in your backend (`VersionStore`), preview, word-level comparison with the current
  text, restore as one undoable change; `<VersionsPanel />`
- **mentions** — `@` menu over your entities (`MentionProvider`), insertion in a grammatical case from the case forms you supply,
  mentions that follow renames and show deleted entities; click to switch the case or (with `onOpen`) open the entity;
  `<MentionMenu />` and `<MentionCasePicker />`
- **styleAnalysis** — filler words, adverbs, repetitions, long sentences, passive voice and a readability score, with a lexicon
  from `@proseline-editor/lexicons` (or your own, via `extendLexicon`); off until the writer switches it on; `<StylePanel />`

UI strings ship in English, Ukrainian and French; override any of them with `messages`.

## Export

```ts
import { exportManuscript } from '@proseline-editor/export';

const { blob, extension } = await exportManuscript({
  format: 'docx', // or 'markdown', 'html'
  documents: [
    { title: 'Chapter One', level: 1 },
    { content: editor.getJSON(), comments: await commentStore.list(docId) },
  ],
  preset: 'manuscript', // standard submission format; or 'book', or your own
  resolveMention: (id, caseKey) => currentName(id, caseKey),
  metadata: { title: 'Salt and Tide', author: 'Ann Lee' },
});
```

DOCX uses named Word styles, so an editor can restyle the whole manuscript, and writes comments as Word comments with
replies. The `docx` library is loaded only for DOCX exports. HTML input works too (needs `@tiptap/html`, and `happy-dom`
in Node); for a Yjs document pass `deriveJSON(state)` from `@proseline-editor/sync/server`.

## Import

```ts
import { importManuscript, joinDocuments } from '@proseline-editor/export';

const { documents, warnings } = await importManuscript(file, { split: 'headings' }); // DOCX, Markdown or HTML
editor.tiptap.commands.setContent(joinDocuments(documents)); // or keep each chapter as its own document
```

Everything is parsed into the prose schema, so unknown formatting and scripts are dropped; Word styles written by the
export (and common built-in ones) map back, and lines like `* * *` become scene breaks. `mammoth` and `marked` are
loaded only when a DOCX or Markdown file is imported.

## Collaboration

```bash
pnpm add @proseline-editor/sync @proseline-editor/sync-hocuspocus @proseline-editor/sync-indexeddb yjs
```

```tsx
import { collaboration } from '@proseline-editor/sync';
import { hocuspocusProvider } from '@proseline-editor/sync-hocuspocus';
import { indexeddbPersistence } from '@proseline-editor/sync-indexeddb';
import { SyncStatus } from '@proseline-editor/react';

const provider = hocuspocusProvider({ name: 'chapter-1', url: 'wss://sync.example.com', persistence: indexeddbPersistence() });
await provider.whenReady; // create the editor once there is content (server or local copy)

<ProselineEditor features={[collaboration({ provider, user: { name: 'Ann', color: '#0f766e' } }), stats()]}>
  <Toolbar><SyncStatus /></Toolbar>
  <ProselineContent />
</ProselineEditor>
```

Any backend works: implement four functions (`fetchDiff`, `postUpdate`, `subscribe`, `sendAwareness`) and pass them to
`createSyncProvider({ docId, transport, persistence })`. The provider batches and retries posts, stores every unsent
change locally before sending it, catches up immediately after a missed broadcast, mirrors tabs and switches to
read-only when the server refuses writes. `@proseline-editor/sync/server` has validation, diff, Yjs ↔ HTML helpers and a
`DocCache` for request/response servers; `@proseline-editor/sync/testing` has an in-memory server with a fault-injecting
network for your own tests.

Structural edits are safe to make concurrently. The ProseMirror ↔ Yjs binding performs a block-type change or a wrap
(paragraph → heading, into a quote) as delete + re-create from the author's copy, which on its own would drop a co-author's
concurrent typing, bring back their concurrent deletions, and duplicate a block both changed. The `collaboration` feature
repairs all three: the affected writer's client replays its own typing and deletions into the new block, and identical
concurrent changes collapse into one. Two *different* concurrent changes of one block (heading vs quote) keep both
versions, so nothing is lost; a block deleted on purpose stays deleted.

While someone edits a block, it is locked for everyone else (tinted, with "Ann is editing"); the lock lapses after 10 s
without edits (`blockLocks: { idleMs }`), when the writer moves on or leaves. Enter at the very start or end of a locked
block still adds a paragraph beside it. Turn locks off with `collaboration({ provider, blockLocks: false })`.

## Headless use

```ts
import { createEditor } from '@proseline-editor/core';
import { stats } from '@proseline-editor/core/features';

const editor = createEditor({ element: document.querySelector('#editor')!, features: [stats()] });
editor.feature('stats')?.subscribe(() => console.log(editor.feature('stats')?.getState().words));
```

## Support

| | |
|---|---|
| Browsers | Evergreen browsers: CI runs the browser suite in Chromium, Firefox and WebKit (Safari's engine) |
| Desktop | Electron (the example's tests run inside Electron) |
| Server | Node ≥ 20 for `@proseline-editor/export` and `@proseline-editor/sync/server` |
| Frameworks | React 18 / 19, Vue ≥ 3.4 |

Proseline is 0.x: the API may change in minor versions until 1.0, and every change is listed in the changelog. The
public API is exactly what [`api/`](api) lists (generated from the built type declarations and checked in CI).
Anything else is internal.

## Examples

| Example | Shows |
|---|---|
| [`react-basic`](examples/react-basic), [`vue-basic`](examples/vue-basic) | Every feature in one page, for React and for Vue (the same browser suite runs against both) |
| [`react-collab`](examples/react-collab) | Real-time collaboration through Hocuspocus, with offline storage, comments and versions |
| [`custom-transport`](examples/custom-transport) | Collaboration through your own backend: REST for saves, Server-Sent Events for live updates |
| [`nextjs`](examples/nextjs) | Next.js App Router: a client-side editor, saving through a route handler, a server-rendered reading view, DOCX export on the server |
| [`electron`](examples/electron) | A desktop app: native File menu, open and save through IPC from a sandboxed renderer |
| [`node-export`](examples/node-export) | Export and import on a server, without a browser |

## Development

Requires Node 22.12+ and pnpm 10.

```bash
pnpm install
pnpm build        # packages → dist
pnpm test         # unit tests (Vitest, happy-dom)
pnpm lint && pnpm typecheck
pnpm api:check    # public API matches api/*.api.md (pnpm api:update after an intended change)
pnpm size         # bundle-size budgets
pnpm e2e          # Playwright: react-basic and vue-basic (one shared suite; Chromium, Firefox, WebKit), react-collab,
                  # custom-transport, nextjs and electron (needs a display; CI uses xvfb-run)
pnpm --filter react-basic dev   # playground (React); vue-basic for Vue
pnpm --filter react-collab sync-server & pnpm --filter react-collab dev   # collaboration playground (open two windows)
pnpm --filter node-export start # export and import on a server, without a browser
pnpm --filter custom-transport sync-server & pnpm --filter custom-transport dev   # own-backend collaboration
pnpm --filter nextjs dev        # http://localhost:4182
pnpm --filter electron-example start
pnpm docs:dev                   # documentation site with the playground, http://localhost:4183
```

See [CONTRIBUTING.md](CONTRIBUTING.md). Maintainers: [publishing setup and releases](docs/maintainers/github-and-npm.md).
