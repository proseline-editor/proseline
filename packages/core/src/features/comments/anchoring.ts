import type { Node as PMNode } from '@tiptap/pm/model';
import type { AnchorStrategy, CommentAnchor, Range } from './types.js';

/** Inline leaves (hard breaks, mentions) occupy one position, like in find & replace. */
const LEAF = '\uFFFC';

/** Every textblock flattened with one char per position, plus its start position. */
const textblocks = (doc: PMNode): { text: string; start: number }[] => {
  const blocks: { text: string; start: number }[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    node.forEach((child) => {
      text += child.isText ? (child.text ?? '') : LEAF.repeat(child.nodeSize);
    });
    blocks.push({ text, start: pos + 1 });
    return false;
  });
  return blocks;
};

/**
 * The occurrence of `quote` closest to `near` (within one textblock), or null. Used to find a
 * thread's place again when its anchor no longer resolves.
 */
export const findQuote = (doc: PMNode, quote: string, near: number): Range | null => {
  if (!quote) return null;
  let best: Range | null = null;
  for (const { text, start } of textblocks(doc)) {
    for (let i = text.indexOf(quote); i !== -1; i = text.indexOf(quote, i + 1)) {
      const from = start + i;
      if (!best || Math.abs(from - near) < Math.abs(best.from - near)) best = { from, to: from + quote.length };
    }
  }
  return best;
};

export interface PositionAnchor extends CommentAnchor {
  type: 'position';
  from: number;
  to: number;
}

const isPositionAnchor = (anchor: CommentAnchor): anchor is PositionAnchor =>
  anchor.type === 'position' && typeof anchor.from === 'number' && typeof anchor.to === 'number';

/**
 * Single-user anchoring: document positions plus the quote. Positions are mapped through edits and
 * persisted (`persistsPositions`); when stored positions no longer hold the quote (the document was
 * saved without them), the nearest occurrence of the quote is used.
 */
export const positionAnchoring = (): AnchorStrategy => ({
  persistsPositions: true,
  create: (state, { from, to }) => ({ type: 'position', from, to, quote: state.doc.textBetween(from, to, ' ', LEAF) }),
  resolve: (state, anchor) => {
    if (!isPositionAnchor(anchor)) return null;
    const size = state.doc.content.size;
    if (anchor.from >= 0 && anchor.to <= size && anchor.from < anchor.to && state.doc.textBetween(anchor.from, anchor.to, ' ', LEAF) === anchor.quote) {
      return { from: anchor.from, to: anchor.to };
    }
    return null;
  },
});
