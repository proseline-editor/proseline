import { describe, it, expect, vi } from 'vitest';
import { Node as PMNode, Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { countTextWords, createDocCounter, isTypingTransaction, NO_WORD_COUNT } from './words.js';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*', toDOM: () => ['p', 0] },
    hardBreak: { group: 'inline', inline: true, toDOM: () => ['br'] },
    text: { group: 'inline' },
  },
});
const p = (text: string) => schema.node('paragraph', null, text ? [schema.text(text)] : []);

describe('countTextWords', () => {
  it('counts tokens containing a letter or digit', () => {
    expect(countTextWords('Hello, world')).toBe(2);
    expect(countTextWords('Він сказав — і пішов.')).toBe(4); // the dash is not a word
    expect(countTextWords('п’ять 2026 don\'t')).toBe(3);
    expect(countTextWords('   ')).toBe(0);
  });
});

describe('createDocCounter', () => {
  it('counts words and characters, separating blocks', () => {
    const count = createDocCounter();
    const doc = schema.node('doc', null, [p('One two'), p('three')]);
    expect(count(doc)).toEqual({ words: 3, characters: 13, charactersNoSpaces: 11 });
  });

  it('treats a hard break as a separator', () => {
    const count = createDocCounter();
    const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text('a'), schema.node('hardBreak'), schema.text('b')])]);
    expect(count(doc).words).toBe(2);
  });

  it('recounts only the edited block', () => {
    const count = createDocCounter();
    const blocks = Array.from({ length: 3000 }, (_, i) => p(`Paragraph number ${i} has some words in it`));
    const doc = schema.node('doc', null, blocks);
    expect(count(doc).words).toBe(3000 * 8);
    const tr = EditorState.create({ doc }).tr.insertText('extra ', 1);
    // Each block is tokenized through one textBetween call; unchanged blocks must come from the cache.
    const tokenized = vi.spyOn(PMNode.prototype, 'textBetween');
    expect(count(tr.doc).words).toBe(3000 * 8 + 1);
    expect(tokenized).toHaveBeenCalledTimes(1);
    tokenized.mockRestore();
  });
});

describe('isTypingTransaction', () => {
  const state = EditorState.create({ doc: schema.node('doc', null, [p('Hi')]) });

  it('is true for a plain text insertion', () => {
    expect(isTypingTransaction(state.tr.insertText('!', 3))).toBe(true);
  });

  it('is false when the document did not change', () => {
    expect(isTypingTransaction(state.tr.setSelection(TextSelection.create(state.doc, 1)))).toBe(false);
  });

  it('is false for paste, drop and tagged transactions', () => {
    expect(isTypingTransaction(state.tr.insertText('x', 3).setMeta('uiEvent', 'paste'))).toBe(false);
    expect(isTypingTransaction(state.tr.insertText('x', 3).setMeta('uiEvent', 'drop'))).toBe(false);
    expect(isTypingTransaction(state.tr.insertText('x', 3).setMeta(NO_WORD_COUNT, true))).toBe(false);
  });
});
