# Getting started

Proseline is a set of packages: a headless **core** with every feature, **React** and **Vue** components, and
optional **sync** (collaboration), **export** (DOCX, Markdown, HTML) and **lexicons** (style analysis).

## React

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

`<ProselineEditor>` creates the editor once, on mount, and provides it to the components inside. Only `editable` is
applied live; change the content later through `editor.tiptap.commands` (get the editor from `onReady`). Without
children it renders just the writing surface.

## Vue 3

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

The Vue components mirror the React ones: same names, markup, classes and accessible labels, with `@ready` and
`@change` events. Both adapters pass the same browser test suite.

## Headless

```ts
import { createEditor } from '@proseline-editor/core';
import { stats } from '@proseline-editor/core/features';

const editor = createEditor({ element: document.querySelector('#editor')!, features: [stats()] });
editor.feature('stats')?.subscribe(() => console.log(editor.feature('stats')?.getState().words));
```

## How it fits together

- **Features** are passed to the editor (`features: [...]`). Each brings its schema extensions, its UI strings and a
  **controller**: an observable store with `getState()`, `subscribe()` and `commands`.
- **Components** read controllers. In React, `useController('stats')` returns `{ state, commands }` or `null` when the
  feature is not installed; in Vue it is a computed ref. Components render nothing for missing features, so you can
  always place them.
- **Your data stays yours.** Comments, versions, mentions and synced documents go through small interfaces
  (`CommentStore`, `VersionStore`, `MentionProvider`, `SyncTransport`) that your backend implements.
- `editor.tiptap` is the underlying TipTap editor, for anything Proseline does not cover.

Next: [the features](./features), or try them all in the [playground](/playground).
