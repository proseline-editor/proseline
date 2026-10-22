import { describe, it, expect } from 'vitest';
import { caseOptions, isStale, mentionText } from './name-forms.js';
import { matchMentionItems, staticMentionProvider } from './provider.js';

const gordiy = { name: 'Ґордій', forms: { base: 'Ґордій', gen: 'Ґордія', dat: 'Ґордієві', voc: 'Ґордію' } };

describe('name forms', () => {
  it('shows the name for the nominative and the form for a case', () => {
    expect(mentionText(gordiy, null)).toEqual({ text: 'Ґордій', missing: false });
    expect(mentionText(gordiy, 'dat')).toEqual({ text: 'Ґордієві', missing: false });
  });

  it('falls back to the name, flagged, when a form is missing or stale', () => {
    expect(mentionText(gordiy, 'ins')).toEqual({ text: 'Ґордій', missing: true });
    const renamed = { name: 'Ґордій Майстер', forms: gordiy.forms };
    expect(isStale(renamed.forms, renamed.name)).toBe(true);
    expect(mentionText(renamed, 'dat')).toEqual({ text: 'Ґордій Майстер', missing: true });
    expect(mentionText(null, 'dat')).toBeNull();
  });

  it('lists the usable cases', () => {
    expect(caseOptions(gordiy)).toEqual([null, 'gen', 'dat', 'voc']);
    expect(caseOptions({ name: 'X' })).toEqual([null]);
  });
});

describe('matchMentionItems', () => {
  const items = [
    { id: 'g', label: 'Ґордій', kind: 'character', forms: gordiy.forms },
    { id: 'm', label: 'Мара', kind: 'character' },
    { id: 'h', label: 'Гавань', kind: 'place' },
  ];

  it('matches names, then case forms (remembering the case)', () => {
    expect(matchMentionItems(items, 'ма').map((i) => [i.id, i.matchedCase])).toEqual([['m', null]]);
    expect(matchMentionItems(items, 'єві').map((i) => [i.id, i.matchedCase])).toEqual([['g', 'dat']]);
    expect(matchMentionItems(items, '')).toHaveLength(3);
    expect(matchMentionItems(items, '', 2)).toHaveLength(2);
  });

  it('backs a static provider that notifies on changes', () => {
    const provider = staticMentionProvider(items);
    let changes = 0;
    provider.subscribe!(() => changes++);
    expect(provider.resolve('g')).toEqual({ name: 'Ґордій', forms: gordiy.forms });
    provider.setItems(items.slice(1));
    expect(provider.resolve('g')).toBeNull();
    expect(changes).toBe(1);
  });
});
