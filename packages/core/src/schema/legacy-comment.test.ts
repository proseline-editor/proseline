import { describe, it, expect, afterEach } from 'vitest';
import { createEditor, type ProselineEditor } from '../editor.js';
import { legacyCommentAnchors } from './legacy-comment.js';

let editor: ProselineEditor | null = null;
afterEach(() => editor?.destroy());

describe('legacy comment marks (WorldForge documents)', () => {
  it('loads and keeps them, so old documents open unchanged', () => {
    const html = '<p>Hello <span data-comment-id="c1">brave</span> world</p>';
    editor = createEditor({ content: html });
    expect(editor.getHTML()).toBe(html);
  });

  it('lists each mark as an anchor for migration, merging split runs', () => {
    editor = createEditor({ content: '<p><span data-comment-id="c1">one <strong>two</strong></span> three <span data-comment-id="c2">four</span></p>' });
    expect(legacyCommentAnchors(editor.tiptap.state.doc)).toEqual([
      { commentId: 'c1', from: 1, to: 8, quote: 'one two' },
      { commentId: 'c2', from: 15, to: 19, quote: 'four' },
    ]);
  });

  it('can be removed once migrated', () => {
    editor = createEditor({ content: '<p>Hello <span data-comment-id="c1">brave</span></p>' });
    editor.tiptap.chain().selectAll().unsetMark('comment').run();
    expect(editor.getHTML()).toBe('<p>Hello brave</p>');
  });
});
