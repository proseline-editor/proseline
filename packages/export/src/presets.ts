import type { ExportPreset } from './types.js';

/** Standard submission format: Times New Roman 12, double spacing, half-inch indent, "Surname / Title / page". */
export const manuscriptPreset: ExportPreset = {
  font: 'Times New Roman',
  fontSize: 12,
  lineSpacing: 2,
  indent: 36,
  paragraphSpacing: 0,
  align: 'left',
  margins: 72,
  header: 'manuscript',
  pageBreakBeforeChapters: true,
  flushAfterBreaks: false,
};

/** A typeset-book look: Georgia 11, justified, tighter leading, no header. */
export const bookPreset: ExportPreset = {
  font: 'Georgia',
  fontSize: 11,
  lineSpacing: 1.3,
  indent: 18,
  paragraphSpacing: 0,
  align: 'justify',
  margins: 64,
  header: null,
  pageBreakBeforeChapters: true,
  flushAfterBreaks: true,
};

export const resolvePreset = (preset: 'manuscript' | 'book' | ExportPreset | undefined): ExportPreset =>
  preset === 'book' ? bookPreset : typeof preset === 'object' ? preset : manuscriptPreset;
