import * as Y from 'yjs';
import type { EditorState } from '@tiptap/pm/state';
import { absolutePositionToRelativePosition, relativePositionToAbsolutePosition, ySyncPluginKey, type SyncPluginState } from '@tiptap/y-tiptap';
import type { AnchorStrategy, CommentAnchor } from '@proseline-editor/core/features';

export interface YjsAnchor extends CommentAnchor {
  type: 'yjs';
  /** Relative position just after the first commented character (JSON). */
  start: unknown;
  /** Relative position just after the last commented character (JSON). */
  end: unknown;
}

const isYjsAnchor = (anchor: CommentAnchor): anchor is YjsAnchor => anchor.type === 'yjs' && !!anchor.start && !!anchor.end;

const syncState = (state: EditorState): SyncPluginState | undefined => ySyncPluginKey.getState(state) as SyncPluginState | undefined;

/** The character a relative position sticks to, or null (type-anchored or unknown). */
const itemOf = (doc: Y.Doc, position: Y.RelativePosition): Y.Item | null => {
  if (!position.item) return null;
  try {
    const struct = Y.getItem(doc.store, position.item);
    return struct instanceof Y.Item ? struct : null;
  } catch {
    return null;
  }
};

/** True when the character's whole text node was deleted — its block was re-created by a structural change. */
const inDeletedBlock = (item: Y.Item | null): boolean => !!(item?.parent instanceof Y.AbstractType && item.parent._item?.deleted);

/**
 * Comment anchors for collaborative documents: Yjs relative positions, which follow the text
 * through everyone's edits. The binding creates positions that stick to the character on their
 * left, so the start is taken just after the first commented character and the end just after the
 * last: both ends cling to commented text, and typing right before or after a comment does not
 * extend it. When a co-author's structural change re-creates the block, the anchor stops resolving
 * and the comments feature finds the text again by its quote.
 */
export const yjsAnchoring = (): AnchorStrategy => ({
  create: (state, { from, to }) => {
    const sync = syncState(state);
    const quote = state.doc.textBetween(from, to, ' ', '\uFFFC');
    if (!sync) throw new Error('yjsAnchoring needs the collaboration feature');
    const { type, binding } = sync;
    return {
      type: 'yjs',
      quote,
      start: Y.relativePositionToJSON(absolutePositionToRelativePosition(from + 1, type, binding.mapping)),
      end: Y.relativePositionToJSON(absolutePositionToRelativePosition(to, type, binding.mapping)),
    } satisfies YjsAnchor;
  },
  resolve: (state, anchor) => {
    const sync = syncState(state);
    if (!sync || !isYjsAnchor(anchor)) return null;
    const { doc, type, binding } = sync;
    const start = Y.createRelativePositionFromJSON(anchor.start);
    const end = Y.createRelativePositionFromJSON(anchor.end);
    const startItem = itemOf(doc, start);
    // A re-created block leaves the anchor pointing into deleted text: let the quote search re-anchor it.
    if (inDeletedBlock(startItem) || inDeletedBlock(itemOf(doc, end))) return null;
    const afterFirst = relativePositionToAbsolutePosition(doc, type, start, binding.mapping);
    const to = relativePositionToAbsolutePosition(doc, type, end, binding.mapping);
    if (afterFirst === null || to === null) return null;
    // A deleted first character resolves to where it was, which is already the start of what is left.
    const from = startItem && !startItem.deleted ? afterFirst - 1 : afterFirst;
    return from < to ? { from, to } : null; // all text deleted → empty → orphaned
  },
  // The binding's node mapping is current only for transactions it produced; local edits are mapped.
  isAuthoritative: (tr) => !!tr.getMeta(ySyncPluginKey),
});
