import * as Y from 'yjs';
import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { AttrStep, ReplaceAroundStep, ReplaceStep, type Step } from '@tiptap/pm/transform';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { absolutePositionToRelativePosition, relativePositionToAbsolutePosition, ySyncPluginKey, type SyncPluginState } from '@tiptap/y-tiptap';
import type { Awareness } from 'y-protocols/awareness';

/** Awareness field a writer uses to announce the block they are editing. */
export const LOCK_FIELD = 'proselineLock';

export interface BlockLocksOptions {
  /** A lock ends this long after the holder's last edit in the block. Default 10 000 ms. */
  idleMs?: number;
}

export interface BlockLock {
  clientId: number;
  name: string;
  color: string;
  /** Document range of the locked textblock (node boundaries included). */
  from: number;
  to: number;
}

export interface LockRefusal {
  name: string;
  at: number;
}

interface Announcement {
  anchor: unknown;
  idleMs: number;
  seq: number;
}

interface RemoteLock {
  clientId: number;
  name: string;
  color: string;
  anchor: Y.RelativePosition;
  expiresAt: number;
}

interface PluginState {
  decorations: DecorationSet;
  flash: number | null;
}

const lockKey = new PluginKey<PluginState>('proselineBlockLocks');
const REFRESH = 'proselineBlockLocks:refresh';
const FLASH_MS = 700;

const syncState = (state: EditorState): SyncPluginState | undefined => ySyncPluginKey.getState(state) as SyncPluginState | undefined;

/** The textblock around `pos` as a node range, or null. */
const textblockAt = (doc: PMNode, pos: number): { from: number; to: number; start: number } | null => {
  if (pos < 0 || pos > doc.content.size) return null;
  const $pos = doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).isTextblock) return { from: $pos.before(depth), to: $pos.after(depth), start: $pos.start(depth) };
  }
  return null;
};

const isLocalEdit = (tr: Transaction): boolean => tr.docChanged && !tr.getMeta(ySyncPluginKey);

export interface BlockLocksHandle {
  extension: Extension;
  getLocks(): BlockLock[];
  getLastRefusal(): LockRefusal | null;
  subscribe(listener: () => void): () => void;
  destroy(): void;
}

/**
 * Hard per-block locks over awareness: a writer's edit claims the textblock it touches, and every
 * other client refuses local changes to it until the holder has been idle for `idleMs`, moves to
 * another block or leaves. Receivers time locks from when renewals arrive, so clocks don't matter.
 */
export const createBlockLocks = (
  awareness: Awareness,
  options: BlockLocksOptions & { canClaim: () => boolean; label: (name: string) => string },
): BlockLocksHandle => {
  const idleMs = options.idleMs ?? 10_000;
  const remote = new Map<number, RemoteLock>();
  const listeners = new Set<() => void>();
  let view: EditorView | null = null;
  let lastRefusal: LockRefusal | null = null;
  let own: { anchor: Y.RelativePosition; start: number } | null = null;
  let seq = 0;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let expiryTimer: ReturnType<typeof setTimeout> | null = null;
  let flashTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;
  let cachedLocks: BlockLock[] = [];

  const notify = () => listeners.forEach((l) => l());

  /** Ask the plugin to rebuild decorations (positions or the lock set changed). */
  const refresh = (): void => {
    if (!view || destroyed) return;
    view.dispatch(view.state.tr.setMeta(REFRESH, true).setMeta('addToHistory', false));
  };

  // ── locks held by others ──────────────────────────────────────────────────
  const resolve = (state: EditorState, anchor: Y.RelativePosition): { from: number; to: number } | null => {
    const sync = syncState(state);
    if (!sync) return null;
    const pos = relativePositionToAbsolutePosition(sync.doc, sync.type, anchor, sync.binding.mapping);
    if (pos === null) return null;
    const block = textblockAt(state.doc, pos);
    return block ? { from: block.from, to: block.to } : null;
  };

  /** Others' locks in `state` (a lock on our own block yields only to a lower client id). */
  const locksIn = (state: EditorState): BlockLock[] => {
    const now = Date.now();
    const ownBlock = own ? textblockAt(state.doc, own.start) : null;
    const result: BlockLock[] = [];
    for (const lock of remote.values()) {
      if (lock.expiresAt <= now) continue;
      const range = resolve(state, lock.anchor);
      if (!range) continue;
      if (ownBlock && ownBlock.from === range.from && awareness.clientID < lock.clientId) continue;
      result.push({ clientId: lock.clientId, name: lock.name, color: lock.color, ...range });
    }
    return result.sort((a, b) => a.from - b.from);
  };

  const scheduleExpiry = (): void => {
    if (expiryTimer) clearTimeout(expiryTimer);
    expiryTimer = null;
    const next = Math.min(...[...remote.values()].map((l) => l.expiresAt));
    if (!Number.isFinite(next)) return;
    expiryTimer = setTimeout(() => {
      const now = Date.now();
      for (const [id, lock] of remote) if (lock.expiresAt <= now) remote.delete(id);
      refresh();
      scheduleExpiry();
    }, Math.max(0, next - Date.now()));
  };

  const onAwareness = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }): void => {
    let changed = false;
    for (const id of removed) changed = remote.delete(id) || changed;
    for (const id of [...added, ...updated]) {
      if (id === awareness.clientID) continue;
      const state = awareness.getStates().get(id) as { user?: { name?: string; color?: string }; [LOCK_FIELD]?: Announcement | null } | undefined;
      const announcement = state?.[LOCK_FIELD];
      if (!announcement) {
        changed = remote.delete(id) || changed;
        continue;
      }
      remote.set(id, {
        clientId: id,
        name: state?.user?.name ?? '…',
        color: state?.user?.color ?? '#888',
        anchor: Y.createRelativePositionFromJSON(announcement.anchor),
        expiresAt: Date.now() + announcement.idleMs,
      });
      changed = true;
    }
    if (!changed) return;
    scheduleExpiry();
    // A co-author with a lower id took our block: give it up.
    if (own && view) {
      const ownBlock = textblockAt(view.state.doc, own.start);
      const lost = ownBlock && locksIn(view.state).some((l) => l.from === ownBlock.from);
      if (lost) release();
    }
    refresh();
  };
  awareness.on('update', onAwareness);

  // ── our own lock ──────────────────────────────────────────────────────────
  const release = (): void => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    if (!own) return;
    own = null;
    if (!destroyed) awareness.setLocalStateField(LOCK_FIELD, null);
  };

  const claim = (state: EditorState): void => {
    const sync = syncState(state);
    const block = textblockAt(state.doc, state.selection.head);
    if (!sync || !block || !options.canClaim()) return;
    if (locksIn(state).some((l) => l.from === block.from)) return;
    const anchor = absolutePositionToRelativePosition(block.start, sync.type, sync.binding.mapping);
    own = { anchor, start: block.start };
    awareness.setLocalStateField(LOCK_FIELD, { anchor: Y.relativePositionToJSON(anchor), idleMs, seq: ++seq } satisfies Announcement);
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(release, idleMs);
  };

  const refuse = (lock: BlockLock): void => {
    lastRefusal = { name: lock.name, at: Date.now() };
    // Side effects must not run inside filterTransaction: flash on the next tick.
    setTimeout(() => {
      if (!view || destroyed) return;
      view.dispatch(view.state.tr.setMeta(lockKey, { flash: lock.from }).setMeta('addToHistory', false));
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => view?.dispatch(view.state.tr.setMeta(lockKey, { flash: null }).setMeta('addToHistory', false)), FLASH_MS);
      notify();
    });
  };

  /**
 * Enter at the very start or end of a locked block only adds an empty paragraph beside it; the
 * holder's content is untouched, so that split is allowed (otherwise a one-paragraph document
 * would leave co-authors nowhere to write).
 */
const isEdgeSplit = (step: Step, from: number, to: number): boolean => {
  if (!(step instanceof ReplaceStep) || step.from !== step.to) return false;
  const { slice } = step;
  const emptySplit = slice.openStart === 1 && slice.openEnd === 1 && slice.content.childCount === 2 && slice.content.size === 4;
  return emptySplit && (step.from === from + 1 || step.from === to - 1);
};

/** True when a step range of `tr` touches one of `locks` (ranges are mapped step by step). */
  const touchedLock = (tr: Transaction, locks: BlockLock[]): BlockLock | null => {
    let ranges = locks.map((l) => ({ lock: l, from: l.from, to: l.to }));
    for (const step of tr.steps) {
      // Wrapping or lifting a block keeps its content but changes its structure.
      if (step instanceof ReplaceAroundStep) {
        const wraps = ranges.find((r) => step.gapFrom <= r.from && step.gapTo >= r.to);
        if (wraps) return wraps.lock;
      }
      if (step instanceof AttrStep) {
        const target = ranges.find((r) => step.pos === r.from);
        if (target) return target.lock;
      }
      const map = step.getMap();
      let hit: BlockLock | null = null;
      map.forEach((start, end) => {
        if (hit) return;
        for (const r of ranges) {
          if (isEdgeSplit(step, r.from, r.to)) continue;
          const inside = start === end ? start > r.from && start < r.to : start < r.to && end > r.from;
          if (inside) hit = r.lock;
        }
      });
      if (hit) return hit;
      ranges = ranges.map((r) => ({ ...r, from: map.map(r.from, 1), to: map.map(r.to, -1) }));
    }
    return null;
  };

  const decorate = (state: EditorState, flash: number | null, locks: BlockLock[]): DecorationSet => {
    cachedLocks = locks;
    return DecorationSet.create(
      state.doc,
      cachedLocks.map((l) =>
        Decoration.node(l.from, l.to, {
          class: l.from === flash ? 'pl-locked pl-locked-flash' : 'pl-locked',
          'data-locked-by': l.name,
          'data-locked-label': options.label(l.name),
          style: `--pl-lock-color: ${l.color}`,
        }),
      ),
    );
  };

  const plugin = new Plugin<PluginState>({
    key: lockKey,
    state: {
      init: (_config, state) => ({ decorations: decorate(state, null, locksIn(state)), flash: null }),
      apply: (tr, prev, _old, state) => {
        const meta = tr.getMeta(lockKey) as { flash: number | null } | undefined;
        const flash = meta ? meta.flash : prev.flash;
        if (tr.getMeta(REFRESH) || tr.getMeta(ySyncPluginKey)) {
          // The Yjs binding's node mapping matches this document: resolve anchors afresh.
          return { decorations: decorate(state, flash, locksIn(state)), flash };
        }
        if (tr.docChanged) {
          // A local edit: the binding has not caught up yet, so shift the known ranges instead —
          // following the start of the block's content, then taking the textblock found there
          // (an allowed edge split must not stretch the lock over the new empty paragraph).
          const mapped = cachedLocks.flatMap((l) => {
            const block = textblockAt(state.doc, tr.mapping.map(l.from + 1, 1));
            return block ? [{ ...l, from: block.from, to: block.to }] : [];
          });
          return { decorations: decorate(state, flash, mapped), flash };
        }
        if (meta) return { decorations: decorate(state, flash, cachedLocks), flash };
        return prev;
      },
    },
    filterTransaction: (tr) => {
      if (!isLocalEdit(tr)) return true;
      const hit = touchedLock(tr, cachedLocks);
      if (!hit) return true;
      refuse(hit);
      return false;
    },
    props: {
      decorations: (state) => lockKey.getState(state)?.decorations,
    },
    view: (editorView) => {
      view = editorView;
      return {
        update: (v, prevState) => {
          const { state } = v;
          if (own) {
            // Keep our anchor's position fresh and release when the caret leaves the block.
            const sync = syncState(state);
            const pos = sync ? relativePositionToAbsolutePosition(sync.doc, sync.type, own.anchor, sync.binding.mapping) : null;
            if (pos !== null) own.start = pos;
            const ownBlock = textblockAt(state.doc, own.start);
            const caretBlock = textblockAt(state.doc, state.selection.head);
            if (!ownBlock || !caretBlock || ownBlock.from !== caretBlock.from) release();
          }
          if (state.doc !== prevState.doc && lastLocalEdit) {
            lastLocalEdit = false;
            claim(state);
          }
          const locks = cachedLocks;
          if (locks !== notifiedLocks) {
            notifiedLocks = locks;
            notify();
          }
        },
        destroy: () => {
          view = null;
        },
      };
    },
    appendTransaction: (trs) => {
      if (trs.some(isLocalEdit)) lastLocalEdit = true;
      return null;
    },
  });
  let lastLocalEdit = false;
  let notifiedLocks: BlockLock[] = [];

  return {
    extension: Extension.create({ name: 'proselineBlockLocks', addProseMirrorPlugins: () => [plugin] }),
    getLocks: () => cachedLocks,
    getLastRefusal: () => lastRefusal,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: () => {
      release();
      destroyed = true;
      awareness.off('update', onAwareness);
      for (const t of [idleTimer, expiryTimer, flashTimer]) if (t) clearTimeout(t);
      listeners.clear();
    },
  };
};
