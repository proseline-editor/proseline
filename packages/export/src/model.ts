import { getSchema, type AnyExtension, type JSONContent } from '@tiptap/core';
import type { Node as PMNode, Schema } from '@tiptap/pm/model';
import { isParagraphStyle, proseExtensions, type ParagraphStyleName } from '@proseline-editor/core';
import { findQuote, type CommentThread } from '@proseline-editor/core/features';
import type { ExportDocument, ExportOptions } from './types.js';

export interface TextRun {
  type: 'text';
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
  link: string | null;
}

export type Inline = TextRun | { type: 'break' } | { type: 'commentStart'; id: number } | { type: 'commentEnd'; id: number };

export interface Block {
  kind: 'heading' | 'paragraph' | 'sceneBreak';
  level: 1 | 2 | 3 | null;
  style: ParagraphStyleName;
  /** The paragraph's own first-line indent setting (off = flush). */
  firstLineIndent: boolean;
  /** First paragraph after a heading or scene break (books set these flush). */
  afterBreak: boolean;
  align: 'left' | 'center' | 'right' | 'justify' | null;
  /** Blockquote nesting depth. */
  quote: number;
  /** `first`: the item's first paragraph, which carries the bullet or number. */
  list: { ordered: boolean; depth: number; index: number; first: boolean } | null;
  inlines: Inline[];
}

/** One Word comment: a thread's opening comment, or a reply (`parentId`). */
export interface ExportComment {
  id: number;
  parentId: number | null;
  author: string;
  date: Date;
  body: string;
  resolved: boolean;
}

export interface Manuscript {
  blocks: Block[];
  comments: ExportComment[];
  warnings: string[];
}

const plain = (text: string): TextRun => ({ type: 'text', text, bold: false, italic: false, underline: false, strike: false, code: false, link: null });

/** Links that are safe to write out: web, mail and in-document ones (never `javascript:`). */
const SAFE_LINK = /^(?:https?:|mailto:|#|\/)/i;

const run = (text: string, node: PMNode): TextRun => {
  const has = (mark: string) => node.marks.some((m) => m.type.name === mark);
  const link = node.marks.find((m) => m.type.name === 'link')?.attrs.href;
  return { type: 'text', text, bold: has('bold'), italic: has('italic'), underline: has('underline'), strike: has('strike'), code: has('code'), link: typeof link === 'string' && SAFE_LINK.test(link.trim()) ? link.trim() : null };
};

let defaultExtensions: AnyExtension[] | null = null;
const schemas = new WeakMap<AnyExtension[], Schema>();
const schemaOf = (extensions: AnyExtension[]): Schema => {
  let schema = schemas.get(extensions);
  if (!schema) {
    schema = getSchema(extensions);
    schemas.set(extensions, schema);
  }
  return schema;
};

const isHeading = (d: ExportDocument): d is Extract<ExportDocument, { level: number; title: string }> => !('content' in d);

const toNode = async (content: JSONContent | string, schema: Schema, extensions: AnyExtension[]): Promise<PMNode> => {
  if (typeof content !== 'string') return schema.nodeFromJSON(content);
  // Optional peer: only needed for HTML input. In Node it resolves to the server build (happy-dom).
  const { generateJSON } = await import('@tiptap/html');
  return schema.nodeFromJSON(generateJSON(content.trim() ? content : '<p></p>', extensions));
};

const blank = (kind: Block['kind'], partial: Partial<Block> = {}): Block => ({
  kind,
  level: null,
  style: 'body',
  firstLineIndent: true,
  afterBreak: false,
  align: null,
  quote: 0,
  list: null,
  inlines: [],
  ...partial,
});

/** The range of a thread in `doc`: its stored positions if they still hold the quote (as core's position anchoring writes it), else the quote searched for. */
const threadRange = (doc: PMNode, thread: CommentThread): { from: number; to: number } | null => {
  const { from, to, quote } = thread.anchor as { from?: unknown; to?: unknown; quote: string };
  if (typeof from === 'number' && typeof to === 'number' && from < to && to <= doc.content.size && doc.textBetween(from, to, ' ', '\uFFFC') === quote) return { from, to };
  // The quote search only finds text within one paragraph; positions can span several.
  return quote ? findQuote(doc, quote, typeof from === 'number' ? from : 0) : null;
};

/**
 * Flattens the documents into blocks of styled runs, the shared input of every writer: mentions
 * become text, comments become start/end markers (plus the comment list), headings and scene
 * breaks are explicit blocks.
 */
export const buildManuscript = async (options: ExportOptions): Promise<Manuscript> => {
  const extensions = options.extensions ?? (defaultExtensions ??= proseExtensions());
  const schema = schemaOf(extensions);
  const blocks: Block[] = [];
  const comments: ExportComment[] = [];
  const warnings: string[] = [];
  let nextComment = 0;
  let previousWasContent = false;

  const push = (block: Block) => {
    const last = blocks[blocks.length - 1];
    block.afterBreak = block.kind === 'paragraph' && (!last || last.kind !== 'paragraph');
    blocks.push(block);
  };

  for (const entry of options.documents) {
    if (isHeading(entry)) {
      push(blank('heading', { level: entry.level, inlines: [plain(entry.title)] }));
      previousWasContent = false;
      continue;
    }
    let doc: PMNode;
    try {
      doc = await toNode(entry.content, schema, extensions);
    } catch (error) {
      warnings.push(`Skipped a document that does not match the schema: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (entry.title) {
      push(blank('heading', { level: entry.titleLevel ?? 3, inlines: [plain(entry.title)] }));
    } else if (previousWasContent) {
      push(blank('sceneBreak'));
    }
    previousWasContent = true;

    // Comment boundaries by document position.
    const starts = new Map<number, number[]>();
    const ends = new Map<number, number[]>();
    if (options.includeComments !== false) {
      for (const thread of entry.comments ?? []) {
        if (thread.resolved && !options.includeResolved) continue;
        const range = threadRange(doc, thread);
        if (!range) {
          warnings.push(`Comment "${thread.comments[0]?.body.slice(0, 40) ?? thread.id}": its text is no longer in the document`);
          continue;
        }
        const id = nextComment;
        thread.comments.forEach((c, i) => {
          comments.push({ id: nextComment++, parentId: i === 0 ? null : id, author: c.authorName ?? c.authorId, date: new Date(c.createdAt), body: c.body, resolved: thread.resolved });
        });
        if (!thread.comments.length) continue;
        starts.set(range.from, [...(starts.get(range.from) ?? []), id]);
        ends.set(range.to, [...(ends.get(range.to) ?? []), id]);
      }
    }
    const emitted = new Set<string>();
    /** Comment markers at `pos`: ends before starts, each once (an end only after its start). */
    const markers = (pos: number, out: Inline[]) => {
      for (const id of ends.get(pos) ?? []) {
        if (emitted.has(`e${id}`) || !emitted.has(`s${id}`)) continue;
        emitted.add(`e${id}`);
        out.push({ type: 'commentEnd', id });
      }
      for (const id of starts.get(pos) ?? []) {
        if (emitted.has(`s${id}`)) continue;
        emitted.add(`s${id}`);
        out.push({ type: 'commentStart', id });
      }
    };

    const inlinesOf = (block: PMNode, start: number): Inline[] => {
      const out: Inline[] = [];
      const cuts = [...new Set([...starts.keys(), ...ends.keys()])].filter((p) => p >= start && p <= start + block.content.size).sort((a, b) => a - b);
      block.forEach((child, offset) => {
        const pos = start + offset;
        if (child.isText) {
          const text = child.text ?? '';
          let at = 0;
          for (const cut of cuts) {
            if (cut < pos || cut > pos + text.length) continue;
            if (cut - pos > at) out.push(run(text.slice(at, cut - pos), child));
            at = Math.max(at, cut - pos);
            markers(cut, out);
          }
          if (at < text.length) out.push(run(text.slice(at), child));
          return;
        }
        markers(pos, out);
        if (child.type.name === 'hardBreak') out.push({ type: 'break' });
        else if (child.type.name === 'mention') {
          const label = String(child.attrs.label ?? '');
          const name = options.resolveMention?.(String(child.attrs.id ?? ''), (child.attrs.case as string | null) ?? null) ?? label;
          out.push(run(name, child));
        } else if (child.isLeaf) {
          const text = child.type.spec.leafText?.(child);
          if (text) out.push(run(text, child));
        }
      });
      markers(start + block.content.size, out);
      return out;
    };

    const walk = (node: PMNode, pos: number, ctx: { quote: number; list: Block['list'] }) => {
      node.forEach((child, offset) => {
        const at = pos + offset;
        const name = child.type.name;
        if (child.isTextblock) {
          const align = child.attrs.textAlign as Block['align'] | undefined;
          push(
            blank(name === 'heading' ? 'heading' : 'paragraph', {
              level: name === 'heading' ? (Math.min(3, Math.max(1, Number(child.attrs.level) || 1)) as 1 | 2 | 3) : null,
              style: isParagraphStyle(child.attrs.style) ? child.attrs.style : 'body',
              firstLineIndent: child.attrs.firstLineIndent !== false,
              align: align && align !== 'left' ? align : null,
              quote: ctx.quote,
              list: ctx.list,
              inlines: inlinesOf(child, at + 1),
            }),
          );
          if (ctx.list) ctx = { ...ctx, list: { ...ctx.list, first: false } };
        } else if (name === 'horizontalRule') {
          push(blank('sceneBreak'));
        } else if (name === 'blockquote') {
          walk(child, at + 1, { ...ctx, quote: ctx.quote + 1 });
        } else if (name === 'bulletList' || name === 'orderedList') {
          const startAt = Number(child.attrs.start ?? 1) || 1;
          let index = 0;
          child.forEach((item, itemOffset) => {
            walk(item, at + 1 + itemOffset + 1, { ...ctx, list: { ordered: name === 'orderedList', depth: (ctx.list?.depth ?? -1) + 1, index: startAt + index++, first: true } });
          });
        } else if (child.childCount) {
          walk(child, at + 1, ctx);
        } else {
          warnings.push(`Skipped an unsupported "${name}" block`);
        }
      });
    };
    walk(doc, 0, { quote: 0, list: null });
  }
  return { blocks, comments, warnings };
};
