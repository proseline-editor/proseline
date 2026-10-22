import { describe, it, expect, afterEach } from 'vitest';
import { h, nextTick } from 'vue';
import { render, screen, cleanup, fireEvent } from '@testing-library/vue';
import { createStore, defineFeature, type AnyFeature } from '@proseline-editor/core';
import { findReplace, focus, stats } from '@proseline-editor/core/features';
import { ProselineEditor } from '../proseline-editor.js';
import { ProselineContent } from '../proseline-content.js';
import { mount } from '../test-utils.js';
import { FindReplace } from './find-replace.js';
import { StatsBar } from './stats-bar.js';
import { FocusControls } from './focus-controls.js';
import { SyncStatus } from './sync-status.js';

afterEach(cleanup);

const setup = async (features: AnyFeature[], opts: { content?: string; editable?: boolean; locale?: string } = {}) =>
  (await mount({ content: '<p>cat dog cat</p>', ...opts, features, children: () => [h(FindReplace), h(FocusControls), h(ProselineContent), h(StatsBar)] })).editor;

describe('<FindReplace>', () => {
  it('stays hidden until opened', async () => {
    const editor = await setup([findReplace()]);
    expect(screen.queryByRole('search')).toBeNull();
    editor.feature('findReplace')!.commands.open();
    await nextTick();
    expect(screen.getByRole('search')).toBeTruthy();
  });

  it('searches as you type, steps with Enter and replaces', async () => {
    const editor = await setup([findReplace()]);
    editor.feature('findReplace')!.commands.open();
    await nextTick();
    const input = screen.getByRole('textbox', { name: 'Find' });
    await fireEvent.update(input, 'cat');
    expect(screen.getByText('1 of 2')).toBeTruthy();
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('2 of 2')).toBeTruthy();
    await fireEvent.update(screen.getByRole('textbox', { name: 'Replace with' }), 'cow');
    await fireEvent.click(screen.getByRole('button', { name: 'Replace all' }));
    expect(editor.getText()).toBe('cow dog cow');
    expect(screen.getByText('No results')).toBeTruthy();
  });

  it('closes with Escape', async () => {
    const editor = await setup([findReplace()]);
    editor.feature('findReplace')!.commands.open();
    await nextTick();
    await fireEvent.keyDown(screen.getByRole('textbox', { name: 'Find' }), { key: 'Escape' });
    expect(screen.queryByRole('search')).toBeNull();
  });

  it('hides replace controls in a read-only editor', async () => {
    const editor = await setup([findReplace()], { editable: false });
    editor.feature('findReplace')!.commands.open();
    await nextTick();
    expect(screen.queryByRole('textbox', { name: 'Replace with' })).toBeNull();
  });
});

describe('<StatsBar>', () => {
  it('shows pluralized counts and updates while typing', async () => {
    const editor = await setup([stats({ goal: 10 })], { locale: 'uk', content: '<p>одне два три</p>' });
    expect(screen.getByText('3 слова')).toBeTruthy();
    expect(screen.getByText('3 / 10')).toBeTruthy();
    editor.tiptap.commands.insertContentAt(editor.tiptap.state.doc.content.size - 1, ' чотири п’ять');
    await nextTick();
    expect(screen.getByText('5 слів')).toBeTruthy();
  });

  it('renders nothing without the stats feature', async () => {
    const { container } = render(ProselineEditor, { slots: { default: () => [h(StatsBar)] } });
    await nextTick();
    expect(container.querySelector('.pl-stats')).toBeNull();
  });
});

describe('<FocusControls>', () => {
  it('switches modes and toggles flags', async () => {
    const editor = await setup([focus()]);
    await fireEvent.click(screen.getByRole('button', { name: 'Focus sentence' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Typewriter scrolling' }));
    expect(editor.feature('focus')!.getState()).toMatchObject({ mode: 'sentence', typewriter: true });
    expect(screen.getByRole('button', { name: 'Focus sentence' }).getAttribute('aria-pressed')).toBe('true');
  });
});

/** Stands in for @proseline-editor/sync's collaboration feature: same name, same state shape. */
const fakeCollaboration = () => {
  const store = createStore({ status: 'synced' as string, unsent: 0, peers: [] as { clientId: number; name: string; color: string }[] });
  const feature = defineFeature({
    name: 'collaboration',
    messages: {
      en: { 'collaboration.synced': 'Saved', 'collaboration.offline': 'Offline', 'collaboration.unsent': '{count} unsent', 'collaboration.peers': 'Also here: {names}' },
    },
    controller: () => ({ getState: store.getState, subscribe: store.subscribe, commands: {} }),
  });
  return { feature, store };
};

describe('<SyncStatus>', () => {
  it('renders nothing without the collaboration feature', async () => {
    const { container } = render(ProselineEditor, { slots: { default: () => [h(SyncStatus)] } });
    await nextTick();
    expect(container.querySelector('.pl-sync')).toBeNull();
  });

  it('shows the status, unsent changes and peers', async () => {
    const { feature, store } = fakeCollaboration();
    const { container } = await mount({ features: [feature], children: [SyncStatus] });
    expect(screen.getByRole('status').textContent).toBe('Saved');
    store.setState({ status: 'offline', unsent: 3, peers: [{ clientId: 2, name: 'bo', color: '#f00' }] });
    await nextTick();
    expect(screen.getByRole('status').textContent).toBe('Offline');
    expect(screen.getByText('3 unsent')).toBeTruthy();
    expect(screen.getByLabelText('Also here: bo').textContent).toBe('B');
    expect(container.querySelector('.pl-sync')?.getAttribute('data-status')).toBe('offline');
  });
});
