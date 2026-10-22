/** Sentence terminators followed by optional closing quotes/brackets. */
const END = /[.!?…]+["'»”’)\]]*/gu;

/**
 * [start, end) of the sentence containing `offset` within a block's text. A sentence ends after
 * its terminator (and closing quotes); leading whitespace belongs to no sentence.
 */
export const sentenceRange = (text: string, offset: number): [number, number] => {
  let start = 0;
  END.lastIndex = 0;
  for (let m = END.exec(text); m; m = END.exec(text)) {
    const end = m.index + m[0].length;
    if (offset <= end) return [start, end];
    start = end;
    while (start < text.length && /\s/u.test(text[start] as string)) start++;
  }
  return [start, text.length];
};
