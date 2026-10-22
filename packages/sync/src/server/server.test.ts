// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as Y from 'yjs';
import { prosemirrorJSONToYDoc } from '@tiptap/y-tiptap';
import { getSchema } from '@tiptap/core';
import { proseExtensions } from '@proseline-editor/core';
import {
  countWords,
  createDocCache,
  deriveHtml,
  deriveText,
  diffForStateVector,
  htmlToUpdate,
  isValidStateVector,
  isValidUpdate,
  mergeUpdates,
  shouldCompact,
  stateVectorOf,
} from './index.js';

afterEach(() => vi.useRealTimers());

const schema = getSchema(proseExtensions());
const sceneState = () =>
  Y.encodeStateAsUpdate(
    prosemirrorJSONToYDoc(
      schema,
      {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Chapter' }] },
          { type: 'paragraph', attrs: { style: 'epigraph', firstLineIndent: true }, content: [{ type: 'text', text: 'Він сказав — і пішов.' }] },
        ],
      },
      'prosemirror',
    ),
  );

describe('update helpers', () => {
  it('validates updates and state vectors', () => {
    expect(isValidUpdate(sceneState())).toBe(true);
    expect(isValidUpdate(new Uint8Array([1, 2, 3, 250]))).toBe(false);
    expect(isValidStateVector(stateVectorOf(sceneState()))).toBe(true);
    expect(isValidStateVector(new Uint8Array([255, 255, 255]))).toBe(false);
  });

  it('merges updates and serves diffs', () => {
    const doc = new Y.Doc();
    const updates: Uint8Array[] = [];
    doc.on('update', (u: Uint8Array) => updates.push(u));
    doc.getText('t').insert(0, 'ab');
    const peer = new Y.Doc();
    Y.applyUpdate(peer, updates[0]!);
    doc.getText('t').insert(2, 'c');
    const merged = mergeUpdates(updates);
    Y.applyUpdate(peer, diffForStateVector(merged, Y.encodeStateVector(peer)));
    expect(peer.getText('t').toString()).toBe('abc');
    expect(diffForStateVector(merged)).toBe(merged);
  });

  it('decides when to compact a log', () => {
    expect(shouldCompact(200)).toBe(false);
    expect(shouldCompact(201)).toBe(true);
    expect(shouldCompact(11, 10)).toBe(true);
  });
});

describe('derivation', () => {
  it('renders HTML, text and word count from a Yjs state', () => {
    const state = sceneState();
    expect(deriveHtml(state)).toBe('<h1>Chapter</h1><p data-style="epigraph">Він сказав — і пішов.</p>');
    expect(deriveText(state)).toBe('Chapter\n\nВін сказав — і пішов.');
    expect(countWords(state)).toBe(5);
  });

  it('round-trips HTML through a Yjs document', () => {
    const html = '<p data-indent="false">Flush</p><p>Body <strong>bold</strong></p>';
    expect(deriveHtml(htmlToUpdate(html))).toBe(html);
    expect(deriveHtml(htmlToUpdate(''))).toBe('<p></p>');
  });
});

describe('createDocCache', () => {
  it('loads a document once for concurrent misses and applies updates in memory', async () => {
    const load = vi.fn(async () => sceneState());
    const cache = createDocCache({ load });
    const [a, b] = await Promise.all([cache.get('s1'), cache.get('s1')]);
    expect(a).toBe(b);
    expect(load).toHaveBeenCalledTimes(1);
    const peer = new Y.Doc();
    Y.applyUpdate(peer, await cache.diff('s1'));
    peer.getXmlFragment('prosemirror').insert(0, [new Y.XmlElement('paragraph')]);
    await cache.apply('s1', Y.encodeStateAsUpdate(peer, Y.encodeStateVector(a)));
    expect(load).toHaveBeenCalledTimes(1);
    expect(deriveHtml(a)).toMatch(/^<p><\/p><h1>Chapter/);
  });

  it('runs the idle callback once after updates settle', async () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const cache = createDocCache({ load: async () => null, onIdle, idleMs: 2000 });
    const writer = new Y.Doc();
    const updates: Uint8Array[] = [];
    writer.on('update', (u: Uint8Array) => updates.push(u));
    writer.getText('t').insert(0, 'a');
    writer.getText('t').insert(1, 'b');
    await cache.apply('s', updates[0]!);
    await vi.advanceTimersByTimeAsync(1000);
    await cache.apply('s', updates[1]!);
    await vi.advanceTimersByTimeAsync(1999);
    expect(onIdle).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
    expect((onIdle.mock.calls[0]![1] as Y.Doc).getText('t').toString()).toBe('ab');
  });

  it('evicts least recently used documents, flushing their idle work first', async () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const cache = createDocCache({ load: async () => null, onIdle, max: 2 });
    const update = (() => {
      const d = new Y.Doc();
      d.getText('t').insert(0, 'x');
      return Y.encodeStateAsUpdate(d);
    })();
    await cache.apply('a', update);
    await cache.get('b');
    await cache.get('a'); // a is now most recent
    await cache.get('c'); // evicts b (no idle work)
    expect(cache.size).toBe(2);
    expect(onIdle).not.toHaveBeenCalled();
    await cache.get('d'); // evicts a, which has pending idle work
    await vi.advanceTimersByTimeAsync(0);
    expect(onIdle).toHaveBeenCalledWith('a', expect.any(Y.Doc));
  });

  it('flushes pending idle work on shutdown', async () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const cache = createDocCache({ load: async () => null, onIdle });
    await cache.apply('a', Y.encodeStateAsUpdate(new Y.Doc()));
    await cache.flush();
    expect(onIdle).toHaveBeenCalledTimes(1);
  });
});
