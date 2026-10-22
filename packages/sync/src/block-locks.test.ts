import { describe, it, expect, vi, afterEach } from 'vitest';
import { TextSelection } from '@tiptap/pm/state';
import { createEditor, type ProselineEditor } from '@proseline-editor/core';
import { createRandom } from './testing/random.js';
import { createSyncProvider } from './provider.js';
import { createMemoryServer, type MemoryServer, type MemoryTransport } from './testing/memory-server.js';
import { collaboration, type CollaborationOptions } from './collaboration.js';

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).reverse().forEach((f) => f());
  vi.useRealTimers();
});

interface Writer {
  editor: ProselineEditor;
  transport: MemoryTransport;
  destroy(): void;
}

const writer = async (server: MemoryServer, name: string, extra: Partial<CollaborationOptions> & { canWrite?: boolean } = {}): Promise<Writer> => {
  const transport = server.connect();
  const provider = createSyncProvider({ docId: 'scene', transport, tabSync: false, batchMs: 10, canWrite: extra.canWrite });
  await vi.advanceTimersByTimeAsync(50);
  const editor = createEditor({
    editable: extra.canWrite !== false,
    features: [collaboration({ provider, user: { name, color: '#0f766e' }, ...extra })],
  });
  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    editor.destroy();
    provider.destroy();
  };
  cleanup.push(destroy);
  return { editor, transport, destroy };
};

/** Ann and Bo share two paragraphs: "First paragraph" (1–16) and "Second one" (18–28). */
const pair = async (opts: Partial<CollaborationOptions> = {}) => {
  const server = createMemoryServer();
  const ann = await writer(server, 'Ann', opts);
  ann.editor.tiptap.commands.setContent('<p>First paragraph</p><p>Second one</p>');
  const bo = await writer(server, 'Bo', opts);
  await vi.advanceTimersByTimeAsync(100);
  return { server, ann, bo };
};

const typeAt = (w: Writer, pos: number, text: string) => {
  const { tiptap } = w.editor;
  tiptap.commands.setTextSelection(pos);
  const { view } = tiptap;
  for (const ch of text) {
    const { from, to } = view.state.selection;
    const handled = view.someProp('handleTextInput', (f) => f(view, from, to, ch, () => view.state.tr.insertText(ch, from, to)));
    if (!handled) view.dispatch(view.state.tr.insertText(ch, from, to));
  }
};

const locks = (w: Writer) => w.editor.feature('collaboration')!.getState().locks;

describe('block locks', () => {
  it('locks the block a co-author is typing in, for everyone else', async () => {
    vi.useFakeTimers();
    const { ann, bo } = await pair();
    typeAt(ann, 16, '!');
    await vi.advanceTimersByTimeAsync(100);
    expect(locks(bo)).toEqual([expect.objectContaining({ name: 'Ann', from: 0, to: 18 })]);
    typeAt(bo, 6, 'X');
    expect(bo.editor.getText()).toContain('First paragraph!');
    expect(bo.editor.getText()).not.toContain('X');
    await vi.advanceTimersByTimeAsync(10); // the refusal is reported on the next tick
    expect(bo.editor.feature('collaboration')!.getState().lastRefusal).toMatchObject({ name: 'Ann' });
    expect(bo.editor.tiptap.view.dom.querySelector('.pl-locked-flash')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(bo.editor.tiptap.view.dom.querySelector('.pl-locked-flash')).toBeNull();
    expect(locks(ann)).toEqual([]); // nobody else holds a lock
  });

  it('leaves the other blocks editable', async () => {
    vi.useFakeTimers();
    const { ann, bo } = await pair();
    typeAt(ann, 16, '!');
    await vi.advanceTimersByTimeAsync(100);
    typeAt(bo, 29, ' too');
    await vi.advanceTimersByTimeAsync(100);
    expect(ann.editor.getText()).toContain('Second one too');
  });

  it('refuses structural changes, deletions and joins touching the locked block', async () => {
    vi.useFakeTimers();
    const { ann, bo } = await pair();
    typeAt(ann, 16, '!');
    await vi.advanceTimersByTimeAsync(100);
    const before = bo.editor.getHTML();
    bo.editor.tiptap.chain().setTextSelection(3).setNode('heading', { level: 1 }).run();
    bo.editor.tiptap.chain().setTextSelection(3).toggleBlockquote().run();
    bo.editor.tiptap.chain().setTextSelection({ from: 10, to: 22 }).deleteSelection().run();
    bo.editor.tiptap.chain().setTextSelection(19).joinBackward().run();
    expect(bo.editor.getHTML()).toBe(before);
  });

  it('still lets co-authors start a new paragraph right after or before the locked one', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const ann = await writer(server, 'Ann');
    ann.editor.tiptap.commands.setContent('<p>Only paragraph</p>');
    const bo = await writer(server, 'Bo');
    await vi.advanceTimersByTimeAsync(100);
    typeAt(ann, 15, '!');
    await vi.advanceTimersByTimeAsync(100);
    bo.editor.tiptap.chain().setTextSelection(16).splitBlock().run(); // Enter at the end
    typeAt(bo, bo.editor.tiptap.state.selection.head, 'After');
    bo.editor.tiptap.chain().setTextSelection(1).splitBlock().run(); // Enter at the start
    typeAt(bo, 1, 'Before');
    bo.editor.tiptap.chain().setTextSelection(13).splitBlock().run(); // Enter in the middle: refused
    await vi.advanceTimersByTimeAsync(100);
    expect(ann.editor.getHTML()).toBe('<p>Before</p><p>Only paragraph!</p><p>After</p>');
    expect(bo.editor.getHTML()).toBe(ann.editor.getHTML());
  });

  it('shows the lock in the document with the writer and a translated label', async () => {
    vi.useFakeTimers();
    const { ann, bo } = await pair();
    typeAt(ann, 16, '!');
    await vi.advanceTimersByTimeAsync(100);
    const locked = bo.editor.tiptap.view.dom.querySelector('.pl-locked') as HTMLElement;
    expect(locked.textContent).toBe('First paragraph!');
    expect(locked.getAttribute('data-locked-by')).toBe('Ann');
    expect(locked.getAttribute('data-locked-label')).toBe('Ann is editing');
    expect(locked.style.getPropertyValue('--pl-lock-color')).toBe('#0f766e');
  });

  it('releases the lock after the idle time', async () => {
    vi.useFakeTimers();
    const { ann, bo } = await pair({ blockLocks: { idleMs: 10_000 } });
    typeAt(ann, 16, '!');
    await vi.advanceTimersByTimeAsync(9_000);
    typeAt(ann, 17, '!'); // renews
    await vi.advanceTimersByTimeAsync(9_000);
    expect(locks(bo)).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(locks(bo)).toEqual([]);
    typeAt(bo, 6, 'X');
    await vi.advanceTimersByTimeAsync(100);
    expect(ann.editor.getText()).toContain('FirstX');
  });

  it('releases the lock when the writer moves to another block', async () => {
    vi.useFakeTimers();
    const { ann, bo } = await pair();
    typeAt(ann, 16, '!');
    await vi.advanceTimersByTimeAsync(100);
    ann.editor.tiptap.commands.setTextSelection(22);
    await vi.advanceTimersByTimeAsync(100);
    expect(locks(bo)).toEqual([]);
  });

  it('releases the lock when the writer leaves', async () => {
    vi.useFakeTimers();
    const { ann, bo } = await pair();
    typeAt(ann, 16, '!');
    await vi.advanceTimersByTimeAsync(100);
    ann.destroy();
    await vi.advanceTimersByTimeAsync(100);
    expect(locks(bo)).toEqual([]);
  });

  it('follows the block when text above it changes', async () => {
    vi.useFakeTimers();
    const { ann, bo } = await pair();
    typeAt(ann, 29, '!'); // Ann locks "Second one"
    await vi.advanceTimersByTimeAsync(100);
    typeAt(bo, 1, 'Long prefix '); // Bo edits the first block
    await vi.advanceTimersByTimeAsync(100);
    const [lock] = locks(bo);
    const text = bo.editor.tiptap.state.doc.textBetween(lock!.from, lock!.to);
    expect(text).toBe('Second one!');
  });

  it('lets viewers see locks but never claims for them', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const ann = await writer(server, 'Ann');
    ann.editor.tiptap.commands.setContent('<p>Text</p>');
    const viewer = await writer(server, 'Vi', { canWrite: false });
    await vi.advanceTimersByTimeAsync(100);
    viewer.editor.tiptap.commands.setTextSelection(2);
    await vi.advanceTimersByTimeAsync(100);
    expect(locks(ann)).toEqual([]);
  });

  it('resolves a race: both keep their first edits, then the lower client id holds the block', async () => {
    vi.useFakeTimers();
    const { ann, bo } = await pair();
    ann.transport.setOnline(false);
    bo.transport.setOnline(false);
    typeAt(ann, 16, ' A');
    typeAt(bo, 6, ' B');
    ann.transport.setOnline(true);
    bo.transport.setOnline(true);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(ann.editor.getText()).toBe(bo.editor.getText());
    expect(ann.editor.getText()).toContain(' A');
    expect(ann.editor.getText()).toContain(' B');
    // Both type again right away; only the winner's edit lands.
    typeAt(ann, 3, '1');
    typeAt(bo, 3, '2');
    await vi.advanceTimersByTimeAsync(100);
    typeAt(ann, 3, '1');
    typeAt(bo, 3, '2');
    await vi.advanceTimersByTimeAsync(5000);
    const text = ann.editor.getText();
    expect(text).toBe(bo.editor.getText());
    expect(text.includes('11') !== text.includes('22')).toBe(true);
  });

  it('can be turned off', async () => {
    vi.useFakeTimers();
    const { ann, bo } = await pair({ blockLocks: false });
    typeAt(ann, 16, '!');
    await vi.advanceTimersByTimeAsync(100);
    typeAt(bo, 6, 'X');
    await vi.advanceTimersByTimeAsync(100);
    expect(ann.editor.getText()).toContain('FirstX');
    expect(locks(bo)).toEqual([]);
  });
});

describe('block locks fuzz', () => {
  it.each(Array.from({ length: 15 }, (_, i) => i + 1))('converges with locks on (seed %i)', async (seed) => {
    vi.useFakeTimers();
    const random = createRandom(seed);
    const server = createMemoryServer();
    const writers: Writer[] = [];
    for (let i = 0; i < 3; i++) {
      const transport = server.connect({ seed: seed * 11 + i, latencyMs: 30, dropRate: 0.1, failRate: 0.1 });
      const provider = createSyncProvider({ docId: 'fuzz', transport, tabSync: false, batchMs: 15, resyncMs: 400 });
      await vi.advanceTimersByTimeAsync(50);
      const editor = createEditor({ features: [collaboration({ provider, user: { name: `w${i}`, color: '#123456' }, blockLocks: { idleMs: 300 } })] });
      cleanup.push(() => provider.destroy(), () => editor.destroy());
      writers.push({ editor, transport, destroy: () => undefined });
    }
    writers[0]!.editor.tiptap.commands.setContent('<p>Alpha beta.</p><p>Gamma delta.</p><p>Epsilon.</p>');
    await vi.advanceTimersByTimeAsync(300);
    for (let step = 0; step < 80; step++) {
      const w = writers[Math.floor(random() * writers.length)] as Writer;
      const { tiptap } = w.editor;
      if (random() < 0.1) {
        w.transport.setOnline(!w.transport.online);
      } else {
        const $pos = tiptap.state.doc.resolve(Math.floor(random() * (tiptap.state.doc.content.size + 1)));
        tiptap.view.dispatch(tiptap.state.tr.setSelection(TextSelection.near($pos)));
        const roll = random();
        if (roll < 0.6) tiptap.chain().insertContent(`s${step} `).run();
        else if (roll < 0.75) tiptap.chain().setNode('heading', { level: 2 }).run();
        else if (roll < 0.85) tiptap.chain().setParagraph().run();
        else tiptap.chain().splitBlock().run();
      }
      await vi.advanceTimersByTimeAsync(Math.floor(random() * 80));
    }
    writers.forEach((w) => w.transport.setOnline(true));
    await vi.advanceTimersByTimeAsync(70_000);
    const html = writers[0]!.editor.getHTML();
    for (const w of writers) expect(w.editor.getHTML(), `seed ${seed}`).toBe(html);
    for (const w of writers) expect(w.editor.feature('collaboration')!.getState().locks, `seed ${seed}`).toEqual([]);
  });
});
