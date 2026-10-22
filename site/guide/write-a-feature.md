# Write a feature

Built-in features use the same API you do: `defineFeature({ name, extensions, messages, controller })`. This page
builds a small one that counts scenes and adds a shortcut for a new scene. The code below is a real file in the
repository, type-checked and tested.

<<< @/snippets/scene-count.ts

## The parts

- **`name`** is how components and hosts find the feature: `editor.feature('sceneCount')`.
- **`extensions`** are TipTap extensions: schema, keyboard shortcuts, ProseMirror plugins. They can also be a function
  of `{ locale }` when they depend on the language (as `typography` does).
- **`messages`** are UI strings per locale. Read them with `editor.t('sceneCount.label', { count })`; hosts can override
  any string with the editor's `messages` option. Missing locales fall back to English.
- **`controller`** receives the editor, the translator and helpers, and returns an observable store with `getState`,
  `subscribe` and `commands`. `createEditorController` recomputes the state after every transaction and only notifies
  subscribers when a value changed. Return `destroy` when you hold resources.
- The **`FeatureRegistry`** declaration gives `editor.feature('sceneCount')` and `useController('sceneCount')` their
  types.

## Using it

```tsx
import { useController } from '@proseline-editor/react';

export const SceneCount = () => {
  const scenes = useController('sceneCount');
  if (!scenes) return null; // the feature is not installed
  return <button onClick={() => scenes.commands.insertBreak()}>{scenes.state.scenes} scenes</button>;
};

<ProselineEditor features={[sceneCount(), stats()]}>
  <SceneCount />
  <ProselineContent />
</ProselineEditor>
```

In Vue, `useController('sceneCount')` returns a computed ref: read `scenes.value?.state.scenes`.

## Testing it

Features run without a UI, so a unit test needs only `createEditor`:

<<< @/snippets/scene-count.test.ts

## Tips

- Keep logic in the controller and markup in components; then the same feature works in React, Vue and headless.
- Mark transactions your feature makes on behalf of the system with `NO_WORD_COUNT` meta, so they do not count as typed
  words.
- Features that render highlights should use decorations, not marks, so the document stays clean.
