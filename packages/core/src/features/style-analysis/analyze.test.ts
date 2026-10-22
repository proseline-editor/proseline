import { describe, it, expect } from 'vitest';
import { testLexicon as en } from '../../../test/style-lexicon.js';
import { analyzeText, readability } from './analyze.js';
import { availableChecks, extendLexicon } from './lexicon.js';

const marked = (text: string, check: string, opts = {}, passive: { exceptions?: string[] } = {}) =>
  analyzeText(text, { ...en, passive: { ...en.passive!, ...passive } }, opts).issues.filter((i) => i.check === check).map((i) => text.slice(i.from, i.to));

describe('analyzeText', () => {
  it('finds filler words and phrases, matching phrases only across spaces', () => {
    expect(marked('She was just kind of tired, really.', 'filler')).toEqual(['just', 'kind of', 'really']);
    expect(marked('A kind, of course.', 'filler')).toEqual([]);
  });

  it('finds adverbs by suffix, skipping exceptions and fillers', () => {
    expect(marked('He walked slowly and only quietly.', 'adverb')).toEqual(['slowly', 'quietly']);
    expect(marked('It was really fly.', 'adverb')).toEqual([]);
  });

  it('finds passive voice, also with an adverb in between', () => {
    expect(marked('The letter was written. The door was quickly opened. She was happy.', 'passive')).toEqual(['was written', 'was quickly opened']);
    expect(marked('It was indeed late.', 'passive', {}, { exceptions: ['indeed'] })).toEqual([]);
  });

  it('reports words repeated within the window, both occurrences once', () => {
    const text = 'The harbour was quiet. Boats left the harbour at dawn, and the harbour slept.';
    expect(marked(text, 'repetition')).toEqual(['harbour', 'harbour', 'harbour']);
    expect(marked(text, 'repetition', { repetitionWindow: 3 })).toEqual([]);
    expect(marked('The the the cat sat with the dog.', 'repetition')).toEqual([]);
  });

  it('uses the lexicon stem to catch inflected repetitions', () => {
    const stemmed = { ...en, stem: (w: string) => w.replace(/s$/, '') };
    expect(analyzeText('One boat, two boats.', stemmed).issues.map((i) => i.check)).toEqual(['repetition', 'repetition']);
  });

  it('finds long sentences, not splitting at abbreviations', () => {
    const long = `Mr. Grey said ${'word '.repeat(10)}today.`;
    const issues = analyzeText(`${long} Short one.`, en, { longSentence: 10 }).issues.filter((i) => i.check === 'longSentence');
    expect(issues).toEqual([{ check: 'longSentence', from: 0, to: long.length, words: 14 }]);
  });

  it('counts words, sentences and syllables', () => {
    expect(analyzeText('“Go home.” She went. Then — nothing', en)).toMatchObject({ words: 6, sentences: 3 });
    expect(analyzeText('', en)).toEqual({ issues: [], words: 0, sentences: 0, syllables: 0 });
  });
});

describe('readability', () => {
  it('scores with the lexicon formula and needs enough words', () => {
    expect(readability({ words: 10, sentences: 1, syllables: 12 }, en)).toBeNull();
    expect(readability({ words: 100, sentences: 10, syllables: 130 }, en)).toEqual({ score: 87, level: 'easy', words: 100, sentences: 10 });
    expect(readability({ words: 100, sentences: 2, syllables: 200 }, en)?.level).toBe('veryHard');
  });
});

describe('lexicons', () => {
  it('extends a lexicon and lists the checks it supports', () => {
    const ext = extendLexicon(en, { fillers: ['Basically'], ignore: ['very'], adverbExceptions: ['holy'] });
    expect(ext.fillers).toContain('basically');
    expect(ext.fillers).not.toContain('very');
    expect(ext.adverbs?.exceptions).toContain('holy');
    expect(availableChecks(en)).toEqual(['filler', 'adverb', 'repetition', 'longSentence', 'passive']);
    expect(availableChecks({ ...en, adverbs: undefined, passive: undefined })).toEqual(['filler', 'repetition', 'longSentence']);
  });
});
