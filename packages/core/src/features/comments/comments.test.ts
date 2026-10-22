import { describe, it, expect, vi, afterEach } from 'vitest';
import { createEditor, type ProselineEditor } from '../../editor.js';
import { comments, type CommentsOptions } from './index.js';
import { memoryCommentStore } from './memory-store.js';
import type { CommentStore } from './types.js';

let editor: ProselineEditor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  vi.useRealTimers();
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const setup = async (html: string, opts: Partial<CommentsOptions> = {}) => {
  const store = opts.store ?? memoryCommentStore({ author: { id: 'ann', name: 'Ann' } });
  editor = createEditor({ content: html, features: [comments({ store, docId: 'doc-1', ...opts })] });
  await flush();
  return { e: editor, c: editor.feature('comments')!, store };
};

const comment = async (e: ProselineEditor, from: number, to: number, body: string) => {
  const c = e.feature('comments')!;
  e.tiptap.commands.setTextSelection({ from, to });
  expect(c.commands.startComment()).toBe(true);
  return c.commands.submitComment(body);
};

describe('comments', () => {
  it('loads threads from the store', async () => {
    const store = memoryCommentStore();
    await store.create({ docId: 'doc-1', anchor: { type: 'position', from: 1, to: 6, quote: 'Hello' }, body: 'Nice' });
    const { c } = await setup('<p>Hello world</p>', { store });
    expect(c.getState()).toMatchObject({ status: 'ready', error: null });
    expect(c.getState().threads).toEqual([expect.objectContaining({ range: { from: 1, to: 6 }, orphaned: false, comments: [expect.objectContaining({ body: 'Nice' })] })]);
  });

  it('comments on the selection and highlights it', async () => {
    const { e, c } = await setup('<p>Hello brave world</p>');
    expect(c.getState().canComment).toBe(false);
    e.tiptap.commands.setTextSelection({ from: 7, to: 12 });
    expect(c.getState().canComment).toBe(true);
    expect(await comment(e, 7, 12, 'Why brave?')).toBe(true);
    const [thread] = c.getState().threads;
    expect(thread).toMatchObject({ anchor: { quote: 'brave' }, range: { from: 7, to: 12 }, resolved: false });
    const mark = e.tiptap.view.dom.querySelector('.pl-comment') as HTMLElement;
    expect(mark.textContent).toBe('brave');
    expect(mark.getAttribute('data-thread-id')).toBe(thread!.id);
    expect(e.getHTML()).toBe('<p>Hello brave world</p>'); // the document stays clean
  });

  it('keeps the selection highlighted while the comment is being written, and cancels', async () => {
    const { e, c } = await setup('<p>Hello brave world</p>');
    e.tiptap.commands.setTextSelection({ from: 7, to: 12 });
    c.commands.startComment();
    e.tiptap.commands.setTextSelection(1); // focus moves to the comment box
    expect(c.getState().composing).toBe(true);
    expect(e.tiptap.view.dom.querySelector('.pl-comment--pending')?.textContent).toBe('brave');
    c.commands.cancelComment();
    expect(c.getState().composing).toBe(false);
    expect(e.tiptap.view.dom.querySelector('.pl-comment--pending')).toBeNull();
  });

  it('follows its text through edits and persists shifted positions', async () => {
    vi.useFakeTimers();
    const store = memoryCommentStore();
    editor = createEditor({ content: '<p>Hello brave world</p>', features: [comments({ store, docId: 'doc-1' })] });
    await vi.advanceTimersByTimeAsync(0);
    await comment(editor, 7, 12, 'note');
    editor.tiptap.commands.insertContentAt(1, 'Well, ');
    expect(editor.feature('comments')!.getState().threads[0]!.range).toEqual({ from: 13, to: 18 });
    await vi.advanceTimersByTimeAsync(1500);
    const [stored] = await store.list('doc-1');
    expect(stored!.anchor).toMatchObject({ from: 13, to: 18, quote: 'brave' });
  });

  it('marks a thread orphaned when its text is deleted', async () => {
    const { e, c } = await setup('<p>Hello brave world</p>');
    await comment(e, 7, 12, 'note');
    e.tiptap.chain().setTextSelection({ from: 6, to: 12 }).deleteSelection().run();
    expect(c.getState().threads[0]).toMatchObject({ range: null, orphaned: true });
    expect(e.tiptap.view.dom.querySelector('.pl-comment')).toBeNull();
  });

  it('finds stale anchors again by their quote', async () => {
    const store = memoryCommentStore();
    const thread = await store.create({ docId: 'doc-1', anchor: { type: 'position', from: 7, to: 12, quote: 'brave' }, body: 'x' });
    // The document changed elsewhere (saved without the comment positions).
    const { c } = await setup('<p>Intro. Hello brave world</p>', { store });
    expect(c.getState().threads[0]!.range).toEqual({ from: 14, to: 19 });
    await flush();
    const [stored] = await store.list('doc-1');
    expect(stored).toMatchObject({ id: thread.id, anchor: { from: 14, to: 19 } });
  });

  it('orders threads by position, orphaned ones last', async () => {
    const { e, c } = await setup('<p>one two three</p>');
    await comment(e, 9, 14, 'third');
    await comment(e, 1, 4, 'first');
    await comment(e, 5, 8, 'second');
    e.tiptap.chain().setTextSelection({ from: 1, to: 4 }).deleteSelection().run();
    expect(c.getState().threads.map((t) => t.comments[0]!.body)).toEqual(['second', 'third', 'first']);
  });

  it('replies, resolves, reopens and removes', async () => {
    const { e, c } = await setup('<p>Hello world</p>');
    await comment(e, 1, 6, 'root');
    const id = c.getState().threads[0]!.id;
    await c.commands.reply(id, 'answer');
    expect(c.getState().threads[0]!.comments.map((x) => x.body)).toEqual(['root', 'answer']);
    await c.commands.setResolved(id, true);
    expect(c.getState().threads[0]!.resolved).toBe(true);
    expect(e.tiptap.view.dom.querySelector('.pl-comment--resolved')).not.toBeNull();
    await c.commands.setResolved(id, false);
    expect(c.getState().threads[0]!.resolved).toBe(false);
    await c.commands.remove(id);
    expect(c.getState().threads).toEqual([]);
  });

  it('selects a thread: highlights it and selects its text', async () => {
    const { e, c } = await setup('<p>Hello world</p>');
    await comment(e, 7, 12, 'note');
    const id = c.getState().threads[0]!.id;
    e.tiptap.commands.setTextSelection(1);
    c.commands.select(id);
    expect(c.getState().activeId).toBe(id);
    expect(e.tiptap.state.selection).toMatchObject({ from: 7, to: 12 });
    expect(e.tiptap.view.dom.querySelector('.pl-comment--active')).not.toBeNull();
  });

  it('activates the thread under a click in the text (and clears it on a click elsewhere)', async () => {
    const { e, c } = await setup('<p>Hello brave world</p>');
    await comment(e, 7, 12, 'note');
    const id = c.getState().threads[0]!.id;
    const click = (pos: number) => e.tiptap.view.someProp('handleClick', (f) => f(e.tiptap.view, pos, new MouseEvent('click')));
    expect(click(9)).toBeFalsy(); // the click still places the caret normally
    expect(c.getState().activeId).toBe(id);
    click(2);
    expect(c.getState().activeId).toBeNull();
  });

  it('picks up changes made by others through the store subscription', async () => {
    const annStore = memoryCommentStore({ author: { id: 'ann' } });
    const { c } = await setup('<p>Hello world</p>', { store: annStore });
    const boStore = memoryCommentStore({ author: { id: 'bo' }, shared: annStore.shared });
    await boStore.create({ docId: 'doc-1', anchor: { type: 'position', from: 7, to: 12, quote: 'world' }, body: 'from Bo' });
    await flush();
    expect(c.getState().threads[0]!.comments[0]).toMatchObject({ authorId: 'bo', body: 'from Bo' });
  });

  it('lets a read-only editor comment (the document is not changed)', async () => {
    const store = memoryCommentStore();
    editor = createEditor({ content: '<p>Hello world</p>', editable: false, features: [comments({ store, docId: 'doc-1' })] });
    await flush();
    expect(await comment(editor, 1, 6, 'viewer note')).toBe(true);
    expect(editor.feature('comments')!.getState().threads).toHaveLength(1);
  });

  it('hides commenting when not allowed', async () => {
    const { e, c } = await setup('<p>Hello world</p>', { allowComments: false });
    e.tiptap.commands.setTextSelection({ from: 1, to: 6 });
    expect(c.getState().canComment).toBe(false);
    expect(c.commands.startComment()).toBe(false);
  });

  it('reports store failures', async () => {
    const failing: CommentStore = {
      list: async () => {
        throw new Error('down');
      },
      create: async () => {
        throw new Error('down');
      },
      reply: async () => {
        throw new Error('down');
      },
      setResolved: async () => undefined,
      remove: async () => undefined,
    };
    const { e, c } = await setup('<p>Hello</p>', { store: failing });
    expect(c.getState()).toMatchObject({ status: 'error', error: 'loadFailed' });
    e.tiptap.commands.setTextSelection({ from: 1, to: 6 });
    c.commands.startComment();
    expect(await c.commands.submitComment('x')).toBe(false);
    expect(c.getState()).toMatchObject({ error: 'saveFailed', composing: true });
  });
});
