import type { MentionItem } from '@proseline-editor/core/features';

export const SAMPLE = `
<h1>Chapter One</h1>
<p>The rain had not stopped for three days. Mara stood at the window and counted the boats in the harbour.</p>
<p>"They will come tonight," said the old man. "Or they will not come at all."</p>
<hr>
<p data-style="letter">Dear brother, the city is quieter than you remember.</p>
<p>The news reached <span data-mention-id="gordiy" data-kind="character" data-label="Ґордієві" data-case="dat">Ґордієві</span> before the <span data-mention-id="guild" data-kind="faction" data-label="Salt Guild">Salt Guild</span> heard of it.</p>
`;

/** Entities for @-mentions. A host would load these from its own data, with case forms where the language has them. */
export const ENTITIES: MentionItem[] = [
  { id: 'mara', label: 'Mara', kind: 'character' },
  { id: 'gordiy', label: 'Ґордій', kind: 'character', forms: { base: 'Ґордій', gen: 'Ґордія', dat: 'Ґордієві', acc: 'Ґордія', ins: 'Ґордієм', loc: 'Ґордієві', voc: 'Ґордію' } },
  { id: 'harbour', label: 'The Harbour', kind: 'location' },
  { id: 'guild', label: 'Salt Guild', kind: 'faction' },
];

/** About `words` words of filler prose, split into paragraphs — for the performance check. */
export const bigDocument = (words: number): string => {
  const sentence = 'The quick brown fox jumps over the lazy dog near the quiet river bank. ';
  const perParagraph = 50;
  const paragraph = `<p>${sentence.repeat(Math.ceil(perParagraph / 14)).trim()}</p>`;
  return paragraph.repeat(Math.ceil(words / 56));
};
