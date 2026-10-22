import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { findReplace, paragraphStyles } from '@proseline-editor/core/features';
import type { AnyFeature, ProselineEditor as Editor } from '@proseline-editor/core';
import { ProselineEditor } from '../proseline-editor.js';
import { ProselineContent } from '../proseline-content.js';
import { Toolbar } from './toolbar.js';

afterEach(cleanup);

const setup = async (props: { content?: string; editable?: boolean; features?: AnyFeature[]; locale?: string } = {}) => {
  let editor: Editor | null = null;
  render(
    <ProselineEditor content={props.content ?? '<p>Hello world</p>'} editable={props.editable} features={props.features} locale={props.locale} onReady={(e) => (editor = e)}>
      <Toolbar>
        <button type="button">custom</button>
      </Toolbar>
      <ProselineContent />
    </ProselineEditor>,
  );
  await act(async () => {});
  return editor as unknown as Editor;
};

describe('<Toolbar>', () => {
  it('renders labelled formatting buttons and custom children', async () => {
    await setup();
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bold' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Heading 2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'custom' })).toBeTruthy();
  });

  it('toggles marks on the selection and reflects the pressed state', async () => {
    const editor = await setup();
    act(() => void editor.tiptap.commands.setTextSelection({ from: 1, to: 6 }));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Bold' })));
    expect(editor.getHTML()).toBe('<p><strong>Hello</strong> world</p>');
    expect(screen.getByRole('button', { name: 'Bold' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('applies headings and alignment', async () => {
    const editor = await setup();
    act(() => void editor.tiptap.commands.setTextSelection(2));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Heading 1' })));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Center' })));
    // TrailingNode keeps an empty paragraph after a final heading.
    expect(editor.getHTML()).toBe('<h1 style="text-align: center;">Hello world</h1><p></p>');
  });

  it('shows paragraph styles and find only when those features are enabled', async () => {
    await setup();
    expect(screen.queryByRole('combobox', { name: 'Paragraph style' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Find and replace' })).toBeNull();
    cleanup();
    const editor = await setup({ features: [paragraphStyles(), findReplace()] });
    act(() => void editor.tiptap.commands.setTextSelection(2));
    act(() => fireEvent.change(screen.getByRole('combobox', { name: 'Paragraph style' }), { target: { value: 'epigraph' } }));
    expect(editor.getHTML()).toBe('<p data-style="epigraph">Hello world</p>');
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Find and replace' })));
    expect(editor.feature('findReplace')?.getState().open).toBe(true);
  });

  it('disables formatting in a read-only editor', async () => {
    await setup({ editable: false });
    expect((screen.getByRole('button', { name: 'Bold' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('is translated', async () => {
    await setup({ locale: 'uk' });
    expect(screen.getByRole('button', { name: 'Жирний' })).toBeTruthy();
  });
});
