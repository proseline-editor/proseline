import { describe, it, expect, afterEach } from 'vitest';
import { createEditor, type ProselineEditor } from '../../editor.js';
import { findQuote, positionAnchoring } from './anchoring.js';

let editor: ProselineEditor | null = null;
afterEach(() => editor?.destroy());
const make = (html: string) => (editor = createEditor({ content: html }));

describe('findQuote', () => {
  it('finds the occurrence nearest to a position', () => {
    const e = make('<p>the cat and the dog</p><p>the end</p>');
    expect(findQuote(e.tiptap.state.doc, 'the', 1)).toEqual({ from: 1, to: 4 });
    expect(findQuote(e.tiptap.state.doc, 'the', 12)).toEqual({ from: 13, to: 16 });
    expect(findQuote(e.tiptap.state.doc, 'the', 22)).toEqual({ from: 22, to: 25 }); // second paragraph's content starts at 22
  });

  it('returns null for a missing or empty quote', () => {
    const e = make('<p>text</p>');
    expect(findQuote(e.tiptap.state.doc, 'nope', 1)).toBeNull();
    expect(findQuote(e.tiptap.state.doc, '', 1)).toBeNull();
  });
});

describe('positionAnchoring', () => {
  it('creates an anchor with the quoted text and resolves it while the text is still there', () => {
    const e = make('<p>Hello brave world</p>');
    const anchoring = positionAnchoring();
    const anchor = anchoring.create(e.tiptap.state, { from: 7, to: 12 });
    expect(anchor).toEqual({ type: 'position', from: 7, to: 12, quote: 'brave' });
    expect(anchoring.resolve(e.tiptap.state, anchor)).toEqual({ from: 7, to: 12 });
  });

  it('does not resolve stale positions (the quote search takes over)', () => {
    const e = make('<p>Intro. Hello brave world</p>');
    const anchoring = positionAnchoring();
    expect(anchoring.resolve(e.tiptap.state, { type: 'position', from: 7, to: 12, quote: 'brave' })).toBeNull();
    expect(anchoring.resolve(e.tiptap.state, { type: 'yjs', quote: 'brave' })).toBeNull();
  });
});
