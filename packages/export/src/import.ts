import type { AnyExtension, JSONContent } from '@tiptap/core';
import { isBreakMark, proseExtensions } from '@proseline-editor/core';

export type ImportFormat = 'docx' | 'markdown' | 'html';

export interface ImportOptions {
  /** Default: from the file name or type, else DOCX for a zip, HTML for text starting with `<`, else Markdown. */
  format?: ImportFormat;
  /**
   * `headings`: a new document at every heading of level ≤ `headingLevel`, titled by it;
   * `scene-breaks`: a new document at every scene break; `none` (default): one document.
   */
  split?: 'none' | 'headings' | 'scene-breaks';
  /** For `split: 'headings'`. Default 1. */
  headingLevel?: 1 | 2 | 3;
  /** Turn paragraphs that only hold a break mark (`***`, `* * *`, `#`, `⁂`…) into scene breaks. Default true. */
  sceneBreaks?: boolean;
  /** Schema extensions, if the editor uses more than Proseline's prose schema. */
  extensions?: AnyExtension[];
}

export interface ImportedDocument {
  /** The heading the document was split at, or null. */
  title: string | null;
  level: 1 | 2 | 3 | null;
  /** ProseMirror JSON of the prose schema. */
  content: JSONContent;
}

export interface ImportResult {
  documents: ImportedDocument[];
  /** What could not be imported as it was (unknown Word styles, images, tables…). */
  warnings: string[];
}

export type ImportInput = Blob | ArrayBuffer | Uint8Array | string;

/** Word styles (ours on export, plus common built-in ones) → HTML that the prose schema reads. */
const STYLE_MAP = [
  "p[style-name='Body Text'] => p:fresh",
  "p[style-name='Normal'] => p:fresh",
  "p[style-name='First Paragraph'] => p.flush:fresh",
  "p[style-name='Epigraph'] => p.epigraph:fresh",
  "p[style-name='Letter'] => p.letter:fresh",
  "p[style-name='Centered'] => p.centered:fresh",
  "p[style-name='Scene Break'] => p.scene-break:fresh",
  "p[style-name='Quote'] => blockquote > p:fresh",
  "p[style-name='Intense Quote'] => blockquote > p:fresh",
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
];

/** The class names written by STYLE_MAP, as the schema's attributes. */
const fromStyleClasses = (html: string) =>
  html
    .replace(/<p class="scene-break">[\s\S]*?<\/p>/g, '<hr>')
    .replace(/<p class="flush">/g, '<p data-indent="false">')
    .replace(/<p class="(epigraph|letter|centered)">/g, '<p data-style="$1">');

type MammothElement = { type?: string; alignment?: string | null; styleId?: string | null; styleName?: string | null; children?: MammothElement[] };

/** Unstyled centred paragraphs (e.g. typed "Chapter One" or "* * *") keep their centring as the Centered style. */
const centredAsStyle = (element: MammothElement): MammothElement => {
  const children = element.children?.map(centredAsStyle);
  const next = children ? { ...element, children } : element;
  if (next.type === 'paragraph' && next.alignment === 'center' && (!next.styleName || next.styleName === 'Normal')) return { ...next, styleId: 'Centered', styleName: 'Centered' };
  return next;
};

const bytesOf = async (input: ImportInput): Promise<Uint8Array | string> => {
  if (typeof input === 'string') return input;
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return new Uint8Array(await input.arrayBuffer());
};

const detect = (input: ImportInput, data: Uint8Array | string): ImportFormat => {
  const name = typeof Blob !== 'undefined' && input instanceof Blob ? ((input as Blob & { name?: string }).name ?? '').toLowerCase() : '';
  const type = typeof Blob !== 'undefined' && input instanceof Blob ? input.type : '';
  if (name.endsWith('.docx') || type.includes('wordprocessingml')) return 'docx';
  if (/\.(md|markdown)$/.test(name) || type.includes('markdown')) return 'markdown';
  if (/\.html?$/.test(name) || type.includes('html')) return 'html';
  if (typeof data !== 'string' && data[0] === 0x50 && data[1] === 0x4b) return 'docx'; // "PK": a zip
  const text = typeof data === 'string' ? data : new TextDecoder().decode(data.subarray(0, 512));
  return text.trimStart().startsWith('<') ? 'html' : 'markdown';
};

const docxToHtml = async (data: Uint8Array, warnings: string[]): Promise<string> => {
  const mammoth = (await import('mammoth')).default;
  let images = 0;
  const result = await mammoth.convertToHtml(
    // Node's build reads `buffer`, the browser build `arrayBuffer`.
    { buffer: data, arrayBuffer: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) } as unknown as Parameters<typeof mammoth.convertToHtml>[0],
    {
      styleMap: STYLE_MAP,
      transformDocument: centredAsStyle,
      convertImage: mammoth.images.imgElement(async () => {
        images++;
        return { src: '' };
      }),
    },
  );
  for (const m of result.messages) if (!warnings.includes(m.message)) warnings.push(m.message);
  if (images) warnings.push(`${images} image${images === 1 ? ' was' : 's were'} not imported`);
  // Images are not part of the prose schema: drop them, and paragraphs that only held one.
  return fromStyleClasses(result.value.replace(/<img [^>]*>/g, '').replace(/<p><\/p>/g, ''));
};

const textOf = (node: JSONContent): string => (node.text ?? '') + (node.content ?? []).map(textOf).join('');

/** A paragraph holding only a break mark becomes a horizontal rule (the schema's scene break). */
const normalizeSceneBreaks = (doc: JSONContent): JSONContent => ({
  ...doc,
  content: (doc.content ?? []).map((node) => (node.type === 'paragraph' && isBreakMark(textOf(node)) ? { type: 'horizontalRule' } : node)),
});

const isEmpty = (content: JSONContent[]) => content.every((n) => n.type === 'paragraph' && !textOf(n).trim());

const split = (doc: JSONContent, options: ImportOptions): ImportedDocument[] => {
  const nodes = doc.content ?? [];
  const mode = options.split ?? 'none';
  if (mode === 'none') return [{ title: null, level: null, content: doc }];
  const out: ImportedDocument[] = [];
  let current: ImportedDocument = { title: null, level: null, content: { type: 'doc', content: [] } };
  const flush = () => {
    const content = current.content.content!;
    if (current.title !== null || !isEmpty(content)) {
      if (!content.length) content.push({ type: 'paragraph' });
      out.push(current);
    }
  };
  for (const node of nodes) {
    const level = Number(node.attrs?.level);
    const at = mode === 'headings' ? node.type === 'heading' && level <= (options.headingLevel ?? 1) : node.type === 'horizontalRule';
    if (!at) {
      current.content.content!.push(node);
      continue;
    }
    flush();
    current = mode === 'headings'
      ? { title: textOf(node).trim(), level: level as 1 | 2 | 3, content: { type: 'doc', content: [] } }
      : { title: null, level: null, content: { type: 'doc', content: [] } };
  }
  flush();
  return out;
};

/**
 * Imports a DOCX, Markdown or HTML manuscript as prose: everything is parsed into the prose schema
 * (so unknown formatting, scripts and styles are dropped), break marks become scene breaks, and the
 * result can be split into documents at headings or scene breaks. Recognizing characters, places
 * and the like stays with the host.
 */
export const importManuscript = async (input: ImportInput, options: ImportOptions = {}): Promise<ImportResult> => {
  const warnings: string[] = [];
  const data = await bytesOf(input);
  const format = options.format ?? detect(input, data);
  const text = () => (typeof data === 'string' ? data : new TextDecoder().decode(data));
  let html: string;
  if (format === 'docx') {
    if (typeof data === 'string') throw new TypeError('A DOCX file must be given as bytes (Blob, ArrayBuffer or Uint8Array)');
    html = await docxToHtml(data, warnings);
  } else if (format === 'markdown') {
    const { marked } = await import('marked');
    html = await marked.parse(text(), { gfm: true });
  } else {
    html = text();
  }
  const tables = (html.match(/<table[\s>]/g) ?? []).length;
  if (tables) warnings.push(`${tables} table${tables === 1 ? ' was' : 's were'} imported as plain paragraphs`);
  if (format !== 'docx') {
    const images = (html.match(/<img[\s>]/g) ?? []).length;
    if (images) warnings.push(`${images} image${images === 1 ? ' was' : 's were'} not imported`);
  }
  const { generateJSON } = await import('@tiptap/html');
  let doc = generateJSON(html.trim() ? html : '<p></p>', options.extensions ?? proseExtensions());
  if (options.sceneBreaks !== false) doc = normalizeSceneBreaks(doc);
  return { documents: split(doc, options), warnings };
};

/**
 * One editor document from imported documents: titles become headings of their level, and
 * consecutive untitled documents are separated by scene breaks (the inverse of `split`).
 */
export const joinDocuments = (documents: ImportedDocument[]): JSONContent => {
  const content: JSONContent[] = [];
  documents.forEach((d, i) => {
    if (d.title !== null) content.push({ type: 'heading', attrs: { level: d.level ?? 1 }, content: d.title ? [{ type: 'text', text: d.title }] : [] });
    else if (i > 0) content.push({ type: 'horizontalRule' });
    content.push(...(d.content.content ?? []));
  });
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
};
