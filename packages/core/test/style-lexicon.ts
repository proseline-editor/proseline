import type { StyleLexicon } from '../src/features/style-analysis/lexicon.js';

/** A tiny English lexicon for core tests (the real ones live in @proseline-editor/lexicons). */
export const testLexicon: StyleLexicon = {
  locale: 'en',
  fillers: ['just', 'really', 'very', 'kind of', 'sort of'],
  stopWords: ['the', 'and', 'that', 'with', 'they', 'were', 'have', 'this', 'from'],
  abbreviations: ['mr', 'mrs', 'dr', 'e.g'],
  adverbs: { suffixes: ['ly'], exceptions: ['only', 'family', 'early', 'reply'] },
  passive: { auxiliaries: ['is', 'are', 'was', 'were', 'be', 'been', 'being'], participles: ['taken', 'seen', 'written', 'given'], participleSuffixes: ['ed'] },
  syllables: (w) => Math.max(1, (w.match(/[aeiouy]+/g) ?? []).length - (/[^l]e$/.test(w) ? 1 : 0)),
  readability: { base: 206.835, perWordsPerSentence: 1.015, perSyllablesPerWord: 84.6 },
};
