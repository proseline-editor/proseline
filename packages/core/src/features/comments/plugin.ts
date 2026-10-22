import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { findQuote } from './anchoring.js';
import type { AnchorStrategy, CommentAnchor, Range } from './types.js';

export interface ThreadRef {
  id: string;
  anchor: CommentAnchor;
  resolved: boolean;
}

export interface CommentsPluginState {
  threads: ThreadRef[];
  /** Current range per thread; null = orphaned (its text is gone). */
  ranges: Map<string, Range | null>;
  /** Threads found again by their quote, with the new anchor to persist. */
  reanchored: Map<string, CommentAnchor>;
  activeId: string | null;
  /** The selection a comment is being written for. */
  pending: Range | null;
  decorations: DecorationSet;
}

export type CommentsAction =
  | { type: 'threads'; threads: ThreadRef[] }
  | { type: 'active'; id: string | null }
  | { type: 'pending'; range: Range | null }
  | { type: 'reanchoredSaved' };

export const commentsKey = new PluginKey<CommentsPluginState>('proselineComments');

/** While editing, a lost anchor is only looked for near where it was (avoids latching onto a repeat far away). */
const NEARBY = 200;

const resolveOne = (
  state: EditorState,
  strategy: AnchorStrategy,
  thread: ThreadRef,
  last: Range | null | undefined,
  reanchored: Map<string, CommentAnchor>,
): Range | null => {
  const range = strategy.resolve(state, thread.anchor);
  if (range && range.from < range.to) return range;
  const near = last?.from ?? (typeof thread.anchor.from === 'number' ? thread.anchor.from : 0);
  const found = findQuote(state.doc, thread.anchor.quote, near);
  if (!found) return null;
  if (last && Math.abs(found.from - last.from) > Math.max(NEARBY, thread.anchor.quote.length * 4)) return null;
  reanchored.set(thread.id, strategy.create(state, found));
  return found;
};

const decorate = (doc: PMNode, s: Omit<CommentsPluginState, 'decorations'>): DecorationSet => {
  const decorations: Decoration[] = [];
  for (const thread of s.threads) {
    const range = s.ranges.get(thread.id);
    if (!range) continue;
    const classes = ['pl-comment'];
    if (thread.resolved) classes.push('pl-comment--resolved');
    if (thread.id === s.activeId) classes.push('pl-comment--active');
    decorations.push(Decoration.inline(range.from, range.to, { class: classes.join(' '), 'data-thread-id': thread.id }));
  }
  if (s.pending && s.pending.from < s.pending.to) decorations.push(Decoration.inline(s.pending.from, s.pending.to, { class: 'pl-comment pl-comment--pending' }));
  return DecorationSet.create(doc, decorations);
};

const mapRange = (tr: Transaction, range: Range | null | undefined): Range | null => {
  if (!range) return null;
  const from = tr.mapping.map(range.from, 1);
  const to = tr.mapping.map(range.to, -1);
  return from < to ? { from, to } : null;
};

export const commentsPlugin = (strategy: AnchorStrategy): Plugin<CommentsPluginState> =>
  new Plugin<CommentsPluginState>({
    key: commentsKey,
    state: {
      init: (_config, state) => {
        const base = { threads: [], ranges: new Map(), reanchored: new Map(), activeId: null, pending: null };
        return { ...base, decorations: decorate(state.doc, base) };
      },
      apply: (tr, prev, _old, state) => {
        const action = tr.getMeta(commentsKey) as CommentsAction | undefined;
        let next: Omit<CommentsPluginState, 'decorations'> = prev;
        if (action?.type === 'threads' || (tr.docChanged && strategy.isAuthoritative?.(tr))) {
          const threads = action?.type === 'threads' ? action.threads : prev.threads;
          const reanchored = new Map(prev.reanchored);
          const ranges = new Map<string, Range | null>();
          for (const t of threads) ranges.set(t.id, resolveOne(state, strategy, t, prev.ranges.get(t.id), reanchored));
          next = { ...prev, threads, ranges, reanchored, pending: tr.docChanged ? mapRange(tr, prev.pending) : prev.pending };
        } else if (tr.docChanged) {
          const ranges = new Map<string, Range | null>();
          prev.ranges.forEach((range, id) => ranges.set(id, mapRange(tr, range)));
          next = { ...prev, ranges, pending: mapRange(tr, prev.pending) };
        }
        if (action?.type === 'active') next = { ...next, activeId: action.id };
        if (action?.type === 'pending') next = { ...next, pending: action.range };
        if (action?.type === 'reanchoredSaved') next = { ...next, reanchored: new Map() };
        if (next === prev) return prev;
        return { ...next, decorations: decorate(state.doc, next) };
      },
    },
    props: {
      decorations: (state) => commentsKey.getState(state)?.decorations,
      // A click in commented text activates its thread (the innermost one); elsewhere it clears.
      handleClick: (view, pos) => {
        const s = commentsKey.getState(view.state);
        if (!s) return false;
        let id: string | null = null;
        let size = Infinity;
        for (const [threadId, range] of s.ranges) {
          if (range && pos >= range.from && pos <= range.to && range.to - range.from < size) {
            id = threadId;
            size = range.to - range.from;
          }
        }
        if (id !== s.activeId) view.dispatch(view.state.tr.setMeta(commentsKey, { type: 'active', id } satisfies CommentsAction).setMeta('addToHistory', false));
        return false; // still place the caret
      },
    },
  });
