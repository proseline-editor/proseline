import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { findMatches, buildPattern, type Match, type SearchError, type SearchQuery } from './search.js';

export interface FindPluginState {
  open: boolean;
  query: SearchQuery;
  replacement: string;
  /** Range searched when "in selection" is on, mapped through edits. */
  scope: Match | null;
  matches: Match[];
  /** Index of the current match, -1 when there is none. */
  index: number;
  error: SearchError | null;
  decorations: DecorationSet;
}

export type FindAction =
  | { type: 'open'; term?: string }
  | { type: 'close' }
  | { type: 'update'; query?: Partial<SearchQuery>; replacement?: string; scope?: Match | null }
  | { type: 'setIndex'; index: number };

export const findPluginKey = new PluginKey<FindPluginState>('proselineFindReplace');

export const EMPTY_QUERY: SearchQuery = { term: '', caseSensitive: false, wholeWord: false, regex: false };

const initial: FindPluginState = {
  open: false,
  query: EMPTY_QUERY,
  replacement: '',
  scope: null,
  matches: [],
  index: -1,
  error: null,
  decorations: DecorationSet.empty,
};

const decorate = (state: EditorState, matches: Match[], index: number): DecorationSet =>
  DecorationSet.create(
    state.doc,
    matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === index ? 'pl-match pl-match-current' : 'pl-match' })),
  );

/** First match at or after `pos`, wrapping to the first one. */
const indexFrom = (matches: Match[], pos: number): number => {
  if (!matches.length) return -1;
  const i = matches.findIndex((m) => m.from >= pos);
  return i === -1 ? 0 : i;
};

const search = (state: EditorState, next: Omit<FindPluginState, 'matches' | 'error' | 'decorations'>, anchor: number): FindPluginState => {
  if (!next.open) return { ...initial, query: next.query, replacement: next.replacement };
  const { error } = buildPattern(next.query);
  const matches = findMatches(state.doc, next.query, next.scope ?? undefined);
  const index = next.index >= 0 && next.index < matches.length ? next.index : indexFrom(matches, anchor);
  return { ...next, matches, index, error, decorations: decorate(state, matches, index) };
};

// ProseMirror passes (tr, value, oldState, newState); matches must come from the new document.
const apply = (tr: Transaction, prev: FindPluginState, _old: EditorState, state: EditorState): FindPluginState => {
  const action = tr.getMeta(findPluginKey) as FindAction | undefined;
  const scope = prev.scope && tr.docChanged ? { from: tr.mapping.map(prev.scope.from, -1), to: tr.mapping.map(prev.scope.to, 1) } : prev.scope;
  if (!action) {
    if (!prev.open || !tr.docChanged) return prev;
    return search(state, { ...prev, scope }, state.selection.from);
  }
  switch (action.type) {
    case 'open':
      return search(state, { ...prev, open: true, query: { ...prev.query, term: action.term ?? prev.query.term }, index: -1 }, state.selection.from);
    case 'close':
      return search(state, { ...prev, open: false, scope: null, index: -1 }, 0);
    case 'update':
      return search(
        state,
        {
          ...prev,
          query: { ...prev.query, ...action.query },
          replacement: action.replacement ?? prev.replacement,
          scope: action.scope === undefined ? prev.scope : action.scope,
          // Re-anchor only when what we search for changed.
          index: action.query || action.scope !== undefined ? -1 : prev.index,
        },
        action.query || action.scope !== undefined ? state.selection.from : 0,
      );
    case 'setIndex':
      // A replacement changes the document in the same transaction: rescan, keeping the slot.
      if (tr.docChanged) return search(state, { ...prev, scope, index: action.index }, state.selection.from);
      return { ...prev, index: action.index, decorations: decorate(state, prev.matches, action.index) };
  }
};

export const findPlugin = (): Plugin<FindPluginState> =>
  new Plugin<FindPluginState>({
    key: findPluginKey,
    state: { init: () => initial, apply },
    props: { decorations: (state) => findPluginKey.getState(state)?.decorations },
  });
