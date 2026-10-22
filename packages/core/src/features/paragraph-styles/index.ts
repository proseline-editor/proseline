import type { Editor } from '@tiptap/core';
import { defineFeature, createEditorController, type Feature, type FeatureController } from '../../feature.js';
import type { ParagraphStyleName } from '../../schema/paragraph.js';

export interface ParagraphStylesState {
  /** Style shared by all selected paragraphs; null when mixed or when the selection has none. */
  style: ParagraphStyleName | null;
  /** True when every selected paragraph has no first-line indent. */
  flush: boolean;
  /** False when the selection contains no paragraph (e.g. only headings). */
  available: boolean;
}

export interface ParagraphStylesCommands {
  setStyle(style: ParagraphStyleName): boolean;
  toggleFlush(): boolean;
}

export type ParagraphStylesController = FeatureController<ParagraphStylesState, ParagraphStylesCommands>;

declare module '../../index.js' {
  interface FeatureRegistry {
    paragraphStyles: ParagraphStylesController;
  }
}

const selectedParagraphs = (editor: Editor) => {
  const { from, to } = editor.state.selection;
  const found: { style: ParagraphStyleName; flush: boolean }[] = [];
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (node.type.name === 'paragraph') {
      found.push({ style: node.attrs.style as ParagraphStyleName, flush: node.attrs.firstLineIndent === false });
    }
  });
  return found;
};

const compute = (editor: Editor): ParagraphStylesState => {
  const paragraphs = selectedParagraphs(editor);
  const first = paragraphs[0];
  if (!first) return { style: null, flush: false, available: false };
  return {
    style: paragraphs.every((p) => p.style === first.style) ? first.style : null,
    flush: paragraphs.every((p) => p.flush),
    available: true,
  };
};

/**
 * Semantic paragraph styles (body, epigraph, letter, centered) and the flush toggle for the book
 * convention of an unindented opening paragraph. Styles are exported as named styles.
 */
export const paragraphStyles = (): Feature<'paragraphStyles', ParagraphStylesController> =>
  defineFeature({
    name: 'paragraphStyles',
    messages: {
      en: { 'paragraphStyles.body': 'Body', 'paragraphStyles.epigraph': 'Epigraph', 'paragraphStyles.letter': 'Letter', 'paragraphStyles.centered': 'Centered', 'paragraphStyles.flush': 'No first-line indent' },
      uk: { 'paragraphStyles.body': 'Основний', 'paragraphStyles.epigraph': 'Епіграф', 'paragraphStyles.letter': 'Лист', 'paragraphStyles.centered': 'По центру', 'paragraphStyles.flush': 'Без абзацного відступу' },
      fr: { 'paragraphStyles.body': 'Corps', 'paragraphStyles.epigraph': 'Épigraphe', 'paragraphStyles.letter': 'Lettre', 'paragraphStyles.centered': 'Centré', 'paragraphStyles.flush': 'Sans alinéa' },
    },
    controller: ({ editor }) =>
      createEditorController(editor, () => compute(editor), {
        setStyle: (style: ParagraphStyleName) => editor.chain().focus().setParagraph().updateAttributes('paragraph', { style }).run(),
        toggleFlush: () => {
          const { flush } = compute(editor);
          return editor.chain().focus().updateAttributes('paragraph', { firstLineIndent: flush }).run();
        },
      }),
  });
