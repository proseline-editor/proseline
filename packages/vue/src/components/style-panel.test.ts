import { describe, it, expect, afterEach } from 'vitest';
import { h, nextTick } from 'vue';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/vue';
import { styleAnalysis, type StyleLexicon } from '@proseline-editor/core/features';
import { ProselineEditor } from '../proseline-editor.js';
import { ProselineContent } from '../proseline-content.js';
import { mount } from '../test-utils.js';
import { Toolbar } from './toolbar.js';
import { StylePanel } from './style-panel.js';

afterEach(cleanup);

const lexicon: StyleLexicon = {
  locale: 'en',
  fillers: ['just', 'really'],
  stopWords: ['the'],
  adverbs: { suffixes: ['ly'], exceptions: [] },
  syllables: () => 1,
  readability: { base: 206.835, perWordsPerSentence: 1.015, perSyllablesPerWord: 84.6 },
};

const setup = async (content = '<p>It was just late. He walked slowly and really slowly.</p>') =>
  (await mount({ content, features: [styleAnalysis({ lexicon })], children: () => [h(Toolbar), h(ProselineContent), h(StylePanel)] })).editor;

const panel = () => screen.getByRole('complementary', { name: 'Style' });

describe('<StylePanel>', () => {
  it('renders nothing without the styleAnalysis feature', async () => {
    const { container } = render(ProselineEditor, { slots: { default: () => [h(StylePanel)] } });
    await nextTick();
    expect(container.querySelector('.pl-style-panel')).toBeNull();
  });

  it('is off until switched on, then lists the supported checks with counts', async () => {
    await setup();
    expect(within(panel()).getByText('Turn on to see style issues.')).toBeTruthy();
    await fireEvent.click(within(panel()).getByRole('checkbox', { name: 'Highlight style issues' }));
    const rows = within(panel()).getAllByRole('listitem').map((li) => li.textContent);
    expect(rows).toEqual(['abFiller words2', 'abAdverbs2', 'abRepetitions2', 'abLong sentences0']);
    expect(within(panel()).getByText('Write a little more for a readability score.')).toBeTruthy();
  });

  it('switches a check off and steps through issues of one check', async () => {
    const editor = await setup();
    await fireEvent.click(screen.getByRole('button', { name: 'Highlight style issues' }));
    expect(screen.getByRole('button', { name: 'Highlight style issues' }).getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(within(panel()).getByRole('checkbox', { name: /Repetitions/ }));
    expect(editor.tiptap.view.dom.querySelectorAll('.pl-style--repetition')).toHaveLength(0);
    expect(within(panel()).getByRole('button', { name: 'Next: Repetitions' }).hasAttribute('disabled')).toBe(true);
    await fireEvent.click(within(panel()).getByRole('button', { name: 'Next: Adverbs' }));
    const { from, to } = editor.tiptap.state.selection;
    expect(editor.tiptap.state.doc.textBetween(from, to)).toBe('slowly');
  });

  it('shows the readability score', async () => {
    await setup(`<p>${'The cat sat on the mat. '.repeat(8)}</p>`);
    await fireEvent.click(within(panel()).getByRole('checkbox', { name: 'Highlight style issues' }));
    expect(within(panel()).getByText(/Readability/).textContent).toMatch(/^Readability: \d+ · very easy$/);
  });
});
