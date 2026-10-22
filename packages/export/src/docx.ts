import {
  AlignmentType,
  CommentRangeEnd,
  CommentRangeStart,
  CommentReference,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
  type ILevelsOptions,
  type INumberingOptions,
  type ParagraphChild,
} from 'docx';
import type { Block, ExportComment, Manuscript, TextRun as Run } from './model.js';
import type { ExportMetadata, ExportPreset } from './types.js';

/** Word lengths: twentieths of a point (twips) and half-points. */
const twip = (pt: number) => Math.round(pt * 20);

const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED } as const;
const HEADINGS = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 } as const;

/** Named paragraph styles, so editors can restyle the whole manuscript in Word. */
const STYLE_ID = { body: 'BodyText', flush: 'FirstParagraph', epigraph: 'Epigraph', letter: 'Letter', centered: 'Centered', sceneBreak: 'SceneBreak', quote: 'Quote', list: 'ListParagraph' } as const;

const styles = (p: ExportPreset) => {
  const spacing = { line: Math.round(p.lineSpacing * 240), after: twip(p.paragraphSpacing), before: 0 };
  const style = (id: string, name: string, paragraph: object, run: object = {}) => ({ id, name, basedOn: 'Normal', next: STYLE_ID.body, quickFormat: true, paragraph, run });
  const heading = (level: 1 | 2 | 3, size: number) => ({
    id: `Heading${level}`,
    name: `Heading ${level}`,
    basedOn: 'Normal',
    next: STYLE_ID.flush,
    quickFormat: true,
    run: { size: Math.round(size * 2), bold: false },
    paragraph: { alignment: AlignmentType.CENTER, spacing: { before: twip(24), after: twip(12) }, keepNext: true, outlineLevel: level - 1 },
  });
  return {
    default: { document: { run: { font: p.font, size: Math.round(p.fontSize * 2) }, paragraph: { spacing } } },
    paragraphStyles: [
      style(STYLE_ID.body, 'Body Text', { indent: { firstLine: twip(p.indent) }, alignment: ALIGN[p.align], spacing }),
      style(STYLE_ID.flush, 'First Paragraph', { indent: { firstLine: 0 }, alignment: ALIGN[p.align], spacing }),
      style(STYLE_ID.epigraph, 'Epigraph', { indent: { left: twip(p.indent * 6) }, spacing }, { italics: true }),
      style(STYLE_ID.letter, 'Letter', { indent: { left: twip(36), right: twip(36), firstLine: twip(p.indent) }, spacing }),
      style(STYLE_ID.centered, 'Centered', { alignment: AlignmentType.CENTER, spacing }),
      style(STYLE_ID.sceneBreak, 'Scene Break', { alignment: AlignmentType.CENTER, spacing: { ...spacing, before: twip(p.fontSize), after: twip(p.fontSize) } }),
      style(STYLE_ID.quote, 'Quote', { indent: { left: twip(36), firstLine: 0 }, spacing }),
      heading(1, p.fontSize * 1.6),
      heading(2, p.fontSize * 1.3),
      heading(3, p.fontSize * 1.1),
    ],
  };
};

const MAX_LIST_LEVEL = 3;

/** A numbering definition for one list at one nesting level (only that level is used). */
const listLevels = (ordered: boolean, start: number, depth: number): ILevelsOptions[] =>
  Array.from({ length: MAX_LIST_LEVEL + 1 }, (_, level) => ({
    level,
    format: ordered ? LevelFormat.DECIMAL : LevelFormat.BULLET,
    text: ordered ? `%${level + 1}.` : ['•', '◦', '▪', '•'][level]!,
    start: level === depth ? start : 1,
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: twip(36 * (level + 1)), hanging: twip(18) } } },
  }));

/** Only set formatting is written: an explicit "off" would override the paragraph style (e.g. Epigraph's italics). */
const textRun = (run: Run) =>
  new TextRun({
    text: run.text,
    ...(run.bold ? { bold: true } : {}),
    ...(run.italic ? { italics: true } : {}),
    ...(run.strike ? { strike: true } : {}),
    ...(run.underline ? { underline: {} } : {}),
    ...(run.code ? { font: 'Courier New' } : {}),
    ...(run.link ? { style: 'Hyperlink' } : {}),
  });

/**
 * DOCX through the `docx` package: named styles (Body Text, First Paragraph, Epigraph, Letter,
 * Centered, Scene Break, Quote, Heading 1–3), real Word lists, the preset's page setup and header,
 * and comments as Word comments with threaded replies and resolved state.
 */
export const writeDocx = async (manuscript: Manuscript, preset: ExportPreset, sceneBreak: string, metadata: ExportMetadata): Promise<Uint8Array> => {
  // A thread's replies share its range, so Word shows them in one balloon.
  const thread = new Map<number, number[]>();
  for (const c of manuscript.comments) {
    const root = c.parentId ?? c.id;
    thread.set(root, [...(thread.get(root) ?? []), c.id]);
  }

  // Numbering definitions per list group, nesting level and kind, so numbers restart with each list.
  const numbering: INumberingOptions['config'][number][] = [];
  let group = 0;
  const refs = new Map<string, string>();
  const listRef = (list: NonNullable<Block['list']>): string => {
    const depth = Math.min(MAX_LIST_LEVEL, list.depth);
    const key = `${group}:${depth}:${list.ordered}`;
    let ref = refs.get(key);
    if (!ref) {
      ref = `list${numbering.length}`;
      refs.set(key, ref);
      numbering.push({ reference: ref, levels: listLevels(list.ordered, list.index, depth) });
    }
    return ref;
  };

  const children: Paragraph[] = [];
  for (const block of manuscript.blocks) {
    if (!block.list) group++;
    const content: ParagraphChild[] = [];
    for (const inline of block.inlines) {
      if (inline.type === 'commentStart') for (const id of thread.get(inline.id) ?? []) content.push(new CommentRangeStart(id));
      else if (inline.type === 'commentEnd') {
        for (const id of thread.get(inline.id) ?? []) content.push(new CommentRangeEnd(id));
        for (const id of thread.get(inline.id) ?? []) content.push(new TextRun({ children: [new CommentReference(id)] }));
      } else if (inline.type === 'break') content.push(new TextRun({ break: 1 }));
      else if (inline.link) content.push(new ExternalHyperlink({ link: inline.link, children: [textRun(inline)] }));
      else content.push(textRun(inline));
    }

    if (block.kind === 'sceneBreak') {
      children.push(new Paragraph({ style: STYLE_ID.sceneBreak, children: [new TextRun(sceneBreak)] }));
    } else if (block.kind === 'heading') {
      const pageBreakBefore = block.level === 1 && preset.pageBreakBeforeChapters && children.length > 0;
      children.push(new Paragraph({ heading: HEADINGS[block.level ?? 1], pageBreakBefore, children: content }));
    } else {
      const flush = !block.firstLineIndent || (block.afterBreak && preset.flushAfterBreaks);
      const style = block.quote ? STYLE_ID.quote : block.style !== 'body' ? STYLE_ID[block.style] : flush ? STYLE_ID.flush : STYLE_ID.body;
      children.push(
        new Paragraph({
          style: block.list ? STYLE_ID.list : style,
          ...(block.align ? { alignment: ALIGN[block.align] } : {}),
          ...(block.list
            ? block.list.first
              ? { numbering: { reference: listRef(block.list), level: Math.min(MAX_LIST_LEVEL, block.list.depth) } }
              : { indent: { left: twip(36 * (block.list.depth + 1)) } }
            : {}),
          children: content,
        }),
      );
    }
  }

  const surname = metadata.surname ?? metadata.author?.trim().split(/\s+/).pop() ?? '';
  const header =
    preset.header === 'manuscript'
      ? new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun(`${[surname, metadata.title].filter(Boolean).join(' / ')} / `), new TextRun({ children: [PageNumber.CURRENT] })],
            }),
          ],
        })
      : undefined;

  const doc = new Document({
    creator: metadata.author ?? '',
    title: metadata.title ?? '',
    styles: styles(preset),
    numbering: { config: numbering },
    comments: { children: manuscript.comments.map(commentOptions) },
    sections: [
      {
        properties: { page: { margin: { top: twip(preset.margins), bottom: twip(preset.margins), left: twip(preset.margins), right: twip(preset.margins) } } },
        ...(header ? { headers: { default: header } } : {}),
        footers: { default: new Footer({ children: [] }) },
        children,
      },
    ],
  });
  return Packer.pack(doc, 'uint8array');
};

const commentOptions = (c: ExportComment) => ({
  id: c.id,
  author: c.author,
  initials: c.author.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 3).toUpperCase(),
  date: c.date,
  ...(c.parentId !== null ? { parentId: c.parentId } : {}),
  ...(c.resolved ? { resolved: true } : {}),
  children: c.body.split('\n').map((line) => new Paragraph(line)),
});
