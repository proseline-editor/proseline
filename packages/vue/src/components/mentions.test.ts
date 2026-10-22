import { describe, it, expect, afterEach } from 'vitest';
import { h, nextTick } from 'vue';
import { render, screen, cleanup, fireEvent } from '@testing-library/vue';
import { mentions, staticMentionProvider } from '@proseline-editor/core/features';
import type { ProselineEditor as Editor } from '@proseline-editor/core';
import { ProselineEditor } from '../proseline-editor.js';
import { mount } from '../test-utils.js';
import { MentionMenu } from './mention-menu.js';
import { MentionCasePicker } from './mention-case-picker.js';

afterEach(cleanup);

const provider = staticMentionProvider([
  { id: 'g', label: 'Ґордій', kind: 'character', forms: { base: 'Ґордій', gen: 'Ґордія', dat: 'Ґордієві' } },
  { id: 'h', label: 'Гавань', kind: 'location' },
  { id: 'x', label: 'Гість' },
]);

const setup = async (content = '<p></p>', onOpen?: (mention: { id: string }) => void) =>
  (await mount({ content, features: [mentions({ provider, onOpen })], children: [MentionMenu, MentionCasePicker] })).editor;

const type = async (editor: Editor, text: string) => {
  editor.tiptap.commands.focus('end');
  editor.tiptap.commands.insertContent(text);
  await nextTick();
};

describe('<MentionMenu>', () => {
  it('renders nothing without the mentions feature', async () => {
    const { container } = render(ProselineEditor, { slots: { default: () => [h(MentionMenu), h(MentionCasePicker)] } });
    await nextTick();
    expect(container.querySelector('.pl-mention-menu, .pl-mention-picker')).toBeNull();
  });

  it('lists matches grouped by kind and inserts the clicked one', async () => {
    const editor = await setup();
    await type(editor, 'Hi @');
    expect(screen.getByRole('group', { name: 'Characters' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Places' })).toBeTruthy();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Ґордій', 'Гавань', 'Гість']);
    expect(screen.getAllByRole('option')[0]!.getAttribute('aria-selected')).toBe('true');
    await fireEvent.click(screen.getByRole('option', { name: 'Гавань' }));
    expect(editor.tiptap.getText()).toBe('Hi Гавань ');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('offers the selected entity in its cases', async () => {
    const editor = await setup();
    await type(editor, '@Ґор');
    const cases = screen.getAllByRole('radio');
    expect(cases.map((c) => c.textContent)).toEqual(['Ґордій', 'Ґордія', 'Ґордієві']);
    expect(cases[1]!.title).toBe('genitive');
    await fireEvent.click(cases[2]!);
    expect(editor.tiptap.getJSON().content?.[0]?.content?.[0]).toMatchObject({ type: 'mention', attrs: { label: 'Ґордієві', case: 'dat' } });
  });

  it('shows the case form a search matched', async () => {
    const editor = await setup();
    await type(editor, '@Ґордієві');
    expect(screen.getByRole('option').textContent).toBe('ҐордійҐордієві');
    expect(screen.getAllByRole('radio')[2]!.getAttribute('aria-checked')).toBe('true');
  });

  it('says when nothing matches', async () => {
    const editor = await setup();
    await type(editor, '@zzz');
    expect(screen.getByText('No matches')).toBeTruthy();
  });
});

describe('<MentionCasePicker>', () => {
  it('switches a clicked mention to another case and closes on Escape or an outside click', async () => {
    const editor = await setup('<p>Met <span data-mention-id="g" data-label="Ґордій" data-kind="character">Ґордій</span> today</p>');
    const mention = () => editor.tiptap.view.dom.querySelector('.pl-mention')!;
    await fireEvent.click(mention());
    const items = screen.getAllByRole('menuitemradio');
    expect(items.map((i) => i.textContent)).toEqual(['Ґордійnominative', 'Ґордіяgenitive', 'Ґордієвіdative']);
    expect(items[0]!.getAttribute('aria-checked')).toBe('true');
    await fireEvent.click(items[1]!);
    expect(mention().textContent).toBe('Ґордія');
    expect(screen.queryByRole('menu')).toBeNull();

    await fireEvent.click(mention());
    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    await fireEvent.click(mention());
    await nextTick();
    await fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('offers Open when the host handles it', async () => {
    const opened: string[] = [];
    const editor = await setup('<p><span data-mention-id="h" data-label="Гавань">Гавань</span></p>', (m) => opened.push(m.id));
    await fireEvent.click(editor.tiptap.view.dom.querySelector('.pl-mention')!);
    await fireEvent.click(screen.getByRole('menuitem', { name: 'Open' }));
    expect(opened).toEqual(['h']);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
