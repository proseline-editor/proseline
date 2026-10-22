import { describe, it, expect } from 'vitest';
import { relativeTime } from './relative-time.js';

describe('relativeTime', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  it('picks the largest unit and words it in the locale', () => {
    expect(relativeTime('2026-10-20T11:55:00Z', 'en', now)).toBe('5 minutes ago');
    expect(relativeTime('2026-10-19T12:00:00Z', 'en', now)).toBe('yesterday');
    expect(relativeTime('2026-10-20T11:59:59Z', 'uk', now)).toBe('зараз');
  });
});
