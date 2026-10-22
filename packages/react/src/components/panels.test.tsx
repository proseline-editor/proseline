import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { findReplace, focus, stats } from '@proseline-editor/core/features';
import type { AnyFeature, ProselineEditor as Editor } from '@proseline-editor/core';
import { ProselineEditor } from '../proseline-editor.js';
import { ProselineContent } from '../proseline-content.js';
import { FindReplace } from './find-replace.js';
import { StatsBar } from './stats-bar.js';
import { FocusControls } from './focus-controls.js';

afterEach(cleanup);

const setup = async (features: AnyFeature[], opts: { content?: string; editable?: boolean; locale?: string } = {}) => {
  let editor: Editor | null = null;
  render(
    <ProselineEditor content={opts.content ?? '<p>cat dog cat</p>'} editable={opts.editable} locale={opts.locale} features={features} onReady={(e) => (editor = e)}>
      <FindReplace />
      <FocusControls />
      <ProselineContent />
      <StatsBar />
    </ProselineEditor>,
  );
  await act(async () => {});
  return editor as unknown as Editor;
};

describe('<FindReplace>', () => {
  it('stays hidden until opened', async () => {
    const editor = await setup([findReplace()]);
    expect(screen.queryByRole('search')).toBeNull();
    act(() => void editor.feature('findReplace')!.commands.open());
    expect(screen.getByRole('search')).toBeTruthy();
  });

  it('searches as you type, steps with Enter and replaces', async () => {
    const editor = await setup([findReplace()]);
    act(() => void editor.feature('findReplace')!.commands.open());
    const input = screen.getByRole('textbox', { name: 'Find' });
    act(() => fireEvent.change(input, { target: { value: 'cat' } }));
    expect(screen.getByText('1 of 2')).toBeTruthy();
    act(() => fireEvent.keyDown(input, { key: 'Enter' }));
    expect(screen.getByText('2 of 2')).toBeTruthy();
    act(() => fireEvent.change(screen.getByRole('textbox', { name: 'Replace with' }), { target: { value: 'cow' } }));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Replace all' })));
    expect(editor.getText()).toBe('cow dog cow');
    expect(screen.getByText('No results')).toBeTruthy();
  });

  it('closes with Escape', async () => {
    const editor = await setup([findReplace()]);
    act(() => void editor.feature('findReplace')!.commands.open());
    act(() => fireEvent.keyDown(screen.getByRole('textbox', { name: 'Find' }), { key: 'Escape' }));
    expect(screen.queryByRole('search')).toBeNull();
  });

  it('hides replace controls in a read-only editor', async () => {
    const editor = await setup([findReplace()], { editable: false });
    act(() => void editor.feature('findReplace')!.commands.open());
    expect(screen.queryByRole('textbox', { name: 'Replace with' })).toBeNull();
  });
});

describe('<StatsBar>', () => {
  it('shows pluralized counts and updates while typing', async () => {
    const editor = await setup([stats({ goal: 10 })], { locale: 'uk', content: '<p>одне два три</p>' });
    expect(screen.getByText('3 слова')).toBeTruthy();
    expect(screen.getByText('3 / 10')).toBeTruthy();
    act(() => void editor.tiptap.commands.insertContentAt(editor.tiptap.state.doc.content.size - 1, ' чотири п’ять'));
    expect(screen.getByText('5 слів')).toBeTruthy();
  });

  it('renders nothing without the stats feature', async () => {
    const { container } = render(
      <ProselineEditor>
        <StatsBar />
      </ProselineEditor>,
    );
    await act(async () => {});
    expect(container.querySelector('.pl-stats')).toBeNull();
  });
});

describe('<FocusControls>', () => {
  it('switches modes and toggles flags', async () => {
    const editor = await setup([focus()]);
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Focus sentence' })));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Typewriter scrolling' })));
    expect(editor.feature('focus')!.getState()).toMatchObject({ mode: 'sentence', typewriter: true });
    expect(screen.getByRole('button', { name: 'Focus sentence' }).getAttribute('aria-pressed')).toBe('true');
  });
});
