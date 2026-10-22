import { describe, it, expect } from 'vitest';
import { AlignmentType, Document, ImageRun, Packer, Paragraph, TextRun } from 'docx';
import { importManuscript, joinDocuments, renderDocx, renderHtml, renderMarkdown, type ImportedDocument } from './index.js';
import { DOCUMENTS } from './test-fixtures.js';

const titles = (docs: ImportedDocument[]) => docs.map((d) => d.title);
const blocks = (docs: ImportedDocument[]) => docs.map((d) => (d.content.content ?? []).map((n) => n.type));

const docxOf = (children: Paragraph[]) => Packer.pack(new Document({ sections: [{ children }] }), 'uint8array');

describe('importManuscript', () => {
  it('parses HTML into the prose schema: unknown markup and scripts dropped, WorldForge mentions kept', async () => {
    const { documents, warnings } = await importManuscript('<h1>One</h1><p style="color:red">Hi <span data-mention-id="c1" data-label="Мара">Мара</span><script>alert(1)</script></p><img src="x.png">');
    expect(documents).toEqual([
      {
        title: null,
        level: null,
        content: {
          type: 'doc',
          content: [
            { type: 'heading', attrs: { textAlign: null, level: 1 }, content: [{ type: 'text', text: 'One' }] },
            { type: 'paragraph', attrs: { textAlign: null, firstLineIndent: true, style: 'body' }, content: [{ type: 'text', text: 'Hi ' }, { type: 'mention', attrs: { id: 'c1', label: 'Мара', kind: null, case: null } }] },
          ],
        },
      },
    ]);
    expect(warnings).toEqual(['1 image was not imported']);
  });

  it('reads Markdown, turns break marks into scene breaks and splits at chapter headings', async () => {
    const md = 'A prologue.\n\n# Chapter One\n\nIt *was* **late**.\n\n* * *\n\nNext scene.\n\n## A section\n\n⁂\n\n# Chapter Two\n\n- one\n- two\n';
    const { documents } = await importManuscript(md, { split: 'headings' });
    expect(titles(documents)).toEqual([null, 'Chapter One', 'Chapter Two']);
    expect(documents.map((d) => d.level)).toEqual([null, 1, 1]);
    expect(blocks(documents)).toEqual([['paragraph'], ['paragraph', 'horizontalRule', 'paragraph', 'heading', 'horizontalRule'], ['bulletList']]);
  });

  it('splits at scene breaks, or at headings down to a level', async () => {
    const md = 'One.\n\n***\n\nTwo.\n\n⁂\n\nThree.';
    expect((await importManuscript(md, { split: 'scene-breaks' })).documents.map((d) => d.content.content?.[0]?.content?.[0]?.text)).toEqual(['One.', 'Two.', 'Three.']);
    // Markdown already reads `***` as a break; with `sceneBreaks: false` only `⁂` stays a paragraph.
    expect((await importManuscript(md, { sceneBreaks: false })).documents[0]!.content.content?.map((n) => n.type)).toEqual(['paragraph', 'horizontalRule', 'paragraph', 'paragraph', 'paragraph']);
    const nested = '# Part\n\n## Ch 1\n\nA.\n\n## Ch 2\n\nB.';
    expect(titles((await importManuscript(nested, { split: 'headings', headingLevel: 2 })).documents)).toEqual(['Part', 'Ch 1', 'Ch 2']);
  });

  it('detects the format from the file name, type or content', async () => {
    const docx = await docxOf([new Paragraph('From Word.')]);
    const first = async (input: Parameters<typeof importManuscript>[0]) => (await importManuscript(input)).documents[0]!.content.content?.[0];
    expect(await first(docx)).toMatchObject({ type: 'paragraph', content: [{ text: 'From Word.' }] });
    expect(await first(new Blob(['# Title'], { type: 'text/plain' }))).toMatchObject({ type: 'heading' });
    expect(await first(Object.assign(new Blob(['*x*']), { name: 'notes.md' }))).toMatchObject({ type: 'paragraph', content: [{ text: 'x', marks: [{ type: 'italic' }] }] });
    expect(await first(new TextEncoder().encode('  <h2>Html</h2>'))).toMatchObject({ type: 'heading', attrs: { level: 2 } });
  });

  it('maps Word styles back, keeps unstyled centring and reports what it cannot import', async () => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    const data = await Packer.pack(
      new Document({
        styles: { paragraphStyles: [{ id: 'Fancy', name: 'Fancy', basedOn: 'Normal' }] },
        sections: [{ children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('Centred title')] }),
          new Paragraph({ style: 'Fancy', children: [new TextRun('Fancy text')] }),
          new Paragraph({ children: [new ImageRun({ type: 'png', data: png, transformation: { width: 1, height: 1 } })] }),
        ] }],
      }),
      'uint8array',
    );
    const { documents, warnings } = await importManuscript(data);
    expect(documents[0]!.content.content?.map((n) => [n.attrs?.style, n.content?.[0]?.text])).toEqual([
      ['centered', 'Centred title'],
      ['body', 'Fancy text'],
    ]);
    expect(warnings).toEqual(["Unrecognised paragraph style: 'Fancy' (Style ID: Fancy)", '1 image was not imported']);
  });
});

describe('round trips', () => {
  it('Markdown → import → Markdown is stable', async () => {
    const { text } = await renderMarkdown({ documents: DOCUMENTS });
    const { documents } = await importManuscript(text, { split: 'headings' });
    expect((await renderMarkdown({ documents: [{ content: joinDocuments(documents) }] })).text).toBe(text);
  });

  it('DOCX → import keeps headings, paragraph styles, quotes, lists and scene breaks', async () => {
    const { data } = await renderDocx({ documents: DOCUMENTS });
    const { documents, warnings } = await importManuscript(data, { split: 'headings' });
    expect(warnings).toEqual([]);
    const html = async (content: Parameters<typeof renderHtml>[0]['documents']) => (await renderHtml({ documents: content, fragment: true })).text;
    expect(await html([{ content: joinDocuments(documents) }])).toBe(await html(DOCUMENTS));
  });
});

describe('joinDocuments', () => {
  it('turns titles into headings and separates untitled documents with scene breaks', () => {
    const p = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
    expect(joinDocuments([
      { title: null, level: null, content: p('a') },
      { title: null, level: null, content: p('b') },
      { title: 'Two', level: 2, content: p('c') },
    ]).content?.map((n) => n.type + (n.attrs?.level ?? ''))).toEqual(['paragraph', 'horizontalRule', 'paragraph', 'heading2', 'paragraph']);
    expect(joinDocuments([])).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });
});
