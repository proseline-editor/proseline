import { describe, it, expect } from 'vitest';
import type { CommentThread } from '@proseline-editor/core/features';
import { buildManuscript, type Inline } from './model.js';

const p = (...content: object[]) => ({ type: 'paragraph', content });
const t = (text: string, marks: string[] = []) => ({ type: 'text', text, ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}) });
const doc = (...content: object[]) => ({ type: 'doc', content });

const texts = (inlines: Inline[]) => inlines.map((i) => (i.type === 'text' ? i.text : i.type === 'break' ? '\n' : i.type === 'commentStart' ? `[${i.id}` : `${i.id}]`)).join('');

const thread = (quote: string, extra: Partial<CommentThread> = {}): CommentThread => ({
  id: quote,
  docId: 'd',
  anchor: { type: 'position', quote },
  resolved: false,
  createdAt: '2026-10-20T10:00:00Z',
  comments: [{ id: 'c1', authorId: 'u1', authorName: 'Ann', body: `About ${quote}`, createdAt: '2026-10-20T10:00:00Z' }],
  ...extra,
});

describe('buildManuscript', () => {
  it('turns headings, prose and scene breaks into blocks', async () => {
    const m = await buildManuscript({
      format: 'markdown',
      documents: [
        { title: 'Chapter One', level: 1 },
        { content: doc(p(t('First scene.')), p(t('Second paragraph.'))) },
        { content: doc(p(t('Next scene.')), { type: 'horizontalRule' }, p(t('After the break.'))) },
      ],
    });
    expect(m.blocks.map((b) => [b.kind, texts(b.inlines), b.afterBreak])).toEqual([
      ['heading', 'Chapter One', false],
      ['paragraph', 'First scene.', true],
      ['paragraph', 'Second paragraph.', false],
      ['sceneBreak', '', false],
      ['paragraph', 'Next scene.', true],
      ['sceneBreak', '', false],
      ['paragraph', 'After the break.', true],
    ]);
  });

  it('keeps marks, links, styles, alignment, flush paragraphs and hard breaks', async () => {
    const m = await buildManuscript({
      format: 'html',
      documents: [{
        content: doc(
          { type: 'paragraph', attrs: { style: 'letter', firstLineIndent: false, textAlign: 'right' }, content: [t('Dear ', ['italic']), { type: 'text', text: 'you', marks: [{ type: 'link', attrs: { href: 'https://x.test' } }] }, { type: 'hardBreak' }, t('bye', ['bold', 'strike'])] },
        ),
      }],
    });
    const [b] = m.blocks;
    expect(b).toMatchObject({ style: 'letter', firstLineIndent: false, align: 'right' });
    expect(b!.inlines).toEqual([
      expect.objectContaining({ text: 'Dear ', italic: true, bold: false }),
      expect.objectContaining({ text: 'you', link: 'https://x.test' }),
      { type: 'break' },
      expect.objectContaining({ text: 'bye', bold: true, strike: true }),
    ]);
  });

  it('resolves mentions to the current name, falling back to the stored label', async () => {
    const content = doc(p(t('Met '), { type: 'mention', attrs: { id: 'g', label: 'Ґордієві', case: 'dat' } }, t(' and '), { type: 'mention', attrs: { id: 'x', label: 'Мару' } }));
    const m = await buildManuscript({ format: 'markdown', documents: [{ content }], resolveMention: (id, c) => (id === 'g' ? `Ґордієві(${c})` : null) });
    expect(texts(m.blocks[0]!.inlines)).toBe('Met Ґордієві(dat) and Мару');
  });

  it('flattens quotes and lists', async () => {
    const li = (...content: object[]) => ({ type: 'listItem', content });
    const m = await buildManuscript({
      format: 'markdown',
      documents: [{ content: doc({ type: 'blockquote', content: [p(t('Quoted'))] }, { type: 'orderedList', attrs: { start: 3 }, content: [li(p(t('three')), p(t('more'))), li(p(t('four')), { type: 'bulletList', content: [li(p(t('nested')))] })] }) }],
    });
    expect(m.blocks.map((b) => [texts(b.inlines), b.quote, b.list])).toEqual([
      ['Quoted', 1, null],
      ['three', 0, { ordered: true, depth: 0, index: 3, first: true }],
      ['more', 0, { ordered: true, depth: 0, index: 3, first: false }],
      ['four', 0, { ordered: true, depth: 0, index: 4, first: true }],
      ['nested', 0, { ordered: false, depth: 1, index: 1, first: true }],
    ]);
  });

  it('anchors comments by position, else by quote, across paragraphs; skips resolved ones and lost text', async () => {
    const content = doc(p(t('The grey cat sat.')), p(t('It slept all day.')));
    const m = await buildManuscript({
      format: 'docx',
      documents: [{
        content,
        comments: [
          thread('grey cat', { anchor: { type: 'position', quote: 'grey cat', from: 5, to: 13 } }),
          thread('sat. It slept', { anchor: { type: 'position', quote: 'sat. It slept', from: 14, to: 28 } }),
          thread('all day', { resolved: true }),
          thread('a dog'),
          thread('slept', { comments: [
            { id: 'a', authorId: 'u1', authorName: 'Ann', body: 'Why?', createdAt: '2026-10-20T10:00:00Z' },
            { id: 'b', authorId: 'u2', body: 'Tired.', createdAt: '2026-10-20T11:00:00Z' },
          ] }),
        ],
      }],
    });
    expect(m.blocks.map((b) => texts(b.inlines))).toEqual(['The [0grey cat0] [1sat.', 'It [2slept1]2] all day.']);
    expect(m.comments).toEqual([
      { id: 0, parentId: null, author: 'Ann', date: new Date('2026-10-20T10:00:00Z'), body: 'About grey cat', resolved: false },
      { id: 1, parentId: null, author: 'Ann', date: new Date('2026-10-20T10:00:00Z'), body: 'About sat. It slept', resolved: false },
      { id: 2, parentId: null, author: 'Ann', date: new Date('2026-10-20T10:00:00Z'), body: 'Why?', resolved: false },
      { id: 3, parentId: 2, author: 'u2', date: new Date('2026-10-20T11:00:00Z'), body: 'Tired.', resolved: false },
    ]);
    expect(m.warnings).toEqual(['Comment "About a dog": its text is no longer in the document']);
  });

  it('accepts HTML (WorldForge mentions included) and reports documents that do not fit the schema', async () => {
    const m = await buildManuscript({
      format: 'markdown',
      documents: [
        { content: '<p data-indent="false">Hi <span data-mention-id="c1" data-label="Мара">Мара</span><script>x()</script></p>' },
        { content: { type: 'doc', content: [{ type: 'table' }] } },
      ],
    });
    expect(m.blocks).toHaveLength(1);
    expect(m.blocks[0]).toMatchObject({ firstLineIndent: false });
    expect(texts(m.blocks[0]!.inlines)).toBe('Hi Мара');
    expect(m.warnings[0]).toMatch(/^Skipped a document that does not match the schema/);
  });
});
