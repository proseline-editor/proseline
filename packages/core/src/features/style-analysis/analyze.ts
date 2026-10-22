import type { StyleCheck, StyleLexicon } from './lexicon.js';

export interface StyleIssue {
  check: StyleCheck;
  /** Offsets into the analyzed text. */
  from: number;
  to: number;
  /** The repeated word (repetition). */
  word?: string;
  /** Word count of the sentence (longSentence). */
  words?: number;
}

export interface TextAnalysis {
  issues: StyleIssue[];
  words: number;
  sentences: number;
  syllables: number;
}

export interface AnalyzeOptions {
  /** A sentence with more words than this is long. Default 30. */
  longSentence?: number;
  /** A word repeated within this many words is reported. Default 30. */
  repetitionWindow?: number;
  /** Shorter words are never reported as repetitions. Default 4. */
  minRepeatLength?: number;
}

interface Token {
  text: string;
  lower: string;
  from: number;
  to: number;
}

const WORD = /[\p{L}\p{M}\p{N}]+(?:['’\-‐][\p{L}\p{M}\p{N}]+)*/gu;
const SENTENCE_END = /[.!?…]+["'”»)\]]*(?=\s|$)/gu;

const tokenize = (text: string): Token[] =>
  [...text.matchAll(WORD)].map((m) => ({ text: m[0], lower: m[0].toLowerCase(), from: m.index, to: m.index + m[0].length }));

/** Sentence spans; a dot after a known abbreviation or a single letter does not end a sentence. */
const sentences = (text: string, abbreviations: Set<string>): { from: number; to: number }[] => {
  const out: { from: number; to: number }[] = [];
  let start = 0;
  for (const m of text.matchAll(SENTENCE_END)) {
    if (m[0].startsWith('.') && m[0].length === 1) {
      const before = /([\p{L}.]+)$/u.exec(text.slice(start, m.index))?.[1]?.toLowerCase() ?? '';
      if (abbreviations.has(before) || /^\p{L}$/u.test(before)) continue;
    }
    out.push({ from: start, to: m.index + m[0].length });
    start = m.index + m[0].length;
  }
  if (/[\p{L}\p{N}]/u.test(text.slice(start))) out.push({ from: start, to: text.length });
  return out.map((s) => {
    const lead = /^[\s"'“«([—–-]*/u.exec(text.slice(s.from, s.to))?.[0].length ?? 0;
    return { from: s.from + lead, to: s.to };
  });
};

/** Only whitespace between two tokens (so phrases do not match across punctuation). */
const adjacent = (text: string, a: Token, b: Token) => /^\s+$/u.test(text.slice(a.to, b.from));

const compiled = new WeakMap<StyleLexicon, { fillers: Map<string, string[][]>; stop: Set<string>; abbr: Set<string>; adverbEx: Set<string>; aux: Set<string>; participles: Set<string>; notParticiples: Set<string> }>();

const compile = (lexicon: StyleLexicon) => {
  let c = compiled.get(lexicon);
  if (c) return c;
  const fillers = new Map<string, string[][]>();
  for (const phrase of lexicon.fillers) {
    const words = phrase.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    const list = fillers.get(words[0]!) ?? [];
    list.push(words);
    fillers.set(words[0]!, list.sort((x, y) => y.length - x.length));
  }
  c = {
    fillers,
    stop: new Set(lexicon.stopWords),
    abbr: new Set((lexicon.abbreviations ?? []).map((a) => a.replace(/\.$/, ''))),
    adverbEx: new Set(lexicon.adverbs?.exceptions ?? []),
    aux: new Set(lexicon.passive?.auxiliaries ?? []),
    participles: new Set(lexicon.passive?.participles ?? []),
    notParticiples: new Set(lexicon.passive?.exceptions ?? []),
  };
  compiled.set(lexicon, c);
  return c;
};

const isAdverb = (lexicon: StyleLexicon, exceptions: Set<string>, word: string) =>
  !!lexicon.adverbs && !exceptions.has(word) && lexicon.adverbs.suffixes.some((s) => word.endsWith(s) && word.length >= s.length + 3);

/**
 * Analyzes one block of prose: filler words, adverbs, repetitions, long sentences and passive voice,
 * plus the word, sentence and syllable totals the readability score is computed from. Every check
 * runs; callers filter by the checks the writer has switched on.
 */
export const analyzeText = (text: string, lexicon: StyleLexicon, options: AnalyzeOptions = {}): TextAnalysis => {
  const { longSentence = 30, repetitionWindow = 30, minRepeatLength = 4 } = options;
  const c = compile(lexicon);
  const tokens = tokenize(text);
  const issues: StyleIssue[] = [];
  const fillerAt = new Set<number>();

  for (let i = 0; i < tokens.length; i++) {
    const phrases = c.fillers.get(tokens[i]!.lower);
    const hit = phrases?.find((p) => p.every((w, k) => tokens[i + k]?.lower === w && (k === 0 || adjacent(text, tokens[i + k - 1]!, tokens[i + k]!))));
    if (!hit) continue;
    issues.push({ check: 'filler', from: tokens[i]!.from, to: tokens[i + hit.length - 1]!.to });
    for (let k = 0; k < hit.length; k++) fillerAt.add(i + k);
    i += hit.length - 1;
  }

  tokens.forEach((t, i) => {
    if (!fillerAt.has(i) && isAdverb(lexicon, c.adverbEx, t.lower)) issues.push({ check: 'adverb', from: t.from, to: t.to });
  });

  if (lexicon.passive) {
    const { participleSuffixes } = lexicon.passive;
    const participle = (w: string) => c.participles.has(w) || (!c.notParticiples.has(w) && participleSuffixes.some((s) => w.endsWith(s) && w.length > s.length + 1));
    for (let i = 0; i < tokens.length - 1; i++) {
      if (!c.aux.has(tokens[i]!.lower)) continue;
      let j = i + 1;
      if (isAdverb(lexicon, c.adverbEx, tokens[j]!.lower) && tokens[j + 1]) j++;
      if (participle(tokens[j]!.lower) && adjacent(text, tokens[i]!, tokens[i + 1]!) && adjacent(text, tokens[j - 1]!, tokens[j]!)) {
        issues.push({ check: 'passive', from: tokens[i]!.from, to: tokens[j]!.to });
        i = j;
      }
    }
  }

  const lastSeen = new Map<string, number>();
  const reported = new Set<number>();
  tokens.forEach((t, i) => {
    if (t.lower.length < minRepeatLength || c.stop.has(t.lower) || /^\p{N}+$/u.test(t.lower)) return;
    const key = lexicon.stem ? lexicon.stem(t.lower) : t.lower;
    const prev = lastSeen.get(key);
    lastSeen.set(key, i);
    if (prev === undefined || i - prev > repetitionWindow) return;
    for (const k of [prev, i]) {
      if (reported.has(k)) continue;
      reported.add(k);
      issues.push({ check: 'repetition', from: tokens[k]!.from, to: tokens[k]!.to, word: tokens[prev]!.lower });
    }
  });

  let sentenceCount = 0;
  for (const s of sentences(text, c.abbr)) {
    const words = tokens.filter((t) => t.from >= s.from && t.to <= s.to).length;
    if (!words) continue;
    sentenceCount++;
    if (words > longSentence) issues.push({ check: 'longSentence', from: s.from, to: s.to, words });
  }

  issues.sort((a, b) => a.from - b.from || b.to - a.to);
  return { issues, words: tokens.length, sentences: sentenceCount, syllables: tokens.reduce((n, t) => n + lexicon.syllables(t.lower), 0) };
};

export type ReadabilityLevel = 'veryEasy' | 'easy' | 'standard' | 'fairlyHard' | 'hard' | 'veryHard';

export interface Readability {
  /** 0–100; higher is easier. */
  score: number;
  level: ReadabilityLevel;
  words: number;
  sentences: number;
}

/** Below this many words a score says nothing. */
export const MIN_READABILITY_WORDS = 30;

/** The lexicon's Flesch-style score for the given totals, or null for too little text. */
export const readability = (totals: { words: number; sentences: number; syllables: number }, lexicon: StyleLexicon): Readability | null => {
  const { words, sentences: count, syllables } = totals;
  if (words < MIN_READABILITY_WORDS || count === 0) return null;
  const r = lexicon.readability;
  const raw = r.base - r.perWordsPerSentence * (words / count) - r.perSyllablesPerWord * (syllables / words);
  const score = Math.round(Math.min(100, Math.max(0, raw)));
  const level: ReadabilityLevel = score >= 90 ? 'veryEasy' : score >= 70 ? 'easy' : score >= 60 ? 'standard' : score >= 50 ? 'fairlyHard' : score >= 30 ? 'hard' : 'veryHard';
  return { score, level, words, sentences: count };
};
