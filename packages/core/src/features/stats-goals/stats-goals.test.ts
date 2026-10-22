import { describe, it, expect, afterEach } from 'vitest';
import { createEditor, type ProselineEditor } from '../../editor.js';
import { stats } from './index.js';
import { typeText, caretToEnd } from '../../../test/helpers.js';

let editor: ProselineEditor | null = null;
afterEach(() => editor?.destroy());

const make = (content: string, opts: Parameters<typeof stats>[0] = {}) => {
  editor = createEditor({ content, features: [stats(opts)] });
  return { e: editor, c: editor.feature('stats')! };
};

describe('stats', () => {
  it('reports words, characters, pages and reading time', () => {
    const words = Array.from({ length: 500 }, () => 'word').join(' ');
    const { c } = make(`<p>${words}</p>`, { wordsPerPage: 250, wordsPerMinute: 250 });
    expect(c.getState()).toMatchObject({
      words: 500,
      characters: 500 * 5 - 1,
      charactersNoSpaces: 2000,
      pages: 2,
      readingMinutes: 2,
      goal: null,
      goalProgress: null,
    });
  });

  it('rounds pages and reading time up and reports zero for an empty doc', () => {
    const { c } = make('<p>one two three</p>');
    expect(c.getState()).toMatchObject({ pages: 1, readingMinutes: 1 });
    const empty = make('<p></p>').c;
    expect(empty.getState()).toMatchObject({ words: 0, pages: 0, readingMinutes: 0 });
  });

  it('tracks the document goal and caps progress at 1', () => {
    const { c } = make('<p>a b c d</p>', { goal: 8 });
    expect(c.getState()).toMatchObject({ goal: 8, goalProgress: 0.5 });
    c.commands.setGoal(2);
    expect(c.getState().goalProgress).toBe(1);
    c.commands.setGoal(null);
    expect(c.getState()).toMatchObject({ goal: null, goalProgress: null });
  });

  it('counts own typed words for the session and its goal', () => {
    const { e, c } = make('<p>Start</p>', { sessionGoal: 4 });
    caretToEnd(e.tiptap);
    typeText(e.tiptap, ' one two');
    expect(c.getState()).toMatchObject({ words: 3, sessionWords: 2, sessionGoal: 4, sessionProgress: 0.5 });
    c.commands.resetSession();
    expect(c.getState().sessionWords).toBe(0);
  });

  it('does not count pasted text toward the session', () => {
    const { e, c } = make('<p>Start</p>');
    const tr = e.tiptap.state.tr.insertText(' pasted text', 6).setMeta('uiEvent', 'paste');
    e.tiptap.view.dispatch(tr);
    expect(c.getState()).toMatchObject({ words: 3, sessionWords: 0 });
  });
});
