import { Extension } from '@tiptap/core';
import { createEditorController, defineFeature, type Feature, type FeatureController } from '@proseline-editor/core';

export interface SceneCountState {
  /** Scene breaks + 1. */
  scenes: number;
}

export interface SceneCountCommands {
  /** Inserts a scene break at the caret. */
  insertBreak(): boolean;
}

export type SceneCountController = FeatureController<SceneCountState, SceneCountCommands>;

// Registers the controller type, so `editor.feature('sceneCount')` and `useController('sceneCount')` are typed.
declare module '@proseline-editor/core' {
  interface FeatureRegistry {
    sceneCount: SceneCountController;
  }
}

/** Counts the scenes of the document and adds Mod-Shift-Enter for a new scene. */
export const sceneCount = (): Feature<'sceneCount', SceneCountController> =>
  defineFeature({
    name: 'sceneCount',
    messages: {
      en: { 'sceneCount.label': '{count} scenes' },
      uk: { 'sceneCount.label': 'Сцен: {count}' },
    },
    extensions: [
      Extension.create({
        name: 'sceneCountKeys',
        addKeyboardShortcuts() {
          return { 'Mod-Shift-Enter': () => this.editor.commands.setHorizontalRule() };
        },
      }),
    ],
    controller: ({ editor }) => {
      const count = () => {
        let breaks = 0;
        editor.state.doc.descendants((node) => {
          if (node.type.name === 'horizontalRule') breaks++;
        });
        return breaks + 1;
      };
      // Recomputed after every transaction; subscribers hear only real changes.
      return createEditorController(editor, () => ({ scenes: count() }), { insertBreak: () => editor.commands.setHorizontalRule() });
    },
  });
