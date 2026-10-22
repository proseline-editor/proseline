import { describe, it, expect, afterEach } from 'vitest';
import { createEditor, type ProselineEditor } from '../../editor.js';
import { typography, type TypographyOptions } from './index.js';
import { typeText } from '../../../test/helpers.js';

let editor: ProselineEditor | null = null;
afterEach(() => editor?.destroy());

const typed = (text: string, locale = 'en', opts: TypographyOptions = {}) => {
  editor = createEditor({ locale, features: [typography(opts)] });
  editor.tiptap.commands.focus('end');
  typeText(editor.tiptap, text);
  const out = editor.getText();
  editor.destroy();
  editor = null;
  return out;
};

describe('typography', () => {
  it('turns -- into an em dash and ... into an ellipsis', () => {
    expect(typed('a -- b...')).toBe('a — b…');
  });

  it('uses English curly quotes by default', () => {
    expect(typed('"Hi," she said')).toBe('“Hi,” she said');
    expect(typed("'quoted' don't")).toBe('‘quoted’ don’t');
  });

  it('uses guillemets and an apostrophe for Ukrainian', () => {
    expect(typed('"Так", - сказав', 'uk')).toBe('«Так», - сказав');
    expect(typed("п'ять", 'uk')).toBe('п’ять');
  });

  it('uses spaced guillemets and narrow no-break spaces for French', () => {
    expect(typed('"Oui" ?', 'fr')).toBe('«\u202FOui\u202F»\u202F?');
  });

  it('opens a quote after an opening bracket', () => {
    expect(typed('("x")')).toBe('(“x”)');
  });

  it('respects a quotes locale override and disabled rules', () => {
    expect(typed('"x"', 'en', { quotes: 'uk' })).toBe('«x»');
    expect(typed('a -- b', 'en', { dashes: false })).toBe('a -- b');
  });

  it('reverts the last replacement with undoInputRule (Backspace)', () => {
    editor = createEditor({ features: [typography()] });
    editor.tiptap.commands.focus('end');
    typeText(editor.tiptap, 'a--');
    editor.tiptap.commands.undoInputRule();
    expect(editor.getText()).toBe('a--');
  });

  it('exposes its settings as controller state', () => {
    editor = createEditor({ locale: 'fr', features: [typography()] });
    expect(editor.feature('typography')?.getState()).toEqual({ quotes: 'fr', dashes: true, ellipsis: true, frenchSpacing: true });
  });
});
