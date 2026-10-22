import type { Inline, TextRun } from './model.js';

/** Text runs and breaks with comment markers dropped and equally formatted neighbours merged. */
export const mergedRuns = (inlines: Inline[]): (TextRun | { type: 'break' })[] => {
  const out: (TextRun | { type: 'break' })[] = [];
  for (const inline of inlines) {
    if (inline.type === 'commentStart' || inline.type === 'commentEnd') continue;
    const last = out[out.length - 1];
    if (inline.type === 'text' && last?.type === 'text' && sameFormat(last, inline)) out[out.length - 1] = { ...last, text: last.text + inline.text };
    else out.push(inline);
  }
  return out;
};

const sameFormat = (a: TextRun, b: TextRun) =>
  a.bold === b.bold && a.italic === b.italic && a.underline === b.underline && a.strike === b.strike && a.code === b.code && a.link === b.link;
