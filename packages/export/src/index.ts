import { buildManuscript } from './model.js';
import { writeHtml } from './html.js';
import { writeMarkdown } from './markdown.js';
import { resolvePreset } from './presets.js';
import type { ExportOptions, ExportResult } from './types.js';

export { manuscriptPreset, bookPreset } from './presets.js';
export { buildManuscript, type Block, type ExportComment, type Inline, type Manuscript, type TextRun } from './model.js';
export type { ExportContent, ExportDocument, ExportFormat, ExportHeading, ExportMetadata, ExportOptions, ExportPreset, ExportResult } from './types.js';

const DEFAULT_SCENE_BREAK = '* * *';

/** Markdown text of the manuscript. */
export const renderMarkdown = async (options: Omit<ExportOptions, 'format'>): Promise<{ text: string; warnings: string[] }> => {
  const m = await buildManuscript({ ...options, format: 'markdown' });
  return { text: writeMarkdown(m, options.sceneBreak ?? DEFAULT_SCENE_BREAK), warnings: m.warnings };
};

/** HTML of the manuscript: a standalone page styled by the preset, or the body content (`fragment`). */
export const renderHtml = async (options: Omit<ExportOptions, 'format'>): Promise<{ text: string; warnings: string[] }> => {
  const m = await buildManuscript({ ...options, format: 'html' });
  return { text: writeHtml(m, resolvePreset(options.preset), options.sceneBreak ?? DEFAULT_SCENE_BREAK, options.metadata ?? {}, options.fragment ?? false), warnings: m.warnings };
};

/** DOCX bytes of the manuscript (e.g. to write to a file or send from a server). */
export const renderDocx = async (options: Omit<ExportOptions, 'format'>): Promise<{ data: Uint8Array; warnings: string[] }> => {
  const m = await buildManuscript({ ...options, format: 'docx' });
  // Loaded on demand: the docx package is large, and Markdown/HTML exports don't need it.
  const { writeDocx } = await import('./docx.js');
  return { data: await writeDocx(m, resolvePreset(options.preset), options.sceneBreak ?? DEFAULT_SCENE_BREAK, options.metadata ?? {}), warnings: m.warnings };
};

const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  markdown: 'text/markdown;charset=utf-8',
  html: 'text/html;charset=utf-8',
} as const;

/**
 * Exports a manuscript — headings and prose documents in reading order — as DOCX, Markdown or HTML.
 * Returns a Blob (download it in the browser, or `await blob.arrayBuffer()` in Node) and warnings.
 */
export const exportManuscript = async (options: ExportOptions): Promise<ExportResult> => {
  if (options.format === 'docx') {
    const { data, warnings } = await renderDocx(options);
    return { blob: new Blob([data as Uint8Array<ArrayBuffer>], { type: MIME.docx }), extension: 'docx', warnings };
  }
  const { text, warnings } = options.format === 'html' ? await renderHtml(options) : await renderMarkdown(options);
  return { blob: new Blob([text], { type: MIME[options.format] }), extension: options.format === 'html' ? 'html' : 'md', warnings };
};

export { importManuscript, joinDocuments, type ImportFormat, type ImportInput, type ImportOptions, type ImportResult, type ImportedDocument } from './import.js';
