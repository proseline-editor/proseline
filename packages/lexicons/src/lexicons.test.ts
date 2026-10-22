import { describe, it, expect } from 'vitest';
import { analyzeText, readability, type StyleLexicon } from '@proseline-editor/core/features';
import { en } from './en.js';
import { uk } from './uk.js';
import { fr } from './fr.js';

const found = (lexicon: StyleLexicon, text: string) =>
  analyzeText(text, lexicon).issues.filter((i) => i.check !== 'longSentence').map((i) => `${i.check}:${text.slice(i.from, i.to)}`);

describe('en', () => {
  it('finds fillers, adverbs and passive voice without the usual false positives', () => {
    expect(found(en, 'She was just kind of tired. He walked slowly into the early fog. The letter was written by Mr. Grey, indeed.')).toEqual([
      'filler:just',
      'filler:kind of',
      'adverb:slowly',
      'passive:was written',
    ]);
  });

  it('counts syllables for Flesch Reading Ease', () => {
    expect(['cat', 'table', 'reading', 'beautiful', 'created', 'yellow'].map(en.syllables)).toEqual([1, 2, 2, 3, 2, 2]);
  });
});

describe('uk', () => {
  it('finds fillers and repetitions across inflected forms', () => {
    expect(found(uk, 'Він просто йшов дорогою. Дорога, так би мовити, вела додому, і дороги не було видно.')).toEqual([
      'filler:просто',
      'repetition:дорогою',
      'repetition:Дорога',
      'filler:так би мовити',
      'repetition:дороги',
    ]);
  });

  it('counts a syllable per vowel and has no adverb or passive check', () => {
    expect(['кіт', 'дорога', 'їжак', 'українська'].map(uk.syllables)).toEqual([1, 3, 2, 4]);
    expect(uk.adverbs).toBeUndefined();
    expect(uk.passive).toBeUndefined();
  });
});

describe('fr', () => {
  it('finds fillers and -ment adverbs, not -ment nouns', () => {
    expect(found(fr, 'Il marchait lentement vers le bâtiment, un peu fatigué. En fait, le moment était vraiment venu.')).toEqual([
      'adverb:lentement',
      'filler:un peu',
      'filler:En fait',
      'filler:vraiment',
    ]);
  });

  it('drops a silent final e when counting syllables', () => {
    expect(['chat', 'table', 'parlent', 'école', 'beau'].map(fr.syllables)).toEqual([1, 1, 1, 2, 1]);
  });
});

describe('readability', () => {
  it('rates simple prose as easier than dense prose in every language', () => {
    const simple = { en: 'The cat sat. The dog ran. ', uk: 'Кіт сів. Пес біг. ', fr: 'Le chat dort. Le chien court. ' };
    const dense = {
      en: 'Notwithstanding considerable organizational complexity, institutional representatives systematically deliberated alternative implementation methodologies. ',
      uk: 'Незважаючи на значну організаційну складність, інституційні представники систематично обговорювали альтернативні методології впровадження. ',
      fr: 'Nonobstant une considérable complexité organisationnelle, les représentants institutionnels délibéraient systématiquement sur des méthodologies alternatives. ',
    };
    for (const lexicon of [en, uk, fr]) {
      const score = (text: string) => {
        const a = analyzeText(text.repeat(8), lexicon);
        return readability(a, lexicon)!.score;
      };
      const loc = lexicon.locale as keyof typeof simple;
      expect(score(simple[loc])).toBeGreaterThan(80);
      expect(score(dense[loc])).toBeLessThan(30);
    }
  });
});
