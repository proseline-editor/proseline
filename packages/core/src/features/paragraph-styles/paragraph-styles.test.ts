import { describe, it, expect, afterEach } from 'vitest';
import { createEditor, type ProselineEditor } from '../../editor.js';
import { paragraphStyles } from './index.js';

let editor: ProselineEditor | null = null;
afterEach(() => editor?.destroy());

const make = (content: string) => {
  editor = createEditor({ content, features: [paragraphStyles()] });
  return editor;
};

describe('paragraphStyles', () => {
  it('reports the style and indent of the paragraph at the caret', () => {
    const e = make('<p data-style="epigraph" data-indent="false">Epigraph</p><p>Body</p>');
    e.tiptap.commands.setTextSelection(2);
    expect(e.feature('paragraphStyles')?.getState()).toEqual({ style: 'epigraph', flush: true, available: true });
    e.tiptap.commands.setTextSelection(12);
    expect(e.feature('paragraphStyles')?.getState()).toEqual({ style: 'body', flush: false, available: true });
  });

  it('reports null style for a mixed selection and unavailable inside headings', () => {
    const e = make('<p data-style="letter">a</p><p>b</p><h2>c</h2>');
    e.tiptap.commands.setTextSelection({ from: 1, to: 5 });
    expect(e.feature('paragraphStyles')?.getState().style).toBeNull();
    e.tiptap.commands.setTextSelection(8);
    expect(e.feature('paragraphStyles')?.getState()).toEqual({ style: null, flush: false, available: false });
  });

  it('sets a style on every selected paragraph', () => {
    const e = make('<p>a</p><p>b</p>');
    e.tiptap.commands.setTextSelection({ from: 1, to: 5 });
    e.feature('paragraphStyles')?.commands.setStyle('centered');
    expect(e.getHTML()).toBe('<p data-style="centered">a</p><p data-style="centered">b</p>');
  });

  it('turns a heading back into a styled paragraph', () => {
    // (A trailing paragraph follows: StarterKit's TrailingNode keeps the end of the doc typeable.)
    const e = make('<h2>Title</h2><p>x</p>');
    e.tiptap.commands.setTextSelection(2);
    e.feature('paragraphStyles')?.commands.setStyle('epigraph');
    expect(e.getHTML()).toBe('<p data-style="epigraph">Title</p><p>x</p>');
  });

  it('toggles flush (no first-line indent)', () => {
    const e = make('<p>a</p>');
    e.tiptap.commands.setTextSelection(1);
    e.feature('paragraphStyles')?.commands.toggleFlush();
    expect(e.getHTML()).toBe('<p data-indent="false">a</p>');
    e.feature('paragraphStyles')?.commands.toggleFlush();
    expect(e.getHTML()).toBe('<p>a</p>');
  });
});
