import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { sentenceRange } from './sentence.js';

export type FocusMode = 'off' | 'paragraph' | 'sentence';

export interface FocusPluginState {
  mode: FocusMode;
  typewriter: boolean;
  distractionFree: boolean;
  decorations: DecorationSet;
}

export type FocusAction = Partial<Pick<FocusPluginState, 'mode' | 'typewriter' | 'distractionFree'>>;

export const focusPluginKey = new PluginKey<FocusPluginState>('proselineFocus');

const DIM = { class: 'pl-dim' };

/** Text of a textblock with one char per position (leaves as U+FFFC), so offsets map to positions. */
const blockText = (node: PMNode): string => {
  let text = '';
  node.forEach((child) => {
    text += child.isText ? (child.text ?? '') : '\uFFFC'.repeat(child.nodeSize);
  });
  return text;
};

export const buildFocusDecorations = (state: EditorState, mode: FocusMode): DecorationSet => {
  if (mode === 'off') return DecorationSet.empty;
  const { doc, selection } = state;
  const head = selection.head;
  const decorations: Decoration[] = [];
  doc.forEach((node, offset) => {
    const end = offset + node.nodeSize;
    if (head < offset || head > end) decorations.push(Decoration.node(offset, end, DIM));
  });
  if (mode === 'sentence') {
    const $head = selection.$head;
    if ($head.parent.isTextblock) {
      const start = $head.start();
      const [from, to] = sentenceRange(blockText($head.parent), $head.parentOffset);
      if (from > 0) decorations.push(Decoration.inline(start, start + from, DIM));
      if (to < $head.parent.content.size) decorations.push(Decoration.inline(start + to, $head.end(), DIM));
    }
  }
  return DecorationSet.create(doc, decorations);
};

/** Nearest ancestor that scrolls vertically, or null for the window. */
const scrollParent = (el: HTMLElement): HTMLElement | null => {
  for (let cur = el.parentElement; cur; cur = cur.parentElement) {
    const { overflowY } = getComputedStyle(cur);
    if (overflowY === 'auto' || overflowY === 'scroll') return cur;
  }
  return null;
};

/** Scrolls so the caret's line sits at the vertical centre of whatever scrolls the editor. */
export const centerCaret = (view: EditorView): void => {
  let caret: { top: number; bottom: number };
  try {
    caret = view.coordsAtPos(view.state.selection.head);
  } catch {
    return; // no layout (detached or hidden editor)
  }
  const caretMid = (caret.top + caret.bottom) / 2;
  const container = scrollParent(view.dom);
  if (container) {
    const viewMid = container.getBoundingClientRect().top + container.clientHeight / 2;
    container.scrollBy({ top: caretMid - viewMid });
  } else {
    window.scrollBy({ top: caretMid - window.innerHeight / 2 });
  }
};

export const focusPlugin = (initial: Omit<FocusPluginState, 'decorations'>): Plugin<FocusPluginState> =>
  new Plugin<FocusPluginState>({
    key: focusPluginKey,
    state: {
      init: (_config, state) => ({ ...initial, decorations: buildFocusDecorations(state, initial.mode) }),
      apply: (tr, prev, _old, state) => {
        const action = tr.getMeta(focusPluginKey) as FocusAction | undefined;
        const next = action ? { ...prev, ...action } : prev;
        if (action?.mode !== undefined || (next.mode !== 'off' && (tr.docChanged || tr.selectionSet))) {
          return { ...next, decorations: buildFocusDecorations(state, next.mode) };
        }
        return next;
      },
    },
    props: {
      decorations: (state) => focusPluginKey.getState(state)?.decorations,
      attributes: (state): Record<string, string> => {
        const s = focusPluginKey.getState(state);
        return s && s.mode !== 'off' ? { 'data-focus': s.mode } : {};
      },
    },
    view: () => ({
      update: (view, prevState) => {
        const s = focusPluginKey.getState(view.state);
        if (!s?.typewriter || !view.hasFocus()) return;
        if (view.state.doc !== prevState.doc || !view.state.selection.eq(prevState.selection)) centerCaret(view);
      },
    }),
  });
