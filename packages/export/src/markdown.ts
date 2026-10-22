import type { Block, Manuscript, TextRun } from './model.js';
import { mergedRuns } from './text.js';

const escapeText = (text: string) => text.replace(/([\\`*_[\]<>~|])/g, '\\$1');

/** Wraps `text` in a delimiter, keeping edge whitespace outside it (`** bold**` would not parse). */
const wrap = (text: string, open: string, close = open) => {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
  return m[2] ? `${m[1]}${open}${m[2]}${close}${m[3]}` : text;
};

const runToMarkdown = (run: TextRun): string => {
  if (run.code) return wrap(run.text, run.text.includes('`') ? '`` ' : '`', run.text.includes('`') ? ' ``' : '`');
  let out = escapeText(run.text);
  if (run.underline) out = wrap(out, '<u>', '</u>');
  if (run.strike) out = wrap(out, '~~');
  if (run.italic) out = wrap(out, '*');
  if (run.bold) out = wrap(out, '**');
  if (run.link) out = `[${out}](${run.link.replace(/[()\s]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`)})`;
  return out;
};

const inlineMarkdown = (block: Block): string =>
  mergedRuns(block.inlines)
    .map((r) => (r.type === 'break' ? '\\\n' : runToMarkdown(r)))
    .join('');

/** A paragraph starting like a heading, list item or quote would be read as one: escape it. */
const guardStart = (text: string) => text.replace(/^(#{1,6}\s|[-+*]\s|\d+[.)]\s|>)/, '\\$1');

/**
 * Markdown (CommonMark + strikethrough): headings, emphasis, links, quotes, lists, hard breaks;
 * scene breaks as their text (`* * *` is also a thematic break). Paragraph styles and alignment
 * have no Markdown form and are dropped; underline becomes `<u>`.
 */
export const writeMarkdown = (manuscript: Manuscript, sceneBreak: string): string => {
  const out: string[] = [];
  for (const block of manuscript.blocks) {
    let text: string;
    if (block.kind === 'sceneBreak') text = sceneBreak;
    else if (block.kind === 'heading') text = `${'#'.repeat(block.level ?? 1)} ${inlineMarkdown(block)}`;
    else {
      text = guardStart(inlineMarkdown(block));
      if (block.list) {
        const indent = '   '.repeat(block.list.depth);
        const marker = block.list.ordered ? `${block.list.index}. ` : '- ';
        const pad = `${indent}${' '.repeat(marker.length)}`;
        text = text
          .split('\n')
          .map((line, i) => (i === 0 && block.list!.first ? `${indent}${marker}${line}` : `${pad}${line}`))
          .join('\n');
      }
    }
    if (block.quote) text = text.split('\n').map((line) => `${'> '.repeat(block.quote)}${line}`.trimEnd()).join('\n');
    out.push(text);
  }
  return out.join('\n\n') + '\n';
};
