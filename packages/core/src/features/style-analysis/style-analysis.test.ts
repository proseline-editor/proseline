import { describe, it, expect, afterEach, vi } from 'vitest';
import { createEditor, type ProselineEditor } from '../../editor.js';
import { testLexicon } from '../../../test/style-lexicon.js';
import { styleAnalysis, type StyleAnalysisOptions } from './index.js';
import { visibleBlocks } from './viewport.js';
import { analyzeText } from './analyze.js';

// The test DOM has no layout, so by default every block is highlighted; single tests narrow the window.
vi.mock('./viewport.js', () => ({ visibleBlocks: vi.fn(() => null) }));
// Spied on to check that re-analysis after an edit only touches the changed paragraph.
vi.mock('./analyze.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./analyze.js')>();
  return { ...actual, analyzeText: vi.fn(actual.analyzeText) };
});

let editor: ProselineEditor | null = null;
afterEach(() => {
  editor?.destroy();
  vi.useRealTimers();
});

const TEXT = '<p>She was just tired. He walked slowly. The letter was written.</p><p>The harbour slept and the harbour woke.</p>';

const setup = (html = TEXT, opts: Partial<StyleAnalysisOptions> = {}) => {
  editor = createEditor({ content: html, features: [styleAnalysis({ lexicon: testLexicon, ...opts })] });
  return { e: editor, s: editor.feature('styleAnalysis')! };
};

const highlights = (e: ProselineEditor) =>
  [...e.tiptap.view.dom.querySelectorAll('.pl-style')].map((el) => [el.className.replace('pl-style pl-style--', ''), el.textContent]);

describe('styleAnalysis', () => {
  it('is off by default and highlights nothing', () => {
    const { e, s } = setup();
    expect(s.getState()).toMatchObject({ enabled: false, readability: null, counts: { filler: 0 } });
    expect(highlights(e)).toEqual([]);
  });

  it('highlights issues and counts them when switched on', () => {
    const { e, s } = setup();
    s.commands.setEnabled(true);
    expect(highlights(e)).toEqual([
      ['filler', 'just'],
      ['adverb', 'slowly'],
      ['passive', 'was written'],
      ['repetition', 'harbour'],
      ['repetition', 'harbour'],
    ]);
    expect(s.getState().counts).toEqual({ filler: 1, adverb: 1, repetition: 2, longSentence: 0, passive: 1 });
    expect(e.tiptap.view.dom.querySelector('.pl-style--repetition')?.getAttribute('title')).toBe('Repeated: harbour');
    s.commands.toggle();
    expect(highlights(e)).toEqual([]);
    expect(s.getState().counts.filler).toBe(0);
  });

  it('switches single checks off, still counting them', () => {
    const { e, s } = setup(TEXT, { enabled: true, checks: { repetition: false } });
    expect(highlights(e).map(([c]) => c)).toEqual(['filler', 'adverb', 'passive']);
    expect(s.getState().counts.repetition).toBe(2);
    s.commands.setCheck('repetition', true);
    s.commands.setCheck('filler', false);
    expect(highlights(e).map(([c]) => c)).toEqual(['adverb', 'passive', 'repetition', 'repetition']);
  });

  it('lists only the checks the lexicon supports', () => {
    const { s } = setup(TEXT, { lexicon: { ...testLexicon, passive: undefined } });
    expect(s.getState().available).toEqual(['filler', 'adverb', 'repetition', 'longSentence']);
    expect(s.getState().checks.passive).toBe(false);
  });

  it('jumps to the next and previous issue, wrapping', () => {
    const { e, s } = setup(TEXT, { enabled: true });
    const selected = () => e.tiptap.state.doc.textBetween(e.tiptap.state.selection.from, e.tiptap.state.selection.to);
    e.tiptap.commands.setTextSelection(1);
    expect(s.commands.next()).toBe(true);
    expect(selected()).toBe('just');
    s.commands.next();
    expect(selected()).toBe('slowly');
    s.commands.prev();
    s.commands.prev();
    expect(selected()).toBe('harbour');
    expect(s.commands.next('passive')).toBe(true);
    expect(selected()).toBe('was written');
  });

  it('navigates by current positions right after an edit', () => {
    const { e, s } = setup(TEXT, { enabled: true });
    e.tiptap.commands.setTextSelection(1);
    e.tiptap.commands.insertContent('Really, ');
    e.tiptap.commands.setTextSelection(1);
    s.commands.next('filler');
    const { from, to } = e.tiptap.state.selection;
    expect(e.tiptap.state.doc.textBetween(from, to)).toBe('just');
    s.commands.prev('filler');
    expect(e.tiptap.state.doc.textBetween(e.tiptap.state.selection.from, e.tiptap.state.selection.to)).toBe('Really');
  });

  it('re-analyzes after edits pause, reusing unchanged paragraphs', () => {
    vi.useFakeTimers();
    const { e, s } = setup(TEXT, { enabled: true });
    e.tiptap.commands.setTextSelection(e.tiptap.state.doc.content.size - 1);
    e.tiptap.commands.insertContent(' It was really late.');
    expect(s.getState().counts.filler).toBe(1);
    vi.advanceTimersByTime(299);
    expect(s.getState().counts.filler).toBe(1);
    vi.advanceTimersByTime(10);
    expect(s.getState().counts.filler).toBe(2);
    expect(highlights(e).filter(([c]) => c === 'filler').map(([, w]) => w)).toEqual(['just', 'really']);
  });

  it('maps positions over mentions and hard breaks', () => {
    const { e } = setup('<p><span data-mention-id="m" data-label="Mara">Mara</span> was just<br>very tired</p>', { enabled: true });
    expect(highlights(e)).toEqual([
      ['filler', 'just'],
      ['filler', 'very'],
    ]);
  });

  it('scores readability for the whole document', () => {
    const sentence = 'The cat sat on the mat by the door. ';
    const { s } = setup(`<p>${sentence.repeat(6)}</p>`, { enabled: true });
    expect(s.getState().readability).toMatchObject({ level: 'veryEasy', words: 54, sentences: 6 });
  });

  it('highlights only the textblocks around the visible ones', () => {
    vi.mocked(visibleBlocks).mockReturnValue({ first: 1, last: 1 });
    const { e, s } = setup(TEXT, { enabled: true });
    expect(highlights(e)).toEqual([
      ['repetition', 'harbour'],
      ['repetition', 'harbour'],
    ]);
    expect(s.getState().counts.filler).toBe(1);
    vi.mocked(visibleBlocks).mockReturnValue(null);
  });

  it('analyzes a 150k-word document in idle slices and re-analyzes only the edited paragraph', async () => {
    vi.mocked(visibleBlocks).mockReturnValue({ first: 0, last: 80 });
    const paragraph = `<p>${'The quick brown fox jumps over the lazy dog near the quiet river bank. '.repeat(4)}</p>`;
    const { e, s } = setup(paragraph.repeat(2700));
    const t = performance.now();
    s.commands.setEnabled(true);
    expect(s.getState().analyzing).toBe(true);
    await vi.waitFor(() => expect(s.getState().analyzing).toBe(false), { timeout: 10000 });
    const full = performance.now() - t;
    expect(s.getState().readability?.words).toBeGreaterThan(150000);
    expect(s.getState().counts.repetition).toBeGreaterThan(50000);
    e.tiptap.commands.setTextSelection(5);
    e.tiptap.commands.insertContent('just ');
    vi.mocked(analyzeText).mockClear();
    s.commands.refresh();
    vi.mocked(visibleBlocks).mockReturnValue(null);
    expect(full).toBeLessThan(3000);
    expect(analyzeText).toHaveBeenCalledTimes(1);
  }, 20000);
});
