import { describe, it, expect, vi, afterEach } from 'vitest';
import { createEditor, type ProselineEditor } from '@proseline-editor/core';
import { comments, memoryCommentStore, type CommentStore } from '@proseline-editor/core/features';
import { createSyncProvider } from './provider.js';
import { createMemoryServer, type MemoryServer } from './testing/memory-server.js';
import { collaboration } from './collaboration.js';
import { yjsAnchoring } from './comment-anchoring.js';

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).reverse().forEach((f) => f());
  vi.useRealTimers();
});

const writer = async (server: MemoryServer, store: CommentStore) => {
  const provider = createSyncProvider({ docId: 'scene', transport: server.connect(), tabSync: false, batchMs: 10 });
  await vi.advanceTimersByTimeAsync(50);
  // Locks off: these tests have both writers edit the same paragraph back to back.
  const editor = createEditor({
    features: [collaboration({ provider, blockLocks: false }), comments({ store, docId: 'scene', anchoring: yjsAnchoring() })],
  });
  cleanup.push(() => provider.destroy(), () => editor.destroy());
  await vi.advanceTimersByTimeAsync(10);
  return editor;
};

const setup = async (html: string) => {
  const server = createMemoryServer();
  const annStore = memoryCommentStore({ author: { id: 'ann' } });
  const ann = await writer(server, annStore);
  ann.tiptap.commands.setContent(html);
  const bo = await writer(server, memoryCommentStore({ author: { id: 'bo' }, shared: annStore.shared }));
  await vi.advanceTimersByTimeAsync(100);
  return { ann, bo, store: annStore };
};

const highlighted = (e: ProselineEditor) => [...e.tiptap.view.dom.querySelectorAll('.pl-comment')].map((el) => el.textContent).join('|');
const range = (e: ProselineEditor) => e.feature('comments')!.getState().threads[0]?.range;

const commentOn = async (e: ProselineEditor, from: number, to: number) => {
  e.tiptap.commands.setTextSelection({ from, to });
  e.feature('comments')!.commands.startComment();
  await e.feature('comments')!.commands.submitComment('note');
  await vi.advanceTimersByTimeAsync(10);
};

describe('yjsAnchoring', () => {
  it('stores Yjs relative positions and shows the thread to every writer', async () => {
    vi.useFakeTimers();
    const { ann, bo, store } = await setup('<p>Hello brave world</p>');
    await commentOn(ann, 7, 12);
    const [thread] = await store.list('scene');
    expect(thread!.anchor).toMatchObject({ type: 'yjs', quote: 'brave', start: expect.any(Object), end: expect.any(Object) });
    expect(highlighted(bo)).toBe('brave');
  });

  it('follows the text when a co-author edits before it', async () => {
    vi.useFakeTimers();
    const { ann, bo } = await setup('<p>Hello brave world</p>');
    await commentOn(ann, 7, 12);
    bo.tiptap.commands.insertContentAt(1, 'Oh, ');
    await vi.advanceTimersByTimeAsync(100);
    expect(range(ann)).toEqual({ from: 11, to: 16 });
    expect(highlighted(ann)).toBe('brave');
  });

  it('does not grow when someone types right before or after the commented text', async () => {
    vi.useFakeTimers();
    const { ann, bo } = await setup('<p>Hello brave world</p>');
    await commentOn(ann, 7, 12);
    bo.tiptap.commands.insertContentAt(12, 'st');
    await vi.advanceTimersByTimeAsync(100);
    bo.tiptap.commands.insertContentAt(7, 'very ');
    await vi.advanceTimersByTimeAsync(100);
    expect(highlighted(ann)).toBe('brave');
    expect(highlighted(bo)).toBe('brave');
  });

  it('stays on its text when the paragraph becomes a heading, and saves the new anchor', async () => {
    vi.useFakeTimers();
    const { ann, bo, store } = await setup('<p>Hello brave world</p>');
    await commentOn(ann, 7, 12);
    const before = (await store.list('scene'))[0]!.anchor;
    bo.tiptap.chain().setTextSelection(2).setNode('heading', { level: 2 }).run();
    await vi.advanceTimersByTimeAsync(100);
    expect(highlighted(ann)).toBe('brave');
    expect(highlighted(bo)).toBe('brave');
    const after = (await store.list('scene'))[0]!.anchor;
    expect(after).not.toEqual(before);
    expect(after).toMatchObject({ type: 'yjs', quote: 'brave' });
  });

  it('keeps the rest of the text when its first or last characters are deleted', async () => {
    vi.useFakeTimers();
    const { ann, bo } = await setup('<p>Hello brave world</p>');
    await commentOn(ann, 7, 12);
    bo.tiptap.chain().setTextSelection({ from: 7, to: 8 }).deleteSelection().run(); // "b"
    await vi.advanceTimersByTimeAsync(100);
    bo.tiptap.chain().setTextSelection({ from: 10, to: 11 }).deleteSelection().run(); // "e"
    await vi.advanceTimersByTimeAsync(100);
    expect(highlighted(ann)).toBe('rav');
    expect(highlighted(bo)).toBe('rav');
  });

  it('orphans the thread for everyone when a co-author deletes its text', async () => {
    vi.useFakeTimers();
    const { ann, bo } = await setup('<p>Hello brave world</p>');
    await commentOn(ann, 7, 12);
    bo.tiptap.chain().setTextSelection({ from: 6, to: 12 }).deleteSelection().run();
    await vi.advanceTimersByTimeAsync(100);
    for (const e of [ann, bo]) expect(e.feature('comments')!.getState().threads[0]).toMatchObject({ orphaned: true, range: null });
  });
});
