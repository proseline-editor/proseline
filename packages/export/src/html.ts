import type { Block, Manuscript, TextRun } from './model.js';
import type { ExportMetadata, ExportPreset } from './types.js';
import { mergedRuns } from './text.js';

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeText = (text: string) => text.replace(/[&<>]/g, (c) => ENTITIES[c]!);
const escapeAttr = (text: string) => text.replace(/[&<>"]/g, (c) => ENTITIES[c]!);

const runToHtml = (run: TextRun): string => {
  let out = escapeText(run.text);
  if (run.code) out = `<code>${out}</code>`;
  if (run.underline) out = `<u>${out}</u>`;
  if (run.strike) out = `<s>${out}</s>`;
  if (run.italic) out = `<em>${out}</em>`;
  if (run.bold) out = `<strong>${out}</strong>`;
  if (run.link) out = `<a href="${escapeAttr(run.link)}">${out}</a>`;
  return out;
};

const inlineHtml = (block: Block) =>
  mergedRuns(block.inlines)
    .map((r) => (r.type === 'break' ? '<br>' : runToHtml(r)))
    .join('');

const paragraphHtml = (block: Block, preset: ExportPreset): string => {
  const classes = [block.style !== 'body' && block.style, (!block.firstLineIndent || (block.afterBreak && preset.flushAfterBreaks)) && 'flush'].filter(Boolean);
  const attrs = (classes.length ? ` class="${classes.join(' ')}"` : '') + (block.align ? ` style="text-align: ${block.align}"` : '');
  return `<p${attrs}>${inlineHtml(block)}</p>`;
};

const css = (p: ExportPreset) => `body { margin: 0; background: #fff; color: #111; }
article { max-width: 42em; margin: ${p.margins}pt auto; padding: 0 1em; font-family: "${p.font}", serif; font-size: ${p.fontSize}pt; line-height: ${Math.round(p.lineSpacing * 115) / 100}; }
p { margin: 0 0 ${p.paragraphSpacing}pt; text-indent: ${p.indent}pt; text-align: ${p.align}; }
p.flush, li p, blockquote p { text-indent: 0; }
p.scene-break { margin: 1em 0; text-align: center; text-indent: 0; }
p.epigraph { margin-left: 40%; font-style: italic; text-indent: 0; text-align: left; }
p.letter { margin-left: 2em; margin-right: 2em; }
p.centered { text-align: center; text-indent: 0; }
h1, h2, h3 { font-weight: normal; text-align: center; margin: 2em 0 1em; }
h1 { font-size: 1.6em; }${p.pageBreakBeforeChapters ? '\nh1 { break-before: page; }\nh1:first-child { break-before: auto; }' : ''}
h2 { font-size: 1.3em; }
h3 { font-size: 1.1em; }
blockquote { margin: 0 0 0 2em; }`;

/**
 * HTML: a standalone document styled by the preset (or, with `fragment`, the body content only).
 * Quotes and lists are rebuilt as nested elements; paragraph styles become classes.
 */
export const writeHtml = (manuscript: Manuscript, preset: ExportPreset, sceneBreak: string, metadata: ExportMetadata, fragment: boolean): string => {
  const out: string[] = [];
  let quotes = 0;
  // Open lists, outermost first; `item` = an <li> is open at that level.
  const lists: { ordered: boolean; item: boolean }[] = [];
  const closeListsTo = (depth: number) => {
    while (lists.length > depth) {
      const list = lists.pop()!;
      if (list.item) out.push('</li>');
      out.push(list.ordered ? '</ol>' : '</ul>');
    }
  };

  for (const block of manuscript.blocks) {
    const quote = block.kind === 'paragraph' ? block.quote : 0;
    if (quote !== quotes) closeListsTo(0);
    for (; quotes > quote; quotes--) out.push('</blockquote>');
    for (; quotes < quote; quotes++) out.push('<blockquote>');

    const list = block.kind === 'paragraph' ? block.list : null;
    if (!list) closeListsTo(0);
    else {
      closeListsTo(list.depth + 1);
      const open = lists[list.depth];
      if (open && open.ordered !== list.ordered && list.first) closeListsTo(list.depth);
      if (!lists[list.depth]) {
        out.push(list.ordered ? `<ol${list.index !== 1 ? ` start="${list.index}"` : ''}>` : '<ul>');
        lists.push({ ordered: list.ordered, item: false });
      }
      const current = lists[list.depth]!;
      if (list.first) {
        if (current.item) out.push('</li>');
        out.push('<li>');
        current.item = true;
      }
    }

    if (block.kind === 'sceneBreak') out.push(`<p class="scene-break">${escapeText(sceneBreak)}</p>`);
    else if (block.kind === 'heading') out.push(`<h${block.level}>${inlineHtml(block)}</h${block.level}>`);
    else out.push(paragraphHtml(block, preset));
  }
  closeListsTo(0);
  for (; quotes > 0; quotes--) out.push('</blockquote>');

  const body = out.join('\n');
  if (fragment) return body + '\n';
  const lang = metadata.language ? ` lang="${escapeAttr(metadata.language)}"` : '';
  const author = metadata.author ? `\n<meta name="author" content="${escapeAttr(metadata.author)}">` : '';
  return `<!doctype html>
<html${lang}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeText(metadata.title ?? '')}</title>${author}
<style>
${css(preset)}
</style>
</head>
<body>
<article>
${body}
</article>
</body>
</html>
`;
};
