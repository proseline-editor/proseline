import { Mark } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';

/**
 * WorldForge stored comment anchors as a `comment` mark (`<span data-comment-id>`). Proseline keeps
 * anchors outside the document, but parses the mark so those documents load unchanged until they
 * are migrated (`legacyCommentAnchors`, then remove the marks). It has no styling or commands.
 */
export const LegacyCommentMark = Mark.create({
  name: 'comment',
  inclusive: false,
  excludes: '',
  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-comment-id'),
        renderHTML: (attrs: Record<string, unknown>) => (attrs.commentId ? { 'data-comment-id': String(attrs.commentId) } : {}),
      },
    };
  },
  parseHTML: () => [{ tag: 'span[data-comment-id]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', HTMLAttributes, 0],
});

export interface LegacyCommentAnchor {
  commentId: string;
  from: number;
  to: number;
  quote: string;
}

/** Where every legacy comment mark sits (first to last occurrence), for converting to stored anchors. */
export const legacyCommentAnchors = (doc: PMNode): LegacyCommentAnchor[] => {
  const spans = new Map<string, { from: number; to: number }>();
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (mark.type.name !== 'comment' || !mark.attrs.commentId) continue;
      const id = String(mark.attrs.commentId);
      const span = spans.get(id);
      spans.set(id, { from: span ? Math.min(span.from, pos) : pos, to: Math.max(span?.to ?? 0, pos + node.nodeSize) });
    }
  });
  return [...spans]
    .map(([commentId, { from, to }]) => ({ commentId, from, to, quote: doc.textBetween(from, to, ' ', '\uFFFC') }))
    .sort((a, b) => a.from - b.from);
};
