import { Extension, type Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { defineFeature, createEditorController, type Feature, type FeatureController } from '../../feature.js';
import { NO_WORD_COUNT } from '../../words.js';
import { expandReplacement, type SearchError, type SearchQuery } from './search.js';
import { findPlugin, findPluginKey, type FindAction, type FindPluginState } from './plugin.js';

export { findMatches, type Match, type SearchQuery, type SearchError } from './search.js';

export interface FindReplaceState {
  open: boolean;
  term: string;
  replacement: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  inSelection: boolean;
  total: number;
  /** 1-based position of the current match; 0 when there is none. */
  current: number;
  error: SearchError | null;
  /** False for read-only editors: search works, replace does not. */
  canReplace: boolean;
}

export interface FindReplaceCommands {
  open(): boolean;
  close(): boolean;
  setTerm(term: string): boolean;
  setReplacement(replacement: string): boolean;
  setOptions(options: Partial<Pick<SearchQuery, 'caseSensitive' | 'wholeWord' | 'regex'>>): boolean;
  /** Limits the search to the current selection (true) or the whole document (false). */
  setInSelection(on: boolean): boolean;
  next(): boolean;
  prev(): boolean;
  replace(): boolean;
  /** Replaces every match in one undoable step; returns the number of replacements. */
  replaceAll(): number;
}

export type FindReplaceController = FeatureController<FindReplaceState, FindReplaceCommands>;

declare module '../../index.js' {
  interface FeatureRegistry {
    findReplace: FindReplaceController;
  }
}

const pluginState = (editor: Editor): FindPluginState => findPluginKey.getState(editor.state) as FindPluginState;

const dispatchAction = (editor: Editor, action: FindAction): boolean => {
  editor.view.dispatch(editor.state.tr.setMeta(findPluginKey, action).setMeta('addToHistory', false));
  return true;
};

/** Selected text worth pre-filling the search with: non-empty, inside one textblock, short. */
const selectedTerm = (editor: Editor): string | undefined => {
  const { from, to, $from } = editor.state.selection;
  if (from === to || !$from.sameParent(editor.state.selection.$to)) return undefined;
  const text = editor.state.doc.textBetween(from, to);
  return text.length <= 100 ? text : undefined;
};

const goTo = (editor: Editor, step: 1 | -1): boolean => {
  const { matches, index } = pluginState(editor);
  if (!matches.length) return false;
  const next = (index + step + matches.length) % matches.length;
  const match = matches[next];
  if (!match) return false;
  const tr = editor.state.tr
    .setMeta(findPluginKey, { type: 'setIndex', index: next } satisfies FindAction)
    .setMeta('addToHistory', false)
    .setSelection(TextSelection.create(editor.state.doc, match.from, match.to))
    .scrollIntoView();
  editor.view.dispatch(tr);
  return true;
};

const replaceCurrent = (editor: Editor): boolean => {
  const { matches, index, query, replacement } = pluginState(editor);
  const match = matches[index];
  if (!editor.isEditable || !match) return false;
  const text = expandReplacement(editor.state.doc.textBetween(match.from, match.to), query, replacement);
  const tr = editor.state.tr.setMeta(NO_WORD_COUNT, true);
  if (text) tr.insertText(text, match.from, match.to);
  else tr.delete(match.from, match.to);
  // Keep the same index: the next match slides into the replaced one's slot.
  editor.view.dispatch(tr.setMeta(findPluginKey, { type: 'setIndex', index } satisfies FindAction));
  return true;
};

const replaceEvery = (editor: Editor): number => {
  const { matches, query, replacement } = pluginState(editor);
  if (!editor.isEditable || !matches.length) return 0;
  const tr = editor.state.tr.setMeta(NO_WORD_COUNT, true);
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i] as (typeof matches)[number];
    const text = expandReplacement(editor.state.doc.textBetween(m.from, m.to), query, replacement);
    if (text) tr.insertText(text, m.from, m.to);
    else tr.delete(m.from, m.to);
  }
  editor.view.dispatch(tr);
  return matches.length;
};

const compute = (editor: Editor): FindReplaceState => {
  const s = pluginState(editor);
  return {
    open: s.open,
    term: s.query.term,
    replacement: s.replacement,
    caseSensitive: s.query.caseSensitive,
    wholeWord: s.query.wholeWord,
    regex: s.query.regex,
    inSelection: s.scope !== null,
    total: s.matches.length,
    current: s.index + 1,
    error: s.error,
    canReplace: editor.isEditable,
  };
};

const FindReplaceExtension = Extension.create({
  name: 'proselineFindReplace',
  addProseMirrorPlugins: () => [findPlugin()],
  addKeyboardShortcuts() {
    return {
      'Mod-f': () => dispatchAction(this.editor, { type: 'open', term: selectedTerm(this.editor) }),
      'Mod-g': () => goTo(this.editor, 1),
      'Shift-Mod-g': () => goTo(this.editor, -1),
      Escape: () => pluginState(this.editor).open && dispatchAction(this.editor, { type: 'close' }),
    };
  },
});

/** Find & replace with case, whole-word, regex and in-selection options; Mod-F opens, Mod-G steps. */
export const findReplace = (): Feature<'findReplace', FindReplaceController> =>
  defineFeature({
    name: 'findReplace',
    extensions: [FindReplaceExtension],
    messages: {
      en: {
        'findReplace.find': 'Find', 'findReplace.replace': 'Replace', 'findReplace.replaceWith': 'Replace with',
        'findReplace.replaceAll': 'Replace all', 'findReplace.next': 'Next match', 'findReplace.prev': 'Previous match',
        'findReplace.caseSensitive': 'Match case', 'findReplace.wholeWord': 'Whole word', 'findReplace.regex': 'Regular expression',
        'findReplace.inSelection': 'In selection', 'findReplace.close': 'Close', 'findReplace.count': '{current} of {total}',
        'findReplace.none': 'No results', 'findReplace.invalidRegex': 'Invalid regular expression',
      },
      uk: {
        'findReplace.find': 'Знайти', 'findReplace.replace': 'Замінити', 'findReplace.replaceWith': 'Замінити на',
        'findReplace.replaceAll': 'Замінити все', 'findReplace.next': 'Наступний збіг', 'findReplace.prev': 'Попередній збіг',
        'findReplace.caseSensitive': 'Враховувати регістр', 'findReplace.wholeWord': 'Ціле слово', 'findReplace.regex': 'Регулярний вираз',
        'findReplace.inSelection': 'У виділенні', 'findReplace.close': 'Закрити', 'findReplace.count': '{current} з {total}',
        'findReplace.none': 'Нічого не знайдено', 'findReplace.invalidRegex': 'Некоректний регулярний вираз',
      },
      fr: {
        'findReplace.find': 'Rechercher', 'findReplace.replace': 'Remplacer', 'findReplace.replaceWith': 'Remplacer par',
        'findReplace.replaceAll': 'Tout remplacer', 'findReplace.next': 'Suivant', 'findReplace.prev': 'Précédent',
        'findReplace.caseSensitive': 'Respecter la casse', 'findReplace.wholeWord': 'Mot entier', 'findReplace.regex': 'Expression régulière',
        'findReplace.inSelection': 'Dans la sélection', 'findReplace.close': 'Fermer', 'findReplace.count': '{current} sur {total}',
        'findReplace.none': 'Aucun résultat', 'findReplace.invalidRegex': 'Expression régulière invalide',
      },
    },
    controller: ({ editor }) =>
      createEditorController(editor, () => compute(editor), {
        open: () => dispatchAction(editor, { type: 'open', term: selectedTerm(editor) }),
        close: () => dispatchAction(editor, { type: 'close' }),
        setTerm: (term: string) => dispatchAction(editor, { type: 'update', query: { term } }),
        setReplacement: (replacement: string) => dispatchAction(editor, { type: 'update', replacement }),
        setOptions: (options: Partial<Pick<SearchQuery, 'caseSensitive' | 'wholeWord' | 'regex'>>) => dispatchAction(editor, { type: 'update', query: options }),
        setInSelection: (on: boolean) => {
          const { from, to } = editor.state.selection;
          return dispatchAction(editor, { type: 'update', scope: on && from !== to ? { from, to } : null });
        },
        next: () => goTo(editor, 1),
        prev: () => goTo(editor, -1),
        replace: () => replaceCurrent(editor),
        replaceAll: () => replaceEvery(editor),
      }),
  });
