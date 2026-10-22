import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { exportManuscript, renderDocx } from './index.js';
import { DOCUMENTS } from './test-fixtures.js';

const unzip = async (data: Uint8Array) => {
  const zip = await JSZip.loadAsync(data);
  const read = (name: string) => zip.file(name)?.async('string') ?? Promise.resolve(null);
  return { names: Object.keys(zip.files), read };
};

const decode = (xml: string) => xml.replace(/&(quot|amp|lt|gt|apos);/g, (_, e: string) => ({ quot: '"', amp: '&', lt: '<', gt: '>', apos: "'" })[e]!);

/** Paragraph style ids and texts of document.xml, in order. */
const paragraphs = (xml: string) =>
  [...xml.matchAll(/<w:p>([\s\S]*?)<\/w:p>|<w:p [^>]*>([\s\S]*?)<\/w:p>/g)].map((m) => {
    const body = m[1] ?? m[2] ?? '';
    const style = /<w:pStyle w:val="([^"]+)"/.exec(body)?.[1] ?? '';
    const text = decode([...body.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((t) => t[1]).join(''));
    return `${style}|${text}`;
  });

describe('DOCX export', () => {
  it('writes named styles, headings, lists, scene breaks and resolved mentions', async () => {
    const { data, warnings } = await renderDocx({ documents: DOCUMENTS, resolveMention: () => 'Gordiy', metadata: { title: 'Salt', author: 'Ann Lee' } });
    expect(warnings).toEqual([]);
    const { read } = await unzip(data);
    const doc = (await read('word/document.xml'))!;
    expect(paragraphs(doc)).toEqual([
      'Heading1|Chapter One',
      'BodyText|Mara counted the boats in the harbour.',
      'BodyText|"Tonight," said Gordiy. *Not* a [joke]',
      'Letter|Dear brother,come home.',
      'Quote|An old saying.',
      'ListParagraph|nets',
      'ListParagraph|rope',
      'SceneBreak|* * *',
      'BodyText|Morning came.',
      'SceneBreak|* * *',
      'Centered|The End',
    ]);
    expect(doc).toContain('<w:br/>');
    expect(doc).toMatch(/<w:numPr>/);
    const styles = (await read('word/styles.xml'))!;
    for (const name of ['Body Text', 'First Paragraph', 'Epigraph', 'Letter', 'Centered', 'Scene Break', 'Quote']) expect(styles).toContain(`w:val="${name}"`);
    expect(styles).toContain('w:ascii="Times New Roman"');
    expect(styles).toMatch(/<w:pPrDefault><w:pPr><w:spacing [^>]*w:line="480"/);
  });

  it('writes the manuscript header with surname, title and page number', async () => {
    const { names, read } = await unzip((await renderDocx({ documents: DOCUMENTS, metadata: { title: 'Salt', author: 'Ann Lee' } })).data);
    const header = names.find((n) => /^word\/header\d*\.xml$/.test(n))!;
    const xml = (await read(header))!;
    expect(xml).toContain('Lee / Salt / ');
    expect(xml).toContain('PAGE');
  });

  it('starts chapters on a new page except the first; the book preset has no header and sets flush openings', async () => {
    const { names, read } = await unzip((await renderDocx({ documents: [...DOCUMENTS, { title: 'Chapter Two', level: 1 }], preset: 'book' })).data);
    const doc = (await read('word/document.xml'))!;
    expect(doc.match(/<w:pageBreakBefore\/>/g)).toHaveLength(1);
    expect(names.some((n) => /^word\/header/.test(n))).toBe(false);
    expect(paragraphs(doc)[1]).toBe('FirstParagraph|Mara counted the boats in the harbour.');
  });

  it('writes comments as Word comments with a threaded reply around the commented text', async () => {
    const { read } = await unzip((await renderDocx({ documents: DOCUMENTS })).data);
    const doc = (await read('word/document.xml'))!;
    expect(doc).toMatch(/<w:commentRangeStart w:id="0"\/><w:commentRangeStart w:id="1"\/><w:r><w:rPr><w:i\/><w:iCs\/><\/w:rPr><w:t xml:space="preserve">harbour<\/w:t><\/w:r><w:commentRangeEnd w:id="0"\/><w:commentRangeEnd w:id="1"\/>/);
    const comments = (await read('word/comments.xml'))!;
    expect(comments).toContain('w:author="Ann Lee"');
    expect(comments).toContain('w:initials="AL"');
    expect(comments).toContain('Which harbour?');
    expect(comments).toContain('North side.');
    expect(await read('word/commentsExtended.xml')).toContain('w15:paraIdParent');
  });

  it('leaves comments out on request', async () => {
    const { read } = await unzip((await renderDocx({ documents: DOCUMENTS, includeComments: false })).data);
    expect(await read('word/document.xml')).not.toContain('commentRangeStart');
  });
});

describe('exportManuscript', () => {
  it('returns a typed Blob and the file extension for each format', async () => {
    const docx = await exportManuscript({ format: 'docx', documents: DOCUMENTS });
    expect([docx.blob.type, docx.extension]).toEqual(['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx']);
    expect(new Uint8Array(await docx.blob.arrayBuffer()).slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b])); // "PK" (zip)
    const md = await exportManuscript({ format: 'markdown', documents: DOCUMENTS });
    expect([md.blob.type, md.extension, (await md.blob.text()).slice(0, 13)]).toEqual(['text/markdown;charset=utf-8', 'md', '# Chapter One']);
    const html = await exportManuscript({ format: 'html', documents: DOCUMENTS });
    expect([html.blob.type, html.extension]).toEqual(['text/html;charset=utf-8', 'html']);
  });
});
