import { describe, it, expect, afterEach } from 'vitest';
import { createEditor, type ProselineEditor } from '../../editor.js';
import { findReplace } from './index.js';

let editor: ProselineEditor | null = null;
afterEach(() => editor?.destroy());

const make = (content: string, editable = true) => {
  editor = createEditor({ content, editable, features: [findReplace()] });
  return { e: editor, c: editor.feature('findReplace')! };
};

describe('findReplace', () => {
  it('is closed and empty initially', () => {
    const { c } = make('<p>cat</p>');
    expect(c.getState()).toMatchObject({ open: false, term: '', total: 0, current: 0, canReplace: true });
  });

  it('opens with the selected word and highlights matches', () => {
    const { e, c } = make('<p>cat dog cat</p>');
    e.tiptap.commands.setTextSelection({ from: 1, to: 4 });
    c.commands.open();
    expect(c.getState()).toMatchObject({ open: true, term: 'cat', total: 2, current: 1 });
    expect(e.tiptap.view.dom.querySelectorAll('.pl-match')).toHaveLength(2);
    expect(e.tiptap.view.dom.querySelectorAll('.pl-match-current')).toHaveLength(1);
  });

  it('steps through matches with wrap-around and selects them', () => {
    const { e, c } = make('<p>a x a x a</p>');
    c.commands.open();
    c.commands.setTerm('a');
    expect(c.getState().current).toBe(1);
    c.commands.next();
    expect(c.getState().current).toBe(2);
    expect(e.tiptap.state.selection.from).toBe(5);
    c.commands.next();
    c.commands.next();
    expect(c.getState().current).toBe(1);
    c.commands.prev();
    expect(c.getState().current).toBe(3);
  });

  it('applies options and reports invalid regexes', () => {
    const { c } = make('<p>Cat cat</p>');
    c.commands.open();
    c.commands.setTerm('cat');
    expect(c.getState().total).toBe(2);
    c.commands.setOptions({ caseSensitive: true });
    expect(c.getState().total).toBe(1);
    c.commands.setOptions({ regex: true });
    c.commands.setTerm('(');
    expect(c.getState()).toMatchObject({ total: 0, error: 'invalidRegex' });
  });

  it('replaces the current match and moves on', () => {
    const { e, c } = make('<p>cat cat cat</p>');
    c.commands.open();
    c.commands.setTerm('cat');
    c.commands.setReplacement('dog');
    c.commands.next(); // current = 2nd "cat"
    c.commands.replace();
    expect(e.getText()).toBe('cat dog cat');
    expect(c.getState()).toMatchObject({ total: 2, current: 2 }); // the 3rd "cat" slid into slot 2
    c.commands.replace();
    expect(e.getText()).toBe('cat dog dog');
    expect(c.getState()).toMatchObject({ total: 1, current: 1 }); // wrapped to the remaining match
  });

  it('replaces all matches in a single undo step', () => {
    const { e, c } = make('<p>cat cat</p><p>cat</p>');
    c.commands.open();
    c.commands.setTerm('cat');
    c.commands.setReplacement('кіт');
    expect(c.commands.replaceAll()).toBe(3);
    expect(e.getHTML()).toBe('<p>кіт кіт</p><p>кіт</p>');
    expect(c.getState().total).toBe(0);
    e.tiptap.commands.undo();
    expect(e.getHTML()).toBe('<p>cat cat</p><p>cat</p>');
  });

  it('searches only inside the selection when asked', () => {
    const { e, c } = make('<p>cat cat cat</p>');
    e.tiptap.commands.setTextSelection({ from: 5, to: 12 });
    c.commands.open();
    c.commands.setTerm('cat');
    c.commands.setInSelection(true);
    expect(c.getState()).toMatchObject({ total: 2, inSelection: true });
  });

  it('never replaces in a read-only editor', () => {
    const { e, c } = make('<p>cat</p>', false);
    c.commands.open();
    c.commands.setTerm('cat');
    expect(c.getState()).toMatchObject({ total: 1, canReplace: false });
    expect(c.commands.replaceAll()).toBe(0);
    expect(e.getText()).toBe('cat');
  });

  it('clears highlights when closed', () => {
    const { e, c } = make('<p>cat</p>');
    c.commands.open();
    c.commands.setTerm('cat');
    c.commands.close();
    expect(c.getState()).toMatchObject({ open: false, total: 0 });
    expect(e.tiptap.view.dom.querySelectorAll('.pl-match')).toHaveLength(0);
  });

  it('rescans after edits', () => {
    const { e, c } = make('<p>cat</p>');
    c.commands.open();
    c.commands.setTerm('cat');
    e.tiptap.commands.insertContentAt(4, ' cat');
    expect(c.getState().total).toBe(2);
  });
});
