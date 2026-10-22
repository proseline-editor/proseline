import { Node, mergeAttributes } from '@tiptap/core';

/**
 * An inline reference to one of the host's entities (character, place, …). Stores only
 * `{ id, label, kind, case }`: `label` is the text at insertion, used when the entity is unknown;
 * the mentions feature renders the entity's current name in the mention's grammatical `case`.
 * HTML-compatible with WorldForge (`<span data-mention-id data-label data-kind data-case>`), and part
 * of the base schema so documents with mentions load even without the feature.
 */
export const MentionNode = Node.create({
  name: 'mention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  addAttributes() {
    const attr = (name: string, data: string) => ({
      default: null,
      parseHTML: (el: HTMLElement) => el.getAttribute(data),
      renderHTML: (attrs: Record<string, unknown>) => (attrs[name] ? { [data]: String(attrs[name]) } : {}),
    });
    return {
      id: attr('id', 'data-mention-id'),
      label: attr('label', 'data-label'),
      kind: attr('kind', 'data-kind'),
      case: attr('case', 'data-case'),
    };
  },
  parseHTML: () => [{ tag: 'span[data-mention-id]' }],
  renderHTML: ({ node, HTMLAttributes }) => ['span', mergeAttributes({ class: 'pl-mention' }, HTMLAttributes), String(node.attrs.label ?? '')],
  renderText: ({ node }) => String(node.attrs.label ?? ''),
  // ProseMirror's own plain-text API (textBetween, word counts) reads leafText; TipTap's renderText doesn't set it.
  extendNodeSchema: () => ({ leafText: (node: { attrs: Record<string, unknown> }) => String(node.attrs.label ?? '') }),
});
