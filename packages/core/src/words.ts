import type { Node as PMNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';

/** Transaction meta: this change is not the writer's own typing (restore, import, remote…). */
export const NO_WORD_COUNT = 'proseline:noWordCount';

export interface DocCounts {
  words: number;
  characters: number;
  charactersNoSpaces: number;
}

const WORD = /[\p{L}\p{N}]/u;

/** Whitespace-separated tokens that contain at least one letter or digit (so "—" is not a word). */
export const countTextWords = (text: string): number => {
  let words = 0;
  for (const token of text.split(/\s+/)) if (WORD.test(token)) words++;
  return words;
};

/** Text of an inline leaf: its schema's leafText (a mention's name), otherwise a separating space (hard break). */
export const leafText = (leaf: PMNode): string => leaf.type.spec.leafText?.(leaf) ?? ' ';

const countBlock = (node: PMNode): DocCounts => {
  // Nested blocks become spaces so they separate words; leaves contribute their text.
  const text = node.textBetween(0, node.content.size, ' ', leafText);
  return {
    words: countTextWords(text),
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
  };
};

/**
 * Returns a counter that caches per top-level block. ProseMirror reuses unchanged nodes between
 * documents, so after an edit only the touched blocks are recounted — O(blocks) lookups instead of
 * re-tokenizing a whole novel on every keystroke.
 */
export const createDocCounter = (): ((doc: PMNode) => DocCounts) => {
  const cache = new WeakMap<PMNode, DocCounts>();
  return (doc) => {
    const total: DocCounts = { words: 0, characters: 0, charactersNoSpaces: 0 };
    let blocks = 0;
    doc.forEach((block) => {
      let counts = cache.get(block);
      if (!counts) {
        counts = countBlock(block);
        cache.set(block, counts);
      }
      total.words += counts.words;
      total.characters += counts.characters;
      total.charactersNoSpaces += counts.charactersNoSpaces;
      blocks++;
    });
    // One separator character between blocks, matching textBetween(…, ' ').
    if (blocks > 1) total.characters += blocks - 1;
    return total;
  };
};

/**
 * True only for the writer's own typing: not pastes/drops and not transactions tagged with
 * NO_WORD_COUNT. Features exclude more via `Feature.isRemoteTransaction` (co-authors' changes).
 * Undo counts, so type-then-undo nets to zero.
 */
export const isTypingTransaction = (tr: Transaction): boolean => {
  if (!tr.docChanged) return false;
  const ui = tr.getMeta('uiEvent') as string | undefined;
  if (ui === 'paste' || ui === 'drop') return false;
  return !tr.getMeta(NO_WORD_COUNT);
};
