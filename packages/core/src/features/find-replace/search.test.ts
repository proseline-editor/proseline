import { describe, it, expect } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { buildPattern, findMatches, expandReplacement } from './search.js';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*', toDOM: () => ['p', 0] },
    hardBreak: { group: 'inline', inline: true, toDOM: () => ['br'] },
    text: { group: 'inline' },
  },
});
const doc = (...paras: string[]) => schema.node('doc', null, paras.map((t) => schema.node('paragraph', null, t ? [schema.text(t)] : [])));
const base = { caseSensitive: false, wholeWord: false, regex: false };
const texts = (d: ReturnType<typeof doc>, ms: { from: number; to: number }[]) => ms.map((m) => d.textBetween(m.from, m.to));

describe('buildPattern', () => {
  it('escapes plain terms', () => {
    expect(buildPattern({ ...base, term: 'a.b' })).toEqual({ pattern: /a\.b/giu, error: null });
  });
  it('reports an invalid regex instead of throwing', () => {
    expect(buildPattern({ ...base, regex: true, term: '(' })).toEqual({ pattern: null, error: 'invalidRegex' });
  });
  it('returns no pattern for an empty term', () => {
    expect(buildPattern({ ...base, term: '' })).toEqual({ pattern: null, error: null });
  });
});

describe('findMatches', () => {
  it('finds case-insensitive matches across paragraphs with document positions', () => {
    const d = doc('Cat cat', 'concatenate');
    const ms = findMatches(d, { ...base, term: 'cat' });
    expect(ms).toEqual([{ from: 1, to: 4 }, { from: 5, to: 8 }, { from: 13, to: 16 }]);
    expect(texts(d, ms)).toEqual(['Cat', 'cat', 'cat']);
  });

  it('honours case sensitivity and whole words (Unicode-aware)', () => {
    const d = doc('Кіт кіт кітель');
    expect(texts(d, findMatches(d, { ...base, term: 'кіт', caseSensitive: true }))).toEqual(['кіт', 'кіт']);
    expect(findMatches(d, { ...base, term: 'кіт', wholeWord: true })).toHaveLength(2);
  });

  it('supports regex and skips empty matches', () => {
    const d = doc('a1 b22 c');
    expect(texts(d, findMatches(d, { ...base, regex: true, term: '\\d+' }))).toEqual(['1', '22']);
    expect(findMatches(d, { ...base, regex: true, term: 'x*' })).toEqual([]);
  });

  it('does not match across a hard break', () => {
    const d = schema.node('doc', null, [schema.node('paragraph', null, [schema.text('ab'), schema.node('hardBreak'), schema.text('cd')])]);
    expect(findMatches(d, { ...base, term: 'bc' })).toEqual([]);
    expect(findMatches(d, { ...base, term: 'cd' })).toEqual([{ from: 4, to: 6 }]);
  });

  it('limits matches to a range', () => {
    const d = doc('cat cat cat');
    expect(findMatches(d, { ...base, term: 'cat' }, { from: 4, to: 12 })).toEqual([{ from: 5, to: 8 }, { from: 9, to: 12 }]);
  });
});

describe('expandReplacement', () => {
  it('returns the literal replacement in plain mode', () => {
    expect(expandReplacement('cat', { ...base, term: 'cat' }, '$1')).toBe('$1');
  });
  it('expands groups in regex mode', () => {
    expect(expandReplacement('John Smith', { ...base, regex: true, term: '(\\w+) (\\w+)' }, '$2, $1')).toBe('Smith, John');
  });
});
