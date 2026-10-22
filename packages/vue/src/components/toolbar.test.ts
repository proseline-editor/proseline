import { describe, it, expect, afterEach } from 'vitest';
import { h, nextTick } from 'vue';
import { screen, cleanup, fireEvent } from '@testing-library/vue';
import { findReplace, paragraphStyles } from '@proseline-editor/core/features';
import { ProselineContent } from '../proseline-content.js';
import { mount, type MountOptions } from '../test-utils.js';
import { Toolbar } from './toolbar.js';

afterEach(cleanup);

const setup = async (opts: MountOptions = {}) =>
  (await mount({ content: '<p>Hello world</p>', ...opts, children: () => [h(Toolbar, null, { default: () => h('button', { type: 'button' }, 'custom') }), h(ProselineContent)] })).editor;

describe('<Toolbar>', () => {
  it('renders labelled formatting buttons and custom slot content', async () => {
    await setup();
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bold' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Heading 2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'custom' })).toBeTruthy();
  });

  it('toggles marks on the selection and reflects the pressed state', async () => {
    const editor = await setup();
    editor.tiptap.commands.setTextSelection({ from: 1, to: 6 });
    await fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(editor.getHTML()).toBe('<p><strong>Hello</strong> world</p>');
    expect(screen.getByRole('button', { name: 'Bold' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('applies headings and alignment', async () => {
    const editor = await setup();
    editor.tiptap.commands.setTextSelection(2);
    await fireEvent.click(screen.getByRole('button', { name: 'Heading 1' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Center' }));
    // TrailingNode keeps an empty paragraph after a final heading.
    expect(editor.getHTML()).toBe('<h1 style="text-align: center;">Hello world</h1><p></p>');
  });

  it('shows paragraph styles and find only when those features are enabled', async () => {
    await setup();
    expect(screen.queryByRole('combobox', { name: 'Paragraph style' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Find and replace' })).toBeNull();
    cleanup();
    const editor = await setup({ features: [paragraphStyles(), findReplace()] });
    editor.tiptap.commands.setTextSelection(2);
    await fireEvent.update(screen.getByRole('combobox', { name: 'Paragraph style' }), 'epigraph');
    expect(editor.getHTML()).toBe('<p data-style="epigraph">Hello world</p>');
    await nextTick();
    expect((screen.getByRole('combobox', { name: 'Paragraph style' }) as HTMLSelectElement).value).toBe('epigraph');
    await fireEvent.click(screen.getByRole('button', { name: 'Find and replace' }));
    expect(editor.feature('findReplace')?.getState().open).toBe(true);
  });

  it('disables formatting in a read-only editor, live', async () => {
    const { editor, rerender } = await mount({ content: '<p>x</p>', children: [Toolbar] });
    expect((screen.getByRole('button', { name: 'Bold' }) as HTMLButtonElement).disabled).toBe(false);
    await rerender({ editable: false });
    expect(editor.isEditable).toBe(false);
    expect((screen.getByRole('button', { name: 'Bold' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('is translated', async () => {
    await setup({ locale: 'uk' });
    expect(screen.getByRole('button', { name: 'Жирний' })).toBeTruthy();
  });
});
