import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import { proseExtensions } from './extensions.js';

let editor: Editor | null = null;
const make = (content: string) => {
  editor = new Editor({ extensions: proseExtensions(), content });
  return editor;
};
afterEach(() => editor?.destroy());

describe('prose schema', () => {
  it('round-trips paragraph style and first-line indent (WorldForge-compatible)', () => {
    const html = '<p data-indent="false">Flush</p><p data-style="epigraph">Quote</p><p>Body</p>';
    const e = make(html);
    const [flush, epigraph, body] = e.getJSON().content ?? [];
    expect(flush?.attrs).toMatchObject({ firstLineIndent: false, style: 'body' });
    expect(epigraph?.attrs).toMatchObject({ firstLineIndent: true, style: 'epigraph' });
    expect(body?.attrs).toMatchObject({ firstLineIndent: true, style: 'body' });
    expect(e.getHTML()).toBe(html);
  });

  it('ignores unknown paragraph styles', () => {
    const e = make('<p data-style="nonsense">x</p>');
    expect(e.getJSON().content?.[0]?.attrs?.style).toBe('body');
  });

  it('keeps headings 1–3, scene breaks, lists, quotes and inline marks', () => {
    const html =
      '<h1>T</h1><h3>S</h3><hr><blockquote><p>q</p></blockquote><ul><li><p>a</p></li></ul>' +
      '<p><strong>b</strong><em>i</em><u>u</u><s>s</s><code>c</code></p>';
    expect(make(html).getHTML()).toBe(html);
  });

  it('downgrades h4 and drops code blocks to plain paragraphs', () => {
    const e = make('<h4>Deep</h4><pre><code>x</code></pre>');
    const types = e.getJSON().content?.map((n) => n.type);
    expect(types).toEqual(['paragraph', 'paragraph']);
  });

  it('supports text alignment on paragraphs and headings', () => {
    const e = make('<p style="text-align: center">c</p>');
    expect(e.getJSON().content?.[0]?.attrs?.textAlign).toBe('center');
  });
});
