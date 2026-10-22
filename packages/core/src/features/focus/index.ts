import { Extension, type Editor } from '@tiptap/core';
import { defineFeature, createEditorController, type Feature, type FeatureController } from '../../feature.js';
import { focusPlugin, focusPluginKey, type FocusAction, type FocusMode, type FocusPluginState } from './plugin.js';

export type { FocusMode } from './plugin.js';

export interface FocusOptions {
  mode?: FocusMode;
  typewriter?: boolean;
  distractionFree?: boolean;
}

export interface FocusState {
  mode: FocusMode;
  typewriter: boolean;
  /** UI adapters render the editor full-screen with chrome hidden while this is on. */
  distractionFree: boolean;
}

export interface FocusCommands {
  setMode(mode: FocusMode): void;
  toggleTypewriter(): void;
  toggleDistractionFree(): void;
}

export type FocusController = FeatureController<FocusState, FocusCommands>;

declare module '../../index.js' {
  interface FeatureRegistry {
    focus: FocusController;
  }
}

const pluginState = (editor: Editor): FocusPluginState => focusPluginKey.getState(editor.state) as FocusPluginState;

const set = (editor: Editor, action: FocusAction): void => {
  editor.view.dispatch(editor.state.tr.setMeta(focusPluginKey, action).setMeta('addToHistory', false));
};

/** Paragraph/sentence focus (dims the rest), typewriter scrolling and a distraction-free flag. */
export const focus = (options: FocusOptions = {}): Feature<'focus', FocusController> =>
  defineFeature({
    name: 'focus',
    extensions: [
      Extension.create({
        name: 'proselineFocus',
        addProseMirrorPlugins: () => [
          focusPlugin({
            mode: options.mode ?? 'off',
            typewriter: options.typewriter ?? false,
            distractionFree: options.distractionFree ?? false,
          }),
        ],
      }),
    ],
    messages: {
      en: { 'focus.off': 'No focus', 'focus.paragraph': 'Focus paragraph', 'focus.sentence': 'Focus sentence', 'focus.typewriter': 'Typewriter scrolling', 'focus.distractionFree': 'Distraction-free' },
      uk: { 'focus.off': 'Без фокусу', 'focus.paragraph': 'Фокус на абзаці', 'focus.sentence': 'Фокус на реченні', 'focus.typewriter': 'Друкарська машинка', 'focus.distractionFree': 'Без відволікань' },
      fr: { 'focus.off': 'Sans focus', 'focus.paragraph': 'Focus paragraphe', 'focus.sentence': 'Focus phrase', 'focus.typewriter': 'Défilement machine à écrire', 'focus.distractionFree': 'Sans distraction' },
    },
    controller: ({ editor }) =>
      createEditorController(
        editor,
        () => {
          const { mode, typewriter, distractionFree } = pluginState(editor);
          return { mode, typewriter, distractionFree };
        },
        {
          setMode: (mode: FocusMode) => set(editor, { mode }),
          toggleTypewriter: () => set(editor, { typewriter: !pluginState(editor).typewriter }),
          toggleDistractionFree: () => set(editor, { distractionFree: !pluginState(editor).distractionFree }),
        },
      ),
  });
