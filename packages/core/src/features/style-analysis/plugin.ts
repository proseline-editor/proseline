import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DecorationSet } from '@tiptap/pm/view';

export const styleKey = new PluginKey<DecorationSet>('proselineStyleAnalysis');

/** Holds the analysis highlights; between runs they are mapped through edits. */
export const stylePlugin = (): Plugin<DecorationSet> =>
  new Plugin<DecorationSet>({
    key: styleKey,
    state: {
      init: () => DecorationSet.empty,
      apply: (tr, set) => (tr.getMeta(styleKey) as DecorationSet | undefined) ?? (tr.docChanged ? set.map(tr.mapping, tr.doc) : set),
    },
    props: { decorations: (state) => styleKey.getState(state) },
  });

/**
 * The text of a textblock with one character per position: text as is, a hard break as a newline,
 * any other inline node (a mention) as object replacement characters, so offsets map to positions.
 */
export const blockText = (node: PMNode): string => {
  let text = '';
  node.forEach((child) => {
    text += child.isText ? (child.text ?? '') : child.type.name === 'hardBreak' ? '\n' : '\uFFFC'.repeat(child.nodeSize);
  });
  return text;
};
