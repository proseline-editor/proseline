import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent, within } from '@testing-library/react';
import { createStore, defineFeature } from '@proseline-editor/core';
import { memoryVersionStore, versions, type VersionsOptions } from '@proseline-editor/core/features';
import type { AnyFeature, ProselineEditor as Editor } from '@proseline-editor/core';
import { ProselineEditor } from '../proseline-editor.js';
import { ProselineContent } from '../proseline-content.js';
import { VersionsPanel } from './versions-panel.js';

afterEach(cleanup);

const setup = async (opts: Partial<VersionsOptions> & { locale?: string; extra?: AnyFeature[] } = {}) => {
  let editor: Editor | null = null;
  const store = opts.store ?? memoryVersionStore();
  render(
    <ProselineEditor
      content="<p>The old grey cat sat</p>"
      locale={opts.locale}
      features={[versions({ store, docId: 'd', autoSnapshotMs: false, ...opts }), ...(opts.extra ?? [])]}
      onReady={(e) => (editor = e)}
    >
      <ProselineContent />
      <VersionsPanel />
    </ProselineEditor>,
  );
  await act(async () => {});
  return { editor: editor as unknown as Editor, store };
};

const panel = () => screen.getByRole('complementary', { name: 'Versions' });

const saveVersion = async (name: string) => {
  act(() => fireEvent.click(within(panel()).getByRole('button', { name: 'Save version' })));
  act(() => fireEvent.change(within(panel()).getByRole('textbox', { name: 'Name (optional)' }), { target: { value: name } }));
  await act(async () => fireEvent.submit(within(panel()).getByRole('textbox', { name: 'Name (optional)' }).closest('form')!));
};

describe('<VersionsPanel>', () => {
  it('renders nothing without the versions feature', async () => {
    const { container } = render(
      <ProselineEditor>
        <VersionsPanel />
      </ProselineEditor>,
    );
    await act(async () => {});
    expect(container.querySelector('.pl-versions')).toBeNull();
  });

  it('saves a named version and lists it with its word count', async () => {
    await setup();
    expect(screen.getByText('No versions yet.')).toBeTruthy();
    await saveVersion('First draft');
    expect(screen.getByText('First draft')).toBeTruthy();
    expect(screen.getByText(/5 words/)).toBeTruthy();
  });

  it('compares a version with the current text, and shows it as it was', async () => {
    const { editor } = await setup();
    await saveVersion('v1');
    act(() => void editor.tiptap.commands.setContent('<p>The grey cat sat quietly</p>'));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Preview' })));
    const preview = screen.getByRole('region', { name: 'Preview' });
    expect(within(preview).getByText('+1 / −1 words since')).toBeTruthy();
    expect(preview.querySelector('del')?.textContent).toBe('old ');
    expect(preview.querySelector('ins')?.textContent).toBe(' quietly');
    act(() => fireEvent.click(within(preview).getByRole('tab', { name: 'Version' })));
    expect(preview.querySelector('.pl-version-content')?.innerHTML).toBe('<p>The old grey cat sat</p>');
  });

  it('restores after confirmation', async () => {
    const { editor } = await setup();
    await saveVersion('good');
    act(() => void editor.tiptap.commands.setContent('<p>Ruined</p>'));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Restore' })));
    expect(screen.getByText('Replace the current text with this version?')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Restore' })));
    expect(editor.getHTML()).toBe('<p>The old grey cat sat</p>');
    expect(screen.getByText('Before restore')).toBeTruthy();
  });

  it('warns that co-authors lose their text too when restoring', async () => {
    const peers = createStore({ peers: [{ clientId: 2, name: 'Bo', color: '#000' }] });
    const fakeCollaboration = defineFeature({ name: 'collaboration', controller: () => ({ getState: peers.getState, subscribe: peers.subscribe, commands: {} }) });
    await setup({ extra: [fakeCollaboration] });
    await saveVersion('v');
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Restore' })));
    expect(screen.getByRole('alert').textContent).toBe('Others are writing here: restoring replaces their text too.');
  });

  it('deletes after confirmation', async () => {
    await setup();
    await saveVersion('temp');
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Delete version' })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete version' })));
    expect(screen.queryByText('temp')).toBeNull();
  });

  it('lets viewers browse but not change versions', async () => {
    const store = memoryVersionStore();
    await store.save('d', { content: { type: 'doc', content: [{ type: 'paragraph' }] }, label: 'v', auto: false, words: 0 });
    await setup({ store, allowChanges: false });
    expect(screen.queryByRole('button', { name: 'Save version' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Restore' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeTruthy();
  });

  it('is translated', async () => {
    await setup({ locale: 'uk' });
    expect(screen.getByRole('complementary', { name: 'Версії' })).toBeTruthy();
  });
});
