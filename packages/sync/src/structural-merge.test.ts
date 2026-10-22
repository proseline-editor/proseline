import { describe, it, expect, vi, afterEach } from 'vitest';
import { TextSelection } from '@tiptap/pm/state';
import { yUndoPluginKey } from '@tiptap/y-tiptap';
import { createEditor, type ProselineEditor } from '@proseline-editor/core';
import { createSyncProvider } from './provider.js';
import { createMemoryServer, type MemoryServer, type MemoryTransport } from './testing/memory-server.js';
import { collaboration } from './collaboration.js';

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).reverse().forEach((f) => f());
  vi.useRealTimers();
});

interface Writer {
  editor: ProselineEditor;
  transport: MemoryTransport;
}

/** Block locks are off: these tests exercise the merge repair, which locks would mostly pre-empt. */
const writer = async (server: MemoryServer): Promise<Writer> => {
  const transport = server.connect();
  const provider = createSyncProvider({ docId: 'scene', transport, tabSync: false, batchMs: 10 });
  await vi.advanceTimersByTimeAsync(50);
  const editor = createEditor({ features: [collaboration({ provider, blockLocks: false })] });
  cleanup.push(() => provider.destroy(), () => editor.destroy());
  return { editor, transport };
};

/** Two writers sharing `html`, then both offline so their next edits are truly concurrent. */
const concurrent = async (html: string) => {
  const server = createMemoryServer();
  const a = await writer(server);
  a.editor.tiptap.commands.setContent(html);
  const b = await writer(server);
  await vi.advanceTimersByTimeAsync(100);
  expect(b.editor.getHTML()).toBe(a.editor.getHTML());
  a.transport.setOnline(false);
  b.transport.setOnline(false);
  const merge = async () => {
    a.transport.setOnline(true);
    b.transport.setOnline(true);
    await vi.advanceTimersByTimeAsync(40_000);
  };
  return { a, b, merge };
};

const at = (w: Writer, pos: number) => w.editor.tiptap.chain().setTextSelection(pos);

describe('structural changes merged with concurrent edits', () => {
  it('keeps text typed into a paragraph that a co-author turned into a heading', async () => {
    vi.useFakeTimers();
    const { a, b, merge } = await concurrent('<p>Hello world</p>');
    at(a, 2).setNode('heading', { level: 2 }).run();
    b.editor.tiptap.commands.insertContentAt(12, ' and more');
    await merge();
    expect(a.editor.getHTML()).toBe('<h2>Hello world and more</h2><p></p>');
    expect(b.editor.getHTML()).toBe(a.editor.getHTML());
  });

  it('keeps text typed into a paragraph that a co-author wrapped in a quote', async () => {
    vi.useFakeTimers();
    const { a, b, merge } = await concurrent('<p>Second test</p>');
    at(a, 2).toggleBlockquote().run();
    b.editor.tiptap.commands.insertContentAt(1, 'A ');
    b.editor.tiptap.commands.insertContentAt(14, ' typed');
    await merge();
    expect(a.editor.getHTML()).toBe('<blockquote><p>A Second test typed</p></blockquote><p></p>');
    expect(b.editor.getHTML()).toBe(a.editor.getHTML());
  });

  it('keeps the formatting of rescued text', async () => {
    vi.useFakeTimers();
    const { a, b, merge } = await concurrent('<p>Plain</p>');
    at(a, 2).setNode('heading', { level: 1 }).run();
    b.editor.tiptap.chain().setTextSelection(6).insertContent(' <strong>bold</strong>').run();
    await merge();
    expect(a.editor.getHTML()).toBe('<h1>Plain <strong>bold</strong></h1><p></p>');
    expect(b.editor.getHTML()).toBe(a.editor.getHTML());
  });

  it('keeps text around a hard break', async () => {
    vi.useFakeTimers();
    const { a, b, merge } = await concurrent('<p>one<br>two</p>');
    at(a, 2).setNode('heading', { level: 3 }).run();
    b.editor.tiptap.commands.insertContentAt(8, '!'); // end of "two"
    await merge();
    expect(a.editor.getHTML()).toBe('<h3>one<br>two!</h3><p></p>');
    expect(b.editor.getHTML()).toBe(a.editor.getHTML());
  });

  it('keeps text deleted in a paragraph that a co-author turned into a heading deleted', async () => {
    vi.useFakeTimers();
    const { a, b, merge } = await concurrent('<p>Keep this but remove that</p>');
    at(a, 2).setNode('heading', { level: 2 }).run();
    b.editor.tiptap.chain().setTextSelection({ from: 14, to: 27 }).deleteSelection().run();
    await merge();
    expect(a.editor.getHTML()).toBe('<h2>Keep this but</h2><p></p>');
    expect(b.editor.getHTML()).toBe(a.editor.getHTML());
  });

  it('replays mixed deletions and insertions into the replacement block', async () => {
    vi.useFakeTimers();
    const { a, b, merge } = await concurrent('<p>The old grey cat sat</p>');
    at(a, 2).toggleBlockquote().run();
    b.editor.tiptap.chain().setTextSelection({ from: 5, to: 9 }).deleteSelection().run(); // "old "
    b.editor.tiptap.commands.insertContentAt(17, ' quietly'); // end of "The grey cat sat"
    await merge();
    expect(a.editor.getHTML()).toBe('<blockquote><p>The grey cat sat quietly</p></blockquote><p></p>');
    expect(b.editor.getHTML()).toBe(a.editor.getHTML());
  });

  it('does not delete twice when the co-author already saw the deletion', async () => {
    vi.useFakeTimers();
    const { a, b, merge } = await concurrent('<p>Remove me please</p>');
    a.transport.setOnline(true);
    b.transport.setOnline(true);
    b.editor.tiptap.chain().setTextSelection({ from: 8, to: 11 }).deleteSelection().run(); // "me "
    await vi.advanceTimersByTimeAsync(100);
    at(a, 2).setNode('heading', { level: 2 }).run();
    await merge();
    expect(a.editor.getHTML()).toBe('<h2>Remove please</h2><p></p>');
    expect(b.editor.getHTML()).toBe(a.editor.getHTML());
  });

  it('copes with a local change that only deletes a block (undoing an inserted paragraph)', async () => {
    vi.useFakeTimers();
    const { a, b, merge } = await concurrent('<p>Keep</p>');
    await merge(); // online, sequential
    // A separate undo step (lib0 reads the real clock, so fake timers cannot end the capture window).
    yUndoPluginKey.getState(a.editor.tiptap.state)!.undoManager.stopCapturing();
    a.editor.tiptap.commands.insertContentAt(a.editor.tiptap.state.doc.content.size, '<p>Added</p>');
    await vi.advanceTimersByTimeAsync(200);
    // Yjs undo deletes the paragraph's element and creates nothing: a transaction with no new structs.
    a.editor.tiptap.commands.undo();
    await vi.advanceTimersByTimeAsync(200);
    expect(a.editor.getHTML()).toBe('<p>Keep</p>');
    expect(b.editor.getHTML()).toBe(a.editor.getHTML());
  });

  it('does not bring back text a co-author deliberately replaced', async () => {
    vi.useFakeTimers();
    const { a, b, merge } = await concurrent('<p>Written by A</p>');
    await merge(); // b knows the text
    b.editor.tiptap.commands.setContent('<p>B rewrote everything</p>');
    await vi.advanceTimersByTimeAsync(200);
    expect(a.editor.getHTML()).toBe('<p>B rewrote everything</p>');
    expect(b.editor.getHTML()).toBe(a.editor.getHTML());
  });

  it('does not duplicate a block both writers changed the same way', async () => {
    vi.useFakeTimers();
    const { a, b, merge } = await concurrent('<p>Same change</p>');
    at(a, 2).setNode('heading', { level: 1 }).run();
    at(b, 2).setNode('heading', { level: 1 }).run();
    await merge();
    expect(a.editor.getHTML()).toBe('<h1>Same change</h1><p></p>');
    expect(b.editor.getHTML()).toBe(a.editor.getHTML());
  });

  it('keeps both versions when writers changed a block differently (nothing is lost)', async () => {
    vi.useFakeTimers();
    const { a, b, merge } = await concurrent('<p>Diverged</p>');
    at(a, 2).setNode('heading', { level: 1 }).run();
    at(b, 2).toggleBlockquote().run();
    await merge();
    expect(a.editor.getHTML()).toBe(b.editor.getHTML());
    expect(a.editor.getText().match(/Diverged/g)).toHaveLength(2);
  });

  it('does not bring back a paragraph a co-author deleted on purpose', async () => {
    vi.useFakeTimers();
    const { a, b, merge } = await concurrent('<p>Keep</p><p>Drop me</p>');
    a.editor.tiptap.chain().setTextSelection({ from: 6, to: 15 }).deleteSelection().run();
    b.editor.tiptap.commands.insertContentAt(14, ' now');
    await merge();
    expect(a.editor.getText()).not.toContain('Drop me');
    expect(b.editor.getHTML()).toBe(a.editor.getHTML());
  });

  it('does not re-insert text the co-author already had', async () => {
    vi.useFakeTimers();
    const { a, b, merge } = await concurrent('<p>Known</p>');
    a.transport.setOnline(true);
    b.transport.setOnline(true);
    b.editor.tiptap.commands.insertContentAt(6, ' text');
    await vi.advanceTimersByTimeAsync(100);
    at(a, 2).setNode('heading', { level: 2 }).run();
    await merge();
    expect(a.editor.getHTML()).toBe('<h2>Known text</h2><p></p>');
    expect(b.editor.getHTML()).toBe(a.editor.getHTML());
  });

  it('rescues text typed during a long offline stretch', async () => {
    vi.useFakeTimers();
    const { a, b, merge } = await concurrent('<p>Offline</p>');
    a.transport.setOnline(true);
    at(a, 2).setNode('heading', { level: 2 }).run();
    await vi.advanceTimersByTimeAsync(5000);
    b.editor.tiptap.commands.insertContentAt(8, ' for an hour');
    await vi.advanceTimersByTimeAsync(60_000);
    await merge();
    expect(a.editor.getHTML()).toBe('<h2>Offline for an hour</h2><p></p>');
    expect(b.editor.getHTML()).toBe(a.editor.getHTML());
  });
});

describe('structural merge fuzz', () => {
  const ops = ['type', 'type', 'type', 'delete', 'heading', 'paragraph', 'quote', 'split'] as const;

  const randomOp = (w: Writer, random: () => number, label: string) => {
    const { tiptap } = w.editor;
    const { doc } = tiptap.state;
    // A caret inside a textblock: raw positions can fall between blocks, where commands throw.
    const $pos = doc.resolve(Math.floor(random() * (doc.content.size + 1)));
    tiptap.view.dispatch(tiptap.state.tr.setSelection(TextSelection.near($pos)));
    const chain = tiptap.chain();
    switch (ops[Math.floor(random() * ops.length)]) {
      case 'type':
        chain.insertContent(`${label} `).run();
        break;
      case 'delete': {
        const { from } = tiptap.state.selection;
        const $from = tiptap.state.doc.resolve(from);
        const to = Math.min($from.end(), from + 1 + Math.floor(random() * 6));
        if (to > from) chain.deleteRange({ from, to }).run();
        break;
      }
      case 'heading':
        chain.setNode('heading', { level: 1 + Math.floor(random() * 3) }).run();
        break;
      case 'paragraph':
        chain.setParagraph().run();
        break;
      case 'quote':
        chain.toggleBlockquote().run();
        break;
      case 'split':
        chain.splitBlock().run();
        break;
    }
  };

  it.each(Array.from({ length: 25 }, (_, i) => i + 1))('converges with structural edits (seed %i)', async (seed) => {
    vi.useFakeTimers();
    const { createRandom } = await import('./testing/random.js');
    const random = createRandom(seed);
    const server = createMemoryServer();
    const writers: Writer[] = [];
    for (let i = 0; i < 3; i++) {
      const transport = server.connect({ seed: seed * 7 + i, latencyMs: 30, dropRate: 0.15, failRate: 0.1 });
      const provider = createSyncProvider({ docId: 'fuzz', transport, tabSync: false, batchMs: 15, resyncMs: 400 });
      await vi.advanceTimersByTimeAsync(50);
      const editor = createEditor({ features: [collaboration({ provider, blockLocks: false })] });
      cleanup.push(() => provider.destroy(), () => editor.destroy());
      writers.push({ editor, transport });
    }
    writers[0]!.editor.tiptap.commands.setContent('<p>Alpha beta gamma.</p><p>Delta epsilon.</p>');
    await vi.advanceTimersByTimeAsync(300);
    for (let step = 0; step < 60; step++) {
      const w = writers[Math.floor(random() * writers.length)] as Writer;
      if (random() < 0.15) w.transport.setOnline(!w.transport.online);
      else randomOp(w, random, `w${writers.indexOf(w)}s${step}`);
      await vi.advanceTimersByTimeAsync(Math.floor(random() * 50));
    }
    writers.forEach((w) => w.transport.setOnline(true));
    await vi.advanceTimersByTimeAsync(70_000);
    const html = writers[0]!.editor.getHTML();
    for (const w of writers) expect(w.editor.getHTML(), `seed ${seed}`).toBe(html);
  });
});
