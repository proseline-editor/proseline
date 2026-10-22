import { describe, it, expect } from 'vitest';
import { createTranslator } from './i18n.js';

const bundles = {
  en: { 'a.hello': 'Hello, {name}!', 'a.words.one': '{count} word', 'a.words.other': '{count} words', 'a.only': 'English only' },
  uk: {
    'a.hello': 'Привіт, {name}!',
    'a.words.one': '{count} слово',
    'a.words.few': '{count} слова',
    'a.words.many': '{count} слів',
    'a.words.other': '{count} слова',
  },
};

describe('createTranslator', () => {
  it('interpolates variables', () => {
    const t = createTranslator('uk', [bundles]);
    expect(t('a.hello', { name: 'Оксано' })).toBe('Привіт, Оксано!');
  });

  it('falls back to English, then to the key', () => {
    const t = createTranslator('uk', [bundles]);
    expect(t('a.only')).toBe('English only');
    expect(t('a.missing')).toBe('a.missing');
  });

  it('lets later bundles override earlier ones', () => {
    const t = createTranslator('en', [bundles, { en: { 'a.hello': 'Hi {name}' } }]);
    expect(t('a.hello', { name: 'Ann' })).toBe('Hi Ann');
  });

  it('picks the plural form with Intl.PluralRules', () => {
    const t = createTranslator('uk', [bundles]);
    expect(t.plural('a.words', 1)).toBe('1 слово');
    expect(t.plural('a.words', 3)).toBe('3 слова');
    expect(t.plural('a.words', 5)).toBe('5 слів');
    const en = createTranslator('en', [bundles]);
    expect(en.plural('a.words', 2)).toBe('2 words');
  });

  it('falls back to the .other plural form', () => {
    const t = createTranslator('en', [{ en: { 'b.items.other': '{count} items' } }]);
    expect(t.plural('b.items', 1)).toBe('1 items');
  });
});
