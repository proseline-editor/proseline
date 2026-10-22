import { describe, it, expect, afterEach } from 'vitest';
import { createEditor, type ProselineEditor } from '../../editor.js';
import { typeText } from '../../../test/helpers.js';
import { mentions, type MentionsOptions } from './index.js';
import { staticMentionProvider, type MatchedMentionItem, type MentionItem } from './provider.js';

let editor: ProselineEditor | null = null;
afterEach(() => editor?.destroy());

const ITEMS: MentionItem[] = [
  { id: 'g', label: 'Ґордій', kind: 'character', forms: { base: 'Ґордій', gen: 'Ґордія', dat: 'Ґордієві' } },
  { id: 'm', label: 'Мара', kind: 'character' },
  { id: 'h', label: 'Гавань', kind: 'location' },
];

const setup = (html = '<p></p>', opts: Partial<MentionsOptions> = {}, editable = true) => {
  const provider = staticMentionProvider(ITEMS);
  editor = createEditor({ content: html, editable, locale: 'uk', features: [mentions({ provider, ...opts })] });
  editor.tiptap.commands.focus('end');
  return { e: editor, m: editor.feature('mentions')!, provider };
};

const key = (e: ProselineEditor, k: string) => e.tiptap.view.someProp('handleKeyDown', (f) => f(e.tiptap.view, new KeyboardEvent('keydown', { key: k })));

describe('mentions', () => {
  it('opens the menu after @ with matching entities', () => {
    const { e, m } = setup();
    typeText(e.tiptap, 'Говорив з @Ма');
    expect(m.getState().menu).toMatchObject({ query: 'Ма', selected: 0, items: [expect.objectContaining({ id: 'm' })] });
  });

  it('ignores @ inside a word (an e-mail address)', () => {
    const { e, m } = setup();
    typeText(e.tiptap, 'mail@Ма');
    expect(m.getState().menu).toBeNull();
  });

  it('finds an entity by a case form and preselects that case', () => {
    const { e, m } = setup();
    typeText(e.tiptap, '@єві');
    const menu = m.getState().menu!;
    expect(menu.items.map((i) => i.id)).toEqual(['g']);
    expect(menu.caseOptions[menu.caseIndex]).toBe('dat');
  });

  it('inserts the mention in the chosen case with Enter, then a space', () => {
    const { e, m } = setup();
    typeText(e.tiptap, 'Дав книгу @єві');
    expect(key(e, 'Enter')).toBe(true);
    expect(m.getState().menu).toBeNull();
    expect(e.getJSON().content?.[0]?.content).toEqual([
      { type: 'text', text: 'Дав книгу ' },
      { type: 'mention', attrs: { id: 'g', label: 'Ґордієві', kind: 'character', case: 'dat' } },
      { type: 'text', text: ' ' },
    ]);
  });

  it('moves through entities and cases with the arrow keys', () => {
    const { e, m } = setup();
    typeText(e.tiptap, '@');
    key(e, 'ArrowDown');
    expect(m.getState().menu!.selected).toBe(1);
    key(e, 'ArrowUp');
    key(e, 'ArrowRight');
    expect(m.getState().menu!.caseOptions[m.getState().menu!.caseIndex]).toBe('gen');
    key(e, 'Enter');
    expect(e.getJSON().content?.[0]?.content?.[0]).toMatchObject({ type: 'mention', attrs: { id: 'g', case: 'gen', label: 'Ґордія' } });
  });

  it('closes on Escape and stays closed while typing the same query', () => {
    const { e, m } = setup();
    typeText(e.tiptap, '@Ма');
    expect(key(e, 'Escape')).toBe(true);
    expect(m.getState().menu).toBeNull();
    typeText(e.tiptap, 'р');
    expect(m.getState().menu).toBeNull();
    typeText(e.tiptap, ' @Г');
    expect(m.getState().menu).not.toBeNull();
  });

  it('inserts with the mouse (choose)', () => {
    const { e, m } = setup();
    typeText(e.tiptap, '@');
    m.commands.choose(2);
    expect(e.getJSON().content?.[0]?.content?.[0]).toMatchObject({ type: 'mention', attrs: { id: 'h', kind: 'location', case: null, label: 'Гавань' } });
  });

  it('renders the current name, follows renames and marks deleted entities and missing forms', () => {
    const { e, provider } = setup('<p><span data-mention-id="g" data-label="Ґордієві" data-case="dat">Ґордієві</span> і <span data-mention-id="m" data-label="Марі" data-case="dat">Марі</span></p>');
    const spans = () => [...e.tiptap.view.dom.querySelectorAll('.pl-mention')] as HTMLElement[];
    expect(spans().map((s) => s.textContent)).toEqual(['Ґордієві', 'Мара']);
    expect(spans()[1]!.classList.contains('pl-mention--noform')).toBe(true);
    expect(spans()[1]!.title).toBe('Немає цієї відмінкової форми — показано ім’я');
    provider.setItems([{ ...ITEMS[0]!, label: 'Майстер Ґордій', forms: { base: 'Майстер Ґордій', dat: 'Майстрові Ґордієві' } }]);
    expect(spans()[0]!.textContent).toBe('Майстрові Ґордієві');
    expect(spans()[1]!.textContent).toBe('Марі');
    expect(spans()[1]!.classList.contains('pl-mention--detached')).toBe(true);
    expect(e.getJSON().content?.[0]?.content?.[0]?.attrs?.label).toBe('Ґордієві'); // the document is not rewritten
  });

  it('switches an existing mention to another case from its picker', () => {
    const { e, m } = setup('<p><span data-mention-id="g" data-label="Ґордій">Ґордій</span></p>');
    (e.tiptap.view.dom.querySelector('.pl-mention') as HTMLElement).click();
    expect(m.getState().picker).toMatchObject({
      id: 'g',
      current: null,
      options: [
        { case: null, text: 'Ґордій' },
        { case: 'gen', text: 'Ґордія' },
        { case: 'dat', text: 'Ґордієві' },
      ],
    });
    m.commands.pickCase('gen');
    expect(m.getState().picker).toBeNull();
    expect(e.getJSON().content?.[0]?.content?.[0]?.attrs).toMatchObject({ case: 'gen', label: 'Ґордія' });
  });

  it('does not open the picker in a read-only editor or when case changes are off', () => {
    const ro = setup('<p><span data-mention-id="g" data-label="Ґордій">Ґордій</span></p>', {}, false);
    (ro.e.tiptap.view.dom.querySelector('.pl-mention') as HTMLElement).click();
    expect(ro.m.getState().picker).toBeNull();
    ro.e.destroy();
    const off = setup('<p><span data-mention-id="g" data-label="Ґордій">Ґордій</span></p>', { allowCaseChange: false });
    (off.e.tiptap.view.dom.querySelector('.pl-mention') as HTMLElement).click();
    expect(off.m.getState().picker).toBeNull();
  });

  it('opens the entity through onOpen on Cmd/Ctrl-click, in read-only mode and from the picker', () => {
    const opened: unknown[] = [];
    const html = '<p><span data-mention-id="g" data-kind="character" data-label="Ґордій">Ґордій</span></p>';
    const { e, m } = setup(html, { onOpen: (x) => opened.push(x) });
    const span = () => e.tiptap.view.dom.querySelector('.pl-mention') as HTMLElement;
    span().dispatchEvent(new MouseEvent('click', { metaKey: true }));
    expect(opened).toEqual([{ id: 'g', kind: 'character' }]);
    expect(m.getState().picker).toBeNull();
    span().click();
    expect(m.getState().picker).toMatchObject({ canOpen: true });
    m.commands.open();
    expect(m.getState().picker).toBeNull();
    expect(opened).toHaveLength(2);
    e.destroy();
    const ro = setup(html, { onOpen: (x) => opened.push(x) }, false);
    (ro.e.tiptap.view.dom.querySelector('.pl-mention') as HTMLElement).click();
    expect(opened).toHaveLength(3);
  });

  it('uses async search results and drops stale ones', async () => {
    const resolvers: ((items: MatchedMentionItem[]) => void)[] = [];
    const provider = {
      search: () => new Promise<MatchedMentionItem[]>((resolve) => resolvers.push(resolve)),
      resolve: () => null,
    };
    editor = createEditor({ content: '<p></p>', features: [mentions({ provider })] });
    editor.tiptap.commands.focus('end');
    typeText(editor.tiptap, '@a');
    typeText(editor.tiptap, 'b');
    expect(editor.feature('mentions')!.getState().menu).toMatchObject({ query: 'ab', loading: true });
    // One search per keystroke: '', 'a', 'ab'. The latest answers first, an older one late.
    expect(resolvers).toHaveLength(3);
    resolvers[2]!([{ id: 'x', label: 'Abby', matchedCase: null }]);
    await Promise.resolve();
    resolvers[1]!([{ id: 'y', label: 'Old', matchedCase: null }]);
    await Promise.resolve();
    expect(editor.feature('mentions')!.getState().menu).toMatchObject({ loading: false, items: [expect.objectContaining({ id: 'x' })] });
  });
});
