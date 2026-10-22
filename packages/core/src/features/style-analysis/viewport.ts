import type { EditorView } from '@tiptap/pm/view';

/** Textblocks highlighted above and below the visible ones, so scrolling a little shows no gap. */
export const BLOCK_MARGIN = 40;

/**
 * Indexes of the first and last textblock to highlight: the visible ones plus a margin. Null when the
 * editor has no layout (hidden, or a test DOM) — then everything is highlighted.
 * `starts` are the textblocks' start positions, ascending.
 */
export const visibleBlocks = (view: EditorView, starts: number[]): { first: number; last: number } | null => {
  const rect = view.dom.getBoundingClientRect();
  if (!rect.height || !starts.length) return null;
  let top = 0;
  let bottom = window.innerHeight;
  for (let el = view.dom.parentElement; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      const clip = el.getBoundingClientRect();
      top = Math.max(top, clip.top);
      bottom = Math.min(bottom, clip.bottom);
      break;
    }
  }
  top = Math.max(top, rect.top);
  bottom = Math.min(bottom, rect.bottom);
  if (bottom <= top) return { first: 0, last: Math.min(starts.length - 1, BLOCK_MARGIN) };
  const left = rect.left + Math.min(40, rect.width / 2);
  const at = (y: number, fallback: number) => view.posAtCoords({ left, top: y })?.pos ?? fallback;
  const index = (pos: number) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]! <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const first = index(at(top + 1, 0));
  const last = index(at(bottom - 1, view.state.doc.content.size));
  return { first: Math.max(0, first - BLOCK_MARGIN), last: Math.min(starts.length - 1, last + BLOCK_MARGIN) };
};
