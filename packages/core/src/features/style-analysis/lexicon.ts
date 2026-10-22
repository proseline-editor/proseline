/** Checks the style analysis can run. A lexicon without `adverbs` or `passive` simply skips those. */
export type StyleCheck = 'filler' | 'adverb' | 'repetition' | 'longSentence' | 'passive';

export const STYLE_CHECKS: readonly StyleCheck[] = ['filler', 'adverb', 'repetition', 'longSentence', 'passive'];

/** Language data for the style analysis. All word lists are lowercase. */
export interface StyleLexicon {
  locale: string;
  /** Filler words and phrases ("just", "kind of"). */
  fillers: string[];
  /** Words never reported as repetitions (articles, pronouns, auxiliaries…). */
  stopWords: string[];
  /** Words ending with a dot that do not end a sentence ("mr", "e.g"). */
  abbreviations?: string[];
  /** Adverb detection by suffix ("-ly", "-ment"); omit where suffixes are unreliable. */
  adverbs?: { suffixes: string[]; exceptions: string[] };
  /** Passive voice: an auxiliary followed (optionally after one adverb) by a participle; `exceptions` look like participles but are not ("indeed"). */
  passive?: { auxiliaries: string[]; participles: string[]; participleSuffixes: string[]; exceptions?: string[] };
  /** Reduces inflected forms to one key so "дорога" and "дороги" count as a repetition. */
  stem?: (word: string) => string;
  syllables: (word: string) => number;
  /** Flesch-style formula: base − perWordsPerSentence × words/sentences − perSyllablesPerWord × syllables/words. */
  readability: { base: number; perWordsPerSentence: number; perSyllablesPerWord: number };
}

export interface LexiconExtension {
  fillers?: string[];
  stopWords?: string[];
  abbreviations?: string[];
  adverbExceptions?: string[];
  /** Words to drop from the filler list. */
  ignore?: string[];
}

/** A copy of `base` with the host's own words added (or, via `ignore`, filler words removed). */
export const extendLexicon = (base: StyleLexicon, extra: LexiconExtension): StyleLexicon => {
  const ignore = new Set((extra.ignore ?? []).map((w) => w.toLowerCase()));
  const lower = (list: string[] | undefined) => (list ?? []).map((w) => w.toLowerCase());
  return {
    ...base,
    fillers: [...base.fillers, ...lower(extra.fillers)].filter((w) => !ignore.has(w)),
    stopWords: [...base.stopWords, ...lower(extra.stopWords)],
    abbreviations: [...(base.abbreviations ?? []), ...lower(extra.abbreviations)],
    ...(base.adverbs ? { adverbs: { ...base.adverbs, exceptions: [...base.adverbs.exceptions, ...lower(extra.adverbExceptions)] } } : {}),
  };
};

/** The checks a lexicon supports. */
export const availableChecks = (lexicon: StyleLexicon): StyleCheck[] =>
  STYLE_CHECKS.filter((c) => (c === 'adverb' ? !!lexicon.adverbs : c === 'passive' ? !!lexicon.passive : true));
