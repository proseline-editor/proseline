import { describe, it, expect, afterEach } from 'vitest';
import { createEditor, type ProselineEditor } from '../../editor.js';
import { focus } from './index.js';

let editor: ProselineEditor | null = null;
afterEach(() => editor?.destroy());

const make = (content: string, opts: Parameters<typeof focus>[0] = {}) => {
  editor = createEditor({ content, features: [focus(opts)] });
  return { e: editor, c: editor.feature('focus')! };
};
const dimmed = (e: ProselineEditor) => Array.from(e.tiptap.view.dom.querySelectorAll('.pl-dim')).map((el) => el.textContent);

describe('focus', () => {
  it('starts with the configured state', () => {
    const { c } = make('<p>a</p>', { typewriter: true });
    expect(c.getState()).toEqual({ mode: 'off', typewriter: true, distractionFree: false });
  });

  it('dims every block except the one with the caret in paragraph mode', () => {
    const { e, c } = make('<p>One</p><p>Two</p><p>Three</p>');
    e.tiptap.commands.setTextSelection(7);
    c.commands.setMode('paragraph');
    expect(dimmed(e)).toEqual(['One', 'Three']);
    expect(e.tiptap.view.dom.getAttribute('data-focus')).toBe('paragraph');
    e.tiptap.commands.setTextSelection(2);
    expect(dimmed(e)).toEqual(['Two', 'Three']);
  });

  it('also dims the rest of the paragraph in sentence mode', () => {
    const { e, c } = make('<p>First one. Second one. Third.</p><p>Other</p>');
    e.tiptap.commands.setTextSelection(15);
    c.commands.setMode('sentence');
    expect(dimmed(e)).toEqual(['First one. ', ' Third.', 'Other']);
  });

  it('removes all dimming when turned off', () => {
    const { e, c } = make('<p>One</p><p>Two</p>');
    c.commands.setMode('paragraph');
    c.commands.setMode('off');
    expect(dimmed(e)).toEqual([]);
    expect(e.tiptap.view.dom.hasAttribute('data-focus')).toBe(false);
  });

  it('toggles typewriter and distraction-free flags without touching undo history', () => {
    const { e, c } = make('<p>a</p>');
    c.commands.toggleTypewriter();
    c.commands.toggleDistractionFree();
    expect(c.getState()).toMatchObject({ typewriter: true, distractionFree: true });
    expect(e.tiptap.can().undo()).toBe(false);
  });
});
