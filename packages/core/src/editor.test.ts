import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Transaction } from '@tiptap/pm/state';
import { createEditor, type ProselineEditor } from './editor.js';
import { createEditorController, defineFeature } from './feature.js';
import { NO_WORD_COUNT } from './words.js';
import { typeText, caretToEnd } from '../test/helpers.js';

const counterFeature = defineFeature({
  name: 'counter',
  messages: { en: { 'counter.label': 'Words: {count}' }, uk: { 'counter.label': 'Слів: {count}' } },
  controller: (ctx) =>
    createEditorController(ctx.editor, () => ({ words: ctx.countDoc().words }), {
      label: () => ctx.t('counter.label', { count: ctx.countDoc().words }),
    }),
});

declare module './index.js' {
  interface FeatureRegistry {
    counter: ReturnType<NonNullable<typeof counterFeature.controller>>;
  }
}

let editor: ProselineEditor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  vi.useRealTimers();
});

describe('createEditor', () => {
  it('loads content and exposes HTML, JSON and text', () => {
    editor = createEditor({ content: '<p>Hello world</p>' });
    expect(editor.getHTML()).toBe('<p>Hello world</p>');
    expect(editor.getText()).toBe('Hello world');
    expect(editor.getJSON().type).toBe('doc');
  });

  it('builds feature controllers and returns undefined for absent features', () => {
    editor = createEditor({ content: '<p>One two</p>', features: [counterFeature] });
    expect(editor.feature('counter')?.getState()).toEqual({ words: 2 });
    expect(editor.hasFeature('counter')).toBe(true);
    expect(editor.hasFeature('nope')).toBe(false);
  });

  it('recomputes controller state after transactions', () => {
    editor = createEditor({ content: '<p>One</p>', features: [counterFeature] });
    const listener = vi.fn();
    editor.feature('counter')?.subscribe(listener);
    caretToEnd(editor.tiptap);
    typeText(editor.tiptap, ' two');
    expect(editor.feature('counter')?.getState().words).toBe(2);
    expect(listener).toHaveBeenCalled();
  });

  it('rejects duplicate features', () => {
    expect(() => createEditor({ features: [counterFeature, counterFeature] })).toThrow(/configured twice/);
  });

  it('translates with feature messages and host overrides', () => {
    editor = createEditor({ content: '<p>a b c</p>', locale: 'uk', features: [counterFeature] });
    expect(editor.feature('counter')?.commands.label()).toBe('Слів: 3');
    editor.destroy();
    editor = createEditor({ content: '<p>a</p>', locale: 'uk', features: [counterFeature], messages: { 'counter.label': 'Σ {count}' } });
    expect(editor.feature('counter')?.commands.label()).toBe('Σ 1');
  });

  it('ships translated toolbar strings', () => {
    editor = createEditor({ locale: 'uk' });
    expect(editor.t('toolbar.bold')).toBe('Жирний');
    expect(editor.t('toolbar.heading', { level: 2 })).toBe('Заголовок 2');
  });

  it('debounces onChange and the change event', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const onEvent = vi.fn();
    editor = createEditor({ content: '<p>a</p>', onChange, changeDebounceMs: 300 });
    editor.on('change', onEvent);
    caretToEnd(editor.tiptap);
    typeText(editor.tiptap, 'bc');
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({ html: '<p>abc</p>' });
  });

  it('flushes a pending change on destroy', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    editor = createEditor({ content: '<p>a</p>', onChange });
    caretToEnd(editor.tiptap);
    typeText(editor.tiptap, 'b');
    editor.destroy();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('emits wordsTyped for own typing only', () => {
    editor = createEditor({ content: '<p>One</p>' });
    const deltas: number[] = [];
    editor.on('wordsTyped', ({ delta }) => deltas.push(delta));
    caretToEnd(editor.tiptap);
    typeText(editor.tiptap, ' two three');
    const tiptap = editor.tiptap;
    tiptap.view.dispatch(tiptap.state.tr.insertText(' pasted words', tiptap.state.selection.from).setMeta('uiEvent', 'paste'));
    tiptap.view.dispatch(tiptap.state.tr.insertText(' restored', tiptap.state.selection.from).setMeta(NO_WORD_COUNT, true));
    expect(deltas.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it('drops the built-in history when a feature provides its own', () => {
    editor = createEditor({ content: '<p>a</p>', features: [defineFeature({ name: 'ownHistory', providesHistory: true })] });
    expect(editor.tiptap.extensionManager.extensions.some((e) => e.name === 'undoRedo')).toBe(false);
    editor.destroy();
    editor = createEditor({ content: '<p>a</p>' });
    expect(editor.tiptap.extensionManager.extensions.some((e) => e.name === 'undoRedo')).toBe(true);
  });

  it('does not count transactions a feature marks as remote', () => {
    const remote = defineFeature({ name: 'remote', isRemoteTransaction: (tr) => tr.getMeta('fromPeer') === true });
    editor = createEditor({ content: '<p>One</p>', features: [remote] });
    const deltas: number[] = [];
    editor.on('wordsTyped', ({ delta }) => deltas.push(delta));
    const tiptap = editor.tiptap;
    tiptap.view.dispatch(tiptap.state.tr.insertText(' peer words', 4).setMeta('fromPeer', true));
    caretToEnd(tiptap);
    typeText(tiptap, ' mine');
    expect(deltas).toEqual([1]);
  });

  it('lets features ask whether a transaction is remote', () => {
    let isRemote: ((tr: Transaction) => boolean) | null = null;
    const remote = defineFeature({ name: 'remote', isRemoteTransaction: (tr) => tr.getMeta('fromPeer') === true });
    const probe = defineFeature({
      name: 'probe',
      controller: (ctx) => {
        isRemote = ctx.isRemote;
        return { getState: () => null, subscribe: () => () => undefined, commands: {} };
      },
    });
    editor = createEditor({ content: '<p>x</p>', features: [remote, probe] });
    expect(isRemote!(editor.tiptap.state.tr.setMeta('fromPeer', true))).toBe(true);
    expect(isRemote!(editor.tiptap.state.tr)).toBe(false);
  });

  it('toggles editability', () => {
    editor = createEditor({ content: '<p>a</p>', editable: false });
    expect(editor.isEditable).toBe(false);
    editor.setEditable(true);
    expect(editor.isEditable).toBe(true);
  });

  it('isolates a throwing event handler', () => {
    const onError = vi.fn();
    editor = createEditor({ content: '<p>a</p>', onError });
    const good = vi.fn();
    editor.on('wordsTyped', () => {
      throw new Error('boom');
    });
    editor.on('wordsTyped', good);
    caretToEnd(editor.tiptap);
    typeText(editor.tiptap, ' b');
    expect(good).toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });
});
