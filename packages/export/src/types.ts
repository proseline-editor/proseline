import type { AnyExtension, JSONContent } from '@tiptap/core';
import type { CommentThread } from '@proseline-editor/core/features';

/** A heading-only entry, e.g. a part or chapter title above the scenes that follow. */
export interface ExportHeading {
  title: string;
  /** 1 = part/chapter, 2–3 = lower levels. */
  level: 1 | 2 | 3;
}

/** A piece of prose (a scene, a chapter). */
export interface ExportContent {
  /**
   * ProseMirror JSON (`editor.getJSON()`, or `deriveJSON(state)` from `@proseline-editor/sync/server`
   * for a Yjs document), or HTML (needs the optional `@tiptap/html` peer; in Node also `happy-dom`).
   */
  content: JSONContent | string;
  /** Rendered as a heading above the prose (level `titleLevel`, default 3). */
  title?: string;
  titleLevel?: 1 | 2 | 3;
  /** Threads from the host's `CommentStore`; DOCX writes them as Word comments. */
  comments?: CommentThread[];
}

export type ExportDocument = ExportHeading | ExportContent;

export type ExportFormat = 'docx' | 'markdown' | 'html';

/** Page and paragraph formatting for DOCX and HTML. Lengths in points (1 inch = 72 pt). */
export interface ExportPreset {
  font: string;
  /** Points. */
  fontSize: number;
  /** Multiple of single spacing. */
  lineSpacing: number;
  /** First-line indent of body paragraphs, points. */
  indent: number;
  /** Space after each paragraph, points. */
  paragraphSpacing: number;
  align: 'left' | 'justify';
  /** Page margins, points. */
  margins: number;
  /** Page header: `manuscript` = "Surname / Title / page" at the top right. */
  header: 'manuscript' | null;
  /** Start every level-1 heading on a new page. */
  pageBreakBeforeChapters: boolean;
  /** Set the first paragraph after a heading or scene break flush (book typesetting). */
  flushAfterBreaks: boolean;
}

export interface ExportMetadata {
  title?: string;
  author?: string;
  /** Surname for the manuscript header; default: the last word of `author`. */
  surname?: string;
  /** BCP 47, e.g. `uk`. */
  language?: string;
}

export interface ExportOptions {
  format: ExportFormat;
  documents: ExportDocument[];
  /** Default `manuscript`. Ignored by Markdown. */
  preset?: 'manuscript' | 'book' | ExportPreset;
  /** Current text of a mention (its entity's name in the mention's case); default: the stored label. */
  resolveMention?: (id: string, mentionCase: string | null) => string | null | undefined;
  /** DOCX: write `comments` as Word comments (with replies). Default true. */
  includeComments?: boolean;
  /** Include resolved threads (marked resolved in Word). Default false. */
  includeResolved?: boolean;
  /** Text of a scene break (horizontal rule, and the gap between consecutive prose documents). Default `* * *`. */
  sceneBreak?: string;
  metadata?: ExportMetadata;
  /** HTML: only the body content, without `<html>`, `<head>` and styles. Default false. */
  fragment?: boolean;
  /** Schema extensions, if the editor used more than Proseline's prose schema. */
  extensions?: AnyExtension[];
}

export interface ExportResult {
  blob: Blob;
  /** Suggested file extension, without the dot. */
  extension: 'docx' | 'md' | 'html';
  /** Things that could not be exported as they are (unsupported blocks, comments whose text is gone). */
  warnings: string[];
}
