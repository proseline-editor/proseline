import { describe, it, expect, afterEach } from 'vitest';
import { createEditor, type ProselineEditor } from '../../editor.js';
import { diffDocs, diffSummary, myers, tokenize } from './diff.js';

let editors: ProselineEditor[] = [];
afterEach(() => {
  editors.forEach((e) => e.destroy());
  editors = [];
});
const doc = (html: string) => {
  const e = createEditor({ content: html });
  editors.push(e);
  return e.tiptap.state.doc;
};

describe('myers', () => {
  it('finds a shortest edit script', () => {
    expect(myers(['a', 'b', 'c'], ['a', 'x', 'c'])).toEqual(['=', '-', '+', '=']);
    expect(myers([], ['a'])).toEqual(['+']);
    expect(myers(['a'], [])).toEqual(['-']);
    expect(myers(['a', 'b'], ['a', 'b'])).toEqual(['=', '=']);
  });
});

describe('tokenize', () => {
  it('splits words (keeping apostrophes), spaces and punctuation', () => {
    expect(tokenize('Don’t go, п’ять!')).toEqual(['Don’t', ' ', 'go', ',', ' ', 'п’ять', '!']);
  });
});

describe('diffDocs', () => {
  it('marks unchanged documents as equal', () => {
    const blocks = diffDocs(doc('<p>Same text</p>'), doc('<p>Same text</p>'));
    expect(blocks).toEqual([{ status: 'equal', kind: 'paragraph', parts: [{ op: 'equal', text: 'Same text' }] }]);
  });

  it('diffs words inside a changed paragraph', () => {
    const [block] = diffDocs(doc('<p>The old grey cat sat</p>'), doc('<p>The grey cat sat quietly</p>'));
    expect(block).toEqual({
      status: 'changed',
      kind: 'paragraph',
      parts: [
        { op: 'equal', text: 'The ' },
        { op: 'delete', text: 'old ' },
        { op: 'equal', text: 'grey cat sat' },
        { op: 'insert', text: ' quietly' },
      ],
    });
  });

  it('shows a rewritten phrase as one deletion and one insertion, not interleaved words', () => {
    const [block] = diffDocs(doc('<p>It rained for three days and nights.</p>'), doc('<p>It rained for a whole week and nights.</p>'));
    expect(block!.parts).toEqual([
      { op: 'equal', text: 'It rained for ' },
      { op: 'delete', text: 'three days' },
      { op: 'insert', text: 'a whole week' },
      { op: 'equal', text: ' and nights.' },
    ]);
  });

  it('aligns paragraphs and reports added and removed ones whole', () => {
    const blocks = diffDocs(doc('<p>One</p><p>Two</p><p>Three</p>'), doc('<p>One</p><p>Three</p><p>Four</p>'));
    expect(blocks.map((b) => [b.status, b.parts.map((p) => p.text).join('')])).toEqual([
      ['equal', 'One'],
      ['deleted', 'Two'],
      ['equal', 'Three'],
      ['inserted', 'Four'],
    ]);
  });

  it('keeps block kinds, heading levels and containers', () => {
    const blocks = diffDocs(doc('<p>x</p>'), doc('<h2>Title</h2><blockquote><p>Quote</p></blockquote><hr>'));
    expect(blocks.map(({ status, kind, level, container }) => ({ status, kind, level, container }))).toEqual([
      { status: 'changed', kind: 'heading', level: 2, container: undefined },
      { status: 'inserted', kind: 'paragraph', level: undefined, container: 'blockquote' },
      { status: 'inserted', kind: 'horizontalRule', level: undefined, container: undefined },
    ]);
  });

  it('summarises inserted and deleted words', () => {
    const blocks = diffDocs(doc('<p>The old grey cat</p><p>Gone paragraph here</p>'), doc('<p>The grey cat sat down</p>'));
    expect(diffSummary(blocks)).toEqual({ insertedWords: 2, deletedWords: 4 });
  });

  it('handles a large document with a small change quickly', () => {
    const paras = Array.from({ length: 2000 }, (_, i) => `<p>Paragraph ${i} with a few words of text.</p>`);
    const before = doc(paras.join(''));
    paras[1000] = '<p>Paragraph 1000 rewritten entirely.</p>';
    const after = doc(paras.join(''));
    const started = performance.now();
    const blocks = diffDocs(before, after);
    expect(performance.now() - started).toBeLessThan(500);
    expect(blocks.filter((b) => b.status !== 'equal')).toHaveLength(1);
  });
});
