import { describe, it, expect, vi, afterEach } from 'vitest';
import { createEditor, type ProselineEditor } from '@proseline-editor/core';
import { stats } from '@proseline-editor/core/features';
import { createSyncProvider } from './provider.js';
import { createMemoryServer } from './testing/memory-server.js';
import { collaboration } from './collaboration.js';

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).reverse().forEach((f) => f());
  vi.useRealTimers();
});

const settle = (ms = 100) => vi.advanceTimersByTimeAsync(ms);

const writer = async (server: ReturnType<typeof createMemoryServer>, name: string, opts: { userId?: string } = {}) => {
  const provider = createSyncProvider({ docId: 'scene', transport: server.connect({ userId: opts.userId }), tabSync: false, batchMs: 10 });
  await settle();
  await provider.whenReady;
  // These tests make writers edit the same block back to back; block locks (tested on their own) would refuse that.
  const editor = createEditor({ features: [collaboration({ provider, user: { name, color: '#0f766e' }, blockLocks: false }), stats()] });
  cleanup.push(() => provider.destroy(), () => editor.destroy());
  return { provider, editor };
};

const typeAtEnd = (editor: ProselineEditor, text: string) => {
  const { tiptap } = editor;
  tiptap.commands.setTextSelection(tiptap.state.doc.content.size - 1);
  const { view } = tiptap;
  for (const ch of text) {
    const { from, to } = view.state.selection;
    const handled = view.someProp('handleTextInput', (f) => f(view, from, to, ch, () => view.state.tr.insertText(ch, from, to)));
    if (!handled) view.dispatch(view.state.tr.insertText(ch, from, to));
  }
};

describe('collaboration feature', () => {
  it('keeps two editors in sync through the server', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const a = await writer(server, 'Ann');
    const b = await writer(server, 'Bo');
    typeAtEnd(a.editor, 'Hello from Ann');
    await settle();
    expect(b.editor.getText()).toBe('Hello from Ann');
    a.editor.tiptap.commands.setTextSelection(1);
    a.editor.tiptap.commands.toggleBold();
    typeAtEnd(b.editor, '. Bo here');
    await settle();
    expect(a.editor.getHTML()).toBe(b.editor.getHTML());
    expect(a.editor.getText()).toBe('Hello from Ann. Bo here');
  });

  it('stores prose in the WorldForge-compatible prosemirror fragment', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const a = await writer(server, 'Ann');
    typeAtEnd(a.editor, 'Stored');
    await settle();
    expect(server.doc.getXmlFragment('prosemirror').toString()).toContain('Stored');
  });

  it('undoes only the local writer changes', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const a = await writer(server, 'Ann');
    const b = await writer(server, 'Bo');
    typeAtEnd(a.editor, 'Ann ');
    await settle(1000); // separate undo groups
    typeAtEnd(b.editor, 'Bo');
    await settle();
    a.editor.tiptap.commands.undo();
    await settle();
    expect(a.editor.getText()).toBe('Bo');
    expect(b.editor.getText()).toBe('Bo');
  });

  it('does not count words typed by co-authors', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const a = await writer(server, 'Ann');
    const b = await writer(server, 'Bo');
    typeAtEnd(b.editor, 'three peer words');
    await settle();
    typeAtEnd(a.editor, ' mine');
    expect(a.editor.feature('stats')?.getState()).toMatchObject({ words: 4, sessionWords: 1 });
  });

  it('exposes sync state and the other writers', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const a = await writer(server, 'Ann');
    await writer(server, 'Bo');
    await settle();
    const state = a.editor.feature('collaboration')!.getState();
    expect(state).toMatchObject({ status: 'synced', ready: true, readOnly: false, unsent: 0 });
    expect(state.peers.map((p) => p.name)).toEqual(['Bo']);
  });

  it('renders the carets of co-authors without text, keeping names out of the document text', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const a = await writer(server, 'Ann');
    const b = await writer(server, 'Bo');
    // Carets are published only by a focused editor, so put both in the document.
    for (const w of [a, b]) document.body.appendChild(w.editor.tiptap.view.dom.parentElement as HTMLElement);
    typeAtEnd(a.editor, 'Hello');
    a.editor.tiptap.view.focus();
    a.editor.tiptap.commands.setTextSelection(3);
    await settle();
    const caret = b.editor.tiptap.view.dom.querySelector('.collaboration-carets__caret') as HTMLElement;
    expect(caret).not.toBeNull();
    expect(caret.getAttribute('data-name')).toBe('Ann');
    expect(caret.textContent).toBe('');
    expect(caret.style.getPropertyValue('--pl-caret-color')).toBe('#0f766e');
    expect(b.editor.tiptap.view.dom.textContent).toBe('Hello');
  });

  it('turns the editor read-only when write access is revoked', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const a = await writer(server, 'Ann', { userId: 'ann' });
    server.revoke('ann');
    typeAtEnd(a.editor, 'too late');
    await settle();
    expect(a.editor.feature('collaboration')!.getState()).toMatchObject({ status: 'error', readOnly: true });
    expect(a.editor.isEditable).toBe(false);
  });
});
