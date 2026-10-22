import type { AnyExtension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extensions';
import { ProseParagraph } from './paragraph.js';
import { LegacyCommentMark } from './legacy-comment.js';
import { MentionNode } from './mention.js';
import { PasteCleanup } from './paste.js';

export interface ProseExtensionOptions {
  placeholder?: string;
  /** False when a collaboration extension provides undo/redo (M2). */
  history?: boolean;
}

/**
 * The prose schema: paragraphs with styles, headings 1–3, blockquote, lists, hard break,
 * horizontal rule (rendered as the scene break), inline marks, links and text alignment, plus the
 * inert legacy `comment` mark of WorldForge documents and the `mention` node, and paste clean-up for Word and Google Docs.
 * Code blocks are deliberately absent — this is a prose editor.
 */
export const proseExtensions = (opts: ProseExtensionOptions = {}): AnyExtension[] => [
  StarterKit.configure({
    paragraph: false,
    codeBlock: false,
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: true },
    undoRedo: opts.history === false ? false : {},
  }),
  ProseParagraph,
  TextAlign.configure({ types: ['paragraph', 'heading'], alignments: ['left', 'center', 'right', 'justify'] }),
  Placeholder.configure({ placeholder: opts.placeholder ?? '' }),
  LegacyCommentMark,
  MentionNode,
  PasteCleanup,
];
