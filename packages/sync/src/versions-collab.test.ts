import { describe, it, expect, vi, afterEach } from 'vitest';
import { createEditor, type ProselineEditor } from '@proseline-editor/core';
import { memoryVersionStore, versions, type VersionStore } from '@proseline-editor/core/features';
import { createSyncProvider } from './provider.js';
import { createMemoryServer, type MemoryServer } from './testing/memory-server.js';
import { collaboration } from './collaboration.js';

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).reverse().forEach((f) => f());
  vi.useRealTimers();
});

const writer = async (server: MemoryServer, store: VersionStore, name: string, blockLocks = false) => {
  const provider = createSyncProvider({ docId: 'scene', transport: server.connect(), tabSync: false, batchMs: 10 });
  await vi.advanceTimersByTimeAsync(50);
  const editor = createEditor({
    features: [
      collaboration({ provider, user: { name, color: '#000' }, blockLocks: blockLocks ? { idleMs: 10_000 } : false }),
      versions({ store, docId: 'scene', autoSnapshotMs: false }),
    ],
  });
  cleanup.push(() => provider.destroy(), () => editor.destroy());
  await vi.advanceTimersByTimeAsync(10);
  return editor;
};

const typeAt = (e: ProselineEditor, pos: number, text: string) => {
  const { view } = e.tiptap;
  e.tiptap.commands.setTextSelection(pos);
  for (const ch of text) {
    const { from, to } = view.state.selection;
    const handled = view.someProp('handleTextInput', (f) => f(view, from, to, ch, () => view.state.tr.insertText(ch, from, to)));
    if (!handled) view.dispatch(view.state.tr.insertText(ch, from, to));
  }
};

describe('versions with collaboration', () => {
  it('restores for every writer as an ordinary change', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const store = memoryVersionStore();
    const ann = await writer(server, store, 'Ann');
    ann.tiptap.commands.setContent('<p>Version one</p>');
    const bo = await writer(server, store, 'Bo');
    await vi.advanceTimersByTimeAsync(100);
    await ann.feature('versions')!.commands.snapshot('v1');
    bo.tiptap.commands.setContent('<p>Bo rewrote everything</p>');
    await vi.advanceTimersByTimeAsync(100);
    expect(ann.getHTML()).toBe('<p>Bo rewrote everything</p>');
    const v1 = ann.feature('versions')!.getState().versions.find((v) => v.label === 'v1')!;
    expect(await ann.feature('versions')!.commands.restore(v1.id)).toBe(true);
    await vi.advanceTimersByTimeAsync(100);
    expect(bo.getHTML()).toBe('<p>Version one</p>');
  });

  it('keeps the restore a separate undo step from typing just before it', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const ann = await writer(server, memoryVersionStore(), 'Ann');
    ann.tiptap.commands.setContent('<p>Start</p>');
    await vi.advanceTimersByTimeAsync(1000);
    await ann.feature('versions')!.commands.snapshot('v1');
    typeAt(ann, 6, ' typed');
    const v1 = ann.feature('versions')!.getState().versions[0]!;
    await ann.feature('versions')!.commands.restore(v1.id);
    expect(ann.getHTML()).toBe('<p>Start</p>');
    ann.tiptap.commands.undo();
    expect(ann.getHTML()).toBe('<p>Start typed</p>');
  });

  it('is refused while a co-author holds a block lock', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const store = memoryVersionStore();
    const ann = await writer(server, store, 'Ann', true);
    ann.tiptap.commands.setContent('<p>Original</p><p>Second</p>');
    const bo = await writer(server, store, 'Bo', true);
    await vi.advanceTimersByTimeAsync(100);
    await ann.feature('versions')!.commands.snapshot('v1');
    ann.tiptap.commands.setTextSelection(2); // Ann's caret leaves the second paragraph, releasing her own lock
    await vi.advanceTimersByTimeAsync(100);
    typeAt(bo, 17, ' by Bo'); // Bo now holds the second paragraph
    await vi.advanceTimersByTimeAsync(100);
    const v1 = ann.feature('versions')!.getState().versions.find((v) => v.label === 'v1')!;
    expect(await ann.feature('versions')!.commands.restore(v1.id)).toBe(false);
    expect(ann.feature('versions')!.getState().error).toBe('restoreRefused');
    expect(ann.getHTML()).toBe('<p>Original</p><p>Second by Bo</p>');
    expect(ann.feature('versions')!.getState().versions.map((v) => v.label)).toEqual(['v1']); // no stray "Before restore"
  });
});
