import { describe, it, expect, vi, afterEach } from 'vitest';
import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { createEditor, type ProselineEditor } from '../../editor.js';
import { defineFeature } from '../../feature.js';
import { versions, type VersionsOptions } from './index.js';
import { memoryVersionStore } from './memory-store.js';
import type { VersionStore } from './types.js';

let editor: ProselineEditor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  vi.useRealTimers();
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const setup = async (html: string, opts: Partial<VersionsOptions> = {}, extra: Parameters<typeof createEditor>[0] = {}) => {
  const store = opts.store ?? memoryVersionStore();
  editor = createEditor({ content: html, ...extra, features: [versions({ store, docId: 'doc-1', autoSnapshotMs: false, ...opts }), ...(extra.features ?? [])] });
  await flush();
  return { e: editor, v: editor.feature('versions')!, store };
};

const typeAtEnd = (e: ProselineEditor, text: string) => e.tiptap.commands.insertContentAt(e.tiptap.state.doc.content.size - 1, text);

describe('versions', () => {
  it('starts empty and saves named snapshots, newest first', async () => {
    const { e, v } = await setup('<p>First draft</p>');
    expect(v.getState()).toMatchObject({ status: 'ready', versions: [], preview: null });
    expect(await v.commands.snapshot('Draft 1')).toBe(true);
    typeAtEnd(e, ' grows');
    await v.commands.snapshot();
    expect(v.getState().versions.map((x) => [x.label, x.auto, x.words])).toEqual([
      [null, false, 3],
      ['Draft 1', false, 2],
    ]);
  });

  it('previews a version and compares it with the current text', async () => {
    const { e, v } = await setup('<p>The old grey cat sat</p>');
    await v.commands.snapshot('v1');
    e.tiptap.commands.setContent('<p>The grey cat sat quietly</p>');
    await v.commands.open(v.getState().versions[0]!.id);
    const { preview } = v.getState();
    expect(preview).toMatchObject({ label: 'v1', words: 5, summary: { insertedWords: 1, deletedWords: 1 } });
    expect(preview!.content).toEqual({ type: 'doc', content: [expect.objectContaining({ type: 'paragraph' })] });
    expect(preview!.diff[0]!.parts).toEqual([
      { op: 'equal', text: 'The ' },
      { op: 'delete', text: 'old ' },
      { op: 'equal', text: 'grey cat sat' },
      { op: 'insert', text: ' quietly' },
    ]);
    v.commands.close();
    expect(v.getState().preview).toBeNull();
  });

  it('restores a version as a new change, after saving what was there', async () => {
    const { e, v } = await setup('<p>Original</p>');
    await v.commands.snapshot('good');
    e.tiptap.commands.setContent('<p>Ruined text</p>');
    const words: number[] = [];
    e.on('wordsTyped', ({ delta }) => words.push(delta));
    const good = v.getState().versions[0]!;
    expect(await v.commands.restore(good.id)).toBe(true);
    expect(e.getHTML()).toBe('<p>Original</p>');
    expect(v.getState().versions[0]).toMatchObject({ label: 'Before restore', auto: true });
    expect(words).toEqual([]); // a restore is not typing
    e.tiptap.commands.undo();
    expect(e.getHTML()).toBe('<p>Ruined text</p>'); // and it can be undone
  });

  it('refuses a restore the editor will not apply (e.g. a co-author is editing) and says so', async () => {
    const blocker = defineFeature({
      name: 'blocker',
      extensions: [Extension.create({ name: 'blocker', addProseMirrorPlugins: () => [new Plugin({ filterTransaction: (tr) => !tr.getMeta('proseline:versionRestore') })] })],
    });
    const { e, v } = await setup('<p>Original</p>', {}, { features: [blocker] });
    await v.commands.snapshot('good');
    e.tiptap.commands.setContent('<p>Changed</p>');
    expect(await v.commands.restore(v.getState().versions[0]!.id)).toBe(false);
    expect(v.getState().error).toBe('restoreRefused');
    expect(e.getHTML()).toBe('<p>Changed</p>');
  });

  it('removes versions when the store supports it', async () => {
    const { v } = await setup('<p>x</p>');
    await v.commands.snapshot('a');
    expect(v.getState().canRemove).toBe(true);
    await v.commands.remove(v.getState().versions[0]!.id);
    expect(v.getState().versions).toEqual([]);
  });

  it('takes automatic snapshots only after local edits', async () => {
    vi.useFakeTimers();
    const store = memoryVersionStore();
    editor = createEditor({ content: '<p>Start</p>', features: [versions({ store, docId: 'doc-1', autoSnapshotMs: 60_000 })] });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(await store.list('doc-1')).toEqual([]); // nothing changed
    typeAtEnd(editor, ' more');
    await vi.advanceTimersByTimeAsync(59_000);
    expect(await store.list('doc-1')).toEqual([]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await store.list('doc-1')).toEqual([expect.objectContaining({ auto: true, label: null, words: 2 })]);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(await store.list('doc-1')).toHaveLength(1); // no edits since
  });

  it('hides saving and restoring when not allowed', async () => {
    const { v } = await setup('<p>x</p>', { allowChanges: false });
    expect(v.getState().allowed).toBe(false);
    expect(await v.commands.snapshot('no')).toBe(false);
  });

  it('reports store failures', async () => {
    const failing: VersionStore = {
      list: async () => {
        throw new Error('down');
      },
      save: async () => {
        throw new Error('down');
      },
      load: async () => {
        throw new Error('down');
      },
    };
    const { v } = await setup('<p>x</p>', { store: failing });
    expect(v.getState()).toMatchObject({ status: 'error', error: 'loadFailed', canRemove: false });
    expect(await v.commands.snapshot('x')).toBe(false);
    expect(v.getState().error).toBe('saveFailed');
  });
});
