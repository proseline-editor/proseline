import { describe, it, expect } from 'vitest';
import { sentenceRange } from './sentence.js';

describe('sentenceRange', () => {
  const text = 'First one. Second one! Third?';

  it('finds the sentence around an offset', () => {
    expect(sentenceRange(text, 3)).toEqual([0, 10]);
    expect(sentenceRange(text, 14)).toEqual([11, 22]);
    expect(sentenceRange(text, text.length)).toEqual([23, 29]);
  });

  it('treats the offset right after a terminator as the end of that sentence', () => {
    expect(sentenceRange(text, 10)).toEqual([0, 10]);
  });

  it('handles ellipses, closing quotes and text without terminators', () => {
    expect(sentenceRange('Wait… «Go!» Now', 13)).toEqual([12, 15]);
    expect(sentenceRange('Wait… «Go!» Now', 8)).toEqual([6, 11]);
    expect(sentenceRange('no end here', 4)).toEqual([0, 11]);
  });
});
