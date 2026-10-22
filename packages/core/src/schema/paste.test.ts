import { describe, it, expect, afterEach } from 'vitest';
import gdocs from '../../test/paste/google-docs.html?raw';
import word from '../../test/paste/word.html?raw';
import { createEditor, type ProselineEditor } from '../editor.js';
import { cleanPastedHTML, isBreakMark } from './paste.js';

let editor: ProselineEditor | null = null;
afterEach(() => editor?.destroy());

/** The document a paste of `html` produces (parsed like a paste, without the view's clipboard reader). */
const pasted = (html: string) => {
  editor = createEditor({ content: cleanPastedHTML(html) });
  return editor.getHTML();
};

describe('cleanPastedHTML', () => {
  it('reads Google Docs: formatting kept, blank lines as empty paragraphs, break marks as scene breaks', () => {
    expect(pasted(gdocs)).toBe(
      '<p>Mara counted the <strong>boats</strong> in the <em>harbour</em>.</p><p></p><hr><h2>Chapter Two</h2><ul><li><p><u>nets</u></p></li></ul>',
    );
  });

  it('reads Word: real lists, no Office markup, blank paragraphs empty, typography kept', () => {
    expect(pasted(word)).toBe(
      '<p>Mara counted the <strong>boats</strong> in the <em>harbour</em>.</p><p></p><hr><h2>Chapter Two</h2>' +
        '<ul><li><p>nets</p></li><li><p>rope</p></li></ul><ol><li><p>first</p></li><li><p>second</p></li></ol>' +
        '<p>“Go,” she said — and left.</p>',
    );
  });

  it('nests Word list levels', () => {
    const item = (level: number, marker: string, text: string) =>
      `<p class=MsoListParagraph style='mso-list:l0 level${level} lfo1'><span style='mso-list:Ignore'>${marker}<span>&nbsp;</span></span>${text}</p>`;
    expect(pasted(item(1, '1.', 'one') + item(2, 'a.', 'one-a') + item(2, 'b.', 'one-b') + item(1, '2.', 'two'))).toBe(
      '<ol><li><p>one</p><ol><li><p>one-a</p></li><li><p>one-b</p></li></ol></li><li><p>two</p></li></ol>',
    );
    // Word's level-2 bullet is the letter "o".
    expect(pasted(item(1, '·', 'a') + item(2, 'o', 'b'))).toBe('<ul><li><p>a</p><ul><li><p>b</p></li></ul></li></ul>');
  });

  it('starts a new list when other content comes between Word list items', () => {
    const item = (text: string) => `<p style='mso-list:l0 level1 lfo1'><span style='mso-list:Ignore'>·</span>${text}</p>`;
    expect(pasted(item('a') + '<p>between</p>' + item('b'))).toBe('<ul><li><p>a</p></li></ul><p>between</p><ul><li><p>b</p></li></ul>');
  });

  it('leaves ordinary HTML alone', () => {
    expect(pasted('<p>Plain <em>text</em>,<br>with a break.</p>')).toBe('<p>Plain <em>text</em>,<br>with a break.</p>');
  });
});

describe('isBreakMark', () => {
  it('recognizes typed scene breaks only', () => {
    expect(['***', '* * *', '#', '⁂', ' ~ ~ ~ ', '•••'].map(isBreakMark)).toEqual([true, true, true, true, true, true]);
    expect(['', 'A * B', '* item', '**bold**'].map(isBreakMark)).toEqual([false, false, false, false]);
  });
});
